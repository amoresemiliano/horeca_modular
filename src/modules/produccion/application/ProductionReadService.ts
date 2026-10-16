import type { SupabaseClient } from '@supabase/supabase-js';
import type { BatchDetail, BatchPage, BatchRecord, HistoryFilter, PolicyRecord, ProductionReadPort, ProductionScope, WasteRecord } from './readModels';
import type { ProductionOutboxEvent } from '../domain/contracts';
import type { ExecutionRecord } from './readModels';
import { ProductionError } from './errors';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function requireScope(scope: ProductionScope) {
  if (!uuid.test(scope.organizationId) || !uuid.test(scope.operationalUnitId)) throw new ProductionError('PRODUCTION_ACCESS_DENIED');
}
const columns = 'id,organization_id,operational_unit_id,effective_date,recorded_at,actor_profile_id,status,revision,draft,current_execution_id';
const pageSize = 20;
function timestampMicros(value:string):bigint {
  const fraction=value.match(/\.(\d+)(?:Z|[+-])/)?.[1] || '';
  const whole=value.replace(/\.\d+(?=Z|[+-])/,'');
  return BigInt(Date.parse(whole))*1000n+BigInt(fraction.padEnd(6,'0'));
}

/** Explicit scoped, bounded read projections over SELECT-only canonical tables. RLS remains authoritative. */
export class ProductionReadService implements ProductionReadPort {
  constructor(private readonly client: SupabaseClient) {}
  private query(table: string, scope: ProductionScope, select = '*') {
    requireScope(scope);
    return this.client.from(table).select(select).eq('organization_id', scope.organizationId).eq('operational_unit_id', scope.operationalUnitId);
  }
  async history(scope: ProductionScope, filter: HistoryFilter): Promise<BatchPage> {
    if (filter.date && !/^\d{4}-\d{2}-\d{2}$/.test(filter.date)) throw new ProductionError('INVALID_EXECUTION');
    if (filter.productId && !uuid.test(filter.productId)) throw new ProductionError('REFERENCE_DENIED');
    if (filter.cursor && (!uuid.test(filter.cursor.id) || !/^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/.test(filter.cursor.recordedAt))) throw new ProductionError('INVALID_COMMAND');
    const make = (inner = false) => {
      let q = this.query('eco_production_batches', scope, `${columns},execution:eco_production_executions!production_current_execution_fk${inner ? '!inner' : ''}(snapshot)`);
      if (filter.date) q = q.eq('effective_date', filter.date);
      if (filter.status) q = q.eq('status', filter.status);
      if (filter.cursor) q = q.or(`recorded_at.lt.${filter.cursor.recordedAt},and(recorded_at.eq.${filter.cursor.recordedAt},id.lt.${filter.cursor.id})`);
      return q.order('recorded_at', { ascending: false }).order('id', { ascending: false }).limit(pageSize + 1);
    };
    // Two bounded keyset streams preserve product filtering for drafts and current immutable outputs.
    const results = filter.productId
      ? await Promise.all([
        make().in('status', ['DRAFT', 'CANCELLED']).filter('draft->outputs','cs',JSON.stringify([{ product_id: filter.productId }])).returns<BatchRecord[]>(),
        make(true).not('current_execution_id', 'is', null).filter('execution.snapshot->outputs','cs',JSON.stringify([{ product_id: filter.productId }])).returns<BatchRecord[]>(),
      ]) : [await make().returns<BatchRecord[]>()];
    if (results.some(r => r.error)) throw new ProductionError('PRODUCTION_READ_FAILED');
    const rows = results.flatMap(r => r.data || []) as unknown as BatchRecord[];
    rows.sort((a,b)=>{
      const left=timestampMicros(a.recorded_at),right=timestampMicros(b.recorded_at);
      return left===right ? (a.id===b.id?0:a.id<b.id?1:-1) : left<right?1:-1;
    });
    const items = rows.slice(0, pageSize), last = items.at(-1);
    return { items, next: rows.length > pageSize && last ? { recordedAt: last.recorded_at, id: last.id } : undefined };
  }
  async policies(scope: ProductionScope, afterId?: string) {
    if (afterId && !uuid.test(afterId)) throw new ProductionError('INVALID_COMMAND');
    let q = this.query('eco_production_policies', scope, 'id,product_id,stock_scope,minimum::text,maximum::text,unit,revision').order('id').limit(21);
    if (afterId) q = q.gt('id', afterId);
    const { data, error } = await q.returns<PolicyRecord[]>();
    if (error) throw new ProductionError('PRODUCTION_READ_FAILED');
    const items = (data || []).slice(0, 20).map(p => ({ ...p, minimum: String(p.minimum), maximum: String(p.maximum) })) as PolicyRecord[];
    return { items, next: (data?.length || 0) > 20 ? items.at(-1)?.id : undefined };
  }
  async detail(scope: ProductionScope, id: string): Promise<BatchDetail> {
    if (!uuid.test(id)) throw new ProductionError('REFERENCE_DENIED');
    const batchResult = await this.query('eco_production_batches', scope, `${columns},execution:eco_production_executions!production_current_execution_fk(snapshot)`).eq('id', id).single().returns<BatchRecord>();
    if (batchResult.error || !batchResult.data) throw new ProductionError('PRODUCTION_READ_FAILED');
    const [executions, wastes, outbox] = await Promise.all([
      this.query('eco_production_executions', scope).eq('batch_id', id).order('batch_revision', { ascending: false }).limit(51).returns<ExecutionRecord[]>(),
      this.query('eco_production_wastes', scope,'id,execution_id,product_id,quantity::text,unit,classification,reason,related_line_id,location_id,actor_profile_id,recorded_at').eq('batch_id', id).order('recorded_at', { ascending: false }).limit(101).returns<Omit<WasteRecord,'confirmed'|'waste_id'>[]>(),
      this.query('eco_production_outbox', scope).eq('batch_id', id).order('occurred_at', { ascending: false }).limit(101).returns<ProductionOutboxEvent[]>(),
    ]);
    if ([executions, wastes, outbox].some(r => r.error)) throw new ProductionError('PRODUCTION_READ_FAILED');
    const declarations = (wastes.data || []).slice(0, 100);
    const confirmations = declarations.length ? await this.query('eco_production_waste_confirmations', scope, 'waste_id').in('waste_id', declarations.map(w => w.id)).limit(100).returns<{waste_id:string}[]>() : { data: [], error: null };
    if (confirmations.error) throw new ProductionError('PRODUCTION_READ_FAILED');
    const confirmed = new Set(confirmations.data?.map(w => w.waste_id));
    return {
      batch: batchResult.data as unknown as BatchRecord,
      executions: (executions.data || []).slice(0, 50) as ExecutionRecord[],
      wastes: declarations.map(w => ({ ...w, waste_id: w.id, quantity: String(w.quantity), confirmed: confirmed.has(w.id) })) as WasteRecord[],
      outbox: (outbox.data || []).slice(0, 100) as ProductionOutboxEvent[],
      truncated: (executions.data?.length || 0) > 50 || (wastes.data?.length || 0) > 100 || (outbox.data?.length || 0) > 100,
    };
  }
}
