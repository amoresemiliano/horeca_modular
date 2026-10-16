import type { ExecutionDeclaration, OutputDeclaration, ProductionCommand, ProductionCommandResult, ProductionCommandType } from '../domain/contracts';
import { decimalAtoms, decimalString, packagedQuantity } from '../domain/quantities';
import { evaluateRequirement } from '../domain/planning';
import type { BatchRecord, OwnerContext, ProductionAccess, ProductionCommandPort, ProductionScope } from './readModels';
import { ProductionError } from './errors';

export const statusLabels = { DRAFT:'Borrador', CONFIRMED:'Confirmado', CORRECTED:'Corregido', REVERSED:'Revertido', CANCELLED:'Cancelado' };
export const planningLabels = { CRITICAL:'Crítico', NECESSARY:'Necesario', OPTIMAL:'Óptimo', EXCESS:'Exceso', UNKNOWN:'Stock no disponible' };
export const wasteLabels = { PROCESS_ALREADY_CONSUMED:'Pérdida de material ya consumido', STOCK_REMOVAL:'Retirada de material en stock', OUTPUT_LOSS:'Pérdida de producto terminado' };
export function businessToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function displayQuantity(value: string) { return value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value; }
export function batchSnapshot(batch: BatchRecord) { return batch.execution?.snapshot || batch.draft; }
export function planningProjection(min: string, max: string, actual: string | null) {
  try { if(actual!==null)decimalAtoms(actual); } catch { actual=null; }
  return evaluateRequirement(min,max,actual);
}
export function scopedOwners(context: OwnerContext, scope: ProductionScope): OwnerContext {
  if (!context.available) return { available:false,products:[],packages:[],locations:[],recipes:[],stock:[] };
  const products = context.products.filter(p => p.approved && p.organization_id === scope.organizationId && (!p.operational_unit_id || p.operational_unit_id === scope.operationalUnitId));
  return { ...context,products,
    packages:context.packages.filter(p => p.approved && p.organization_id === scope.organizationId && products.some(product => product.id === p.product_id)),
    locations:context.locations.filter(l => l.approved && l.organization_id === scope.organizationId && l.operational_unit_id === scope.operationalUnitId),
    recipes:context.recipes.filter(r => r.approved && r.organization_id === scope.organizationId),
    stock:context.stock.filter(s => s.organization_id===scope.organizationId && s.operational_unit_id===scope.operationalUnitId),
  };
}
export interface DraftFields {
  effectiveDate: string; productId: string; packageId: string; locationId: string;
  count: string; loose: boolean; quantity: string; shift: string; notes: string; lineId: string;
}
export function previewDraft(fields: DraftFields, owners: OwnerContext) {
  if (!owners.available) throw new ProductionError('OWNER_CONTRACT_UNAVAILABLE');
  const product = owners.products.find(p => p.id === fields.productId), location = owners.locations.find(l => l.id === fields.locationId);
  if (!product || !location) throw new ProductionError('REFERENCE_DENIED');
  if (fields.loose) {
    if (!product.loose_allowed || decimalAtoms(fields.quantity) <= 0n) throw new ProductionError('INVALID_EXECUTION');
    return { quantity:decimalString(decimalAtoms(fields.quantity)),unit:product.base_unit,conversion:'Cantidad suelta aprobada' };
  }
  const pack = owners.packages.find(p => p.id === fields.packageId && p.product_id === product.id);
  if (!pack || !pack.version || pack.unit !== product.base_unit) throw new ProductionError('UNKNOWN_OR_INVALID_CONVERSION');
  if (!/^[1-9]\d*$/.test(fields.count)) throw new ProductionError('INVALID_PACKAGE_COUNT');
  return { quantity:packagedQuantity(Number(fields.count),pack.net_quantity),unit:pack.unit,conversion:`${fields.count} × ${displayQuantity(pack.net_quantity)} ${pack.unit}` };
}
export function draftDeclaration(fields: DraftFields, owners: OwnerContext, previous?: ExecutionDeclaration): ExecutionDeclaration {
  previewDraft(fields,owners);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.effectiveDate) || new Date(fields.effectiveDate+'T12:00:00Z').toISOString().slice(0,10) !== fields.effectiveDate) throw new ProductionError('INVALID_EXECUTION');
  const product = owners.products.find(p => p.id === fields.productId)!;
  const output: OutputDeclaration = fields.loose
    ? {line_id:fields.lineId,product_id:product.id,destination_location_id:fields.locationId,mode:'LOOSE',quantity:decimalString(decimalAtoms(fields.quantity)),unit:product.base_unit}
    : {line_id:fields.lineId,product_id:product.id,destination_location_id:fields.locationId,mode:'PACKAGED',package_id:fields.packageId,package_version:owners.packages.find(p=>p.id===fields.packageId)!.version,count:Number(fields.count)};
  return { mode:'MANUAL_OUTPUT',effective_date:fields.effectiveDate,shift:fields.shift || undefined,notes:fields.notes || undefined,outputs:[output],consumptions:previous?.consumptions || [] };
}
export function declarationFromBatch(batch: BatchRecord): ExecutionDeclaration {
  const s=batchSnapshot(batch);
  return {mode:s.mode,effective_date:s.effective_date,shift:s.shift || undefined,notes:s.notes || undefined,
    outputs:s.outputs.map(o=>o.mode==='PACKAGED'
      ? {line_id:o.line_id,product_id:o.product_id,destination_location_id:o.destination_location_id,mode:'PACKAGED',package_id:o.package_id!,package_version:o.package_version!,count:o.unit_count!}
      : {line_id:o.line_id,product_id:o.product_id,destination_location_id:o.destination_location_id,mode:'LOOSE',quantity:o.quantity,unit:o.unit}),
    consumptions:s.consumptions,
  };
}
export function fieldsFromBatch(batch: BatchRecord): DraftFields {
  const s=batchSnapshot(batch), o=s.outputs[0];
  if (!o || s.outputs.length!==1 || s.mode!=='MANUAL_OUTPUT') throw new ProductionError('INVALID_EXECUTION');
  return { effectiveDate:s.effective_date,productId:o.product_id,packageId:o.package_id || '',locationId:o.destination_location_id,
    count:String(o.unit_count || ''),loose:o.mode==='LOOSE',quantity:o.quantity,shift:s.shift || '',notes:s.notes || '',lineId:o.line_id };
}
export function editableBatch(batch: BatchRecord) { const s=batchSnapshot(batch);return s.mode==='MANUAL_OUTPUT' && s.outputs.length===1; }
const commandAccess: Record<ProductionCommandType,keyof ProductionAccess> = {
  create_draft:'log',update_draft:'log',cancel_draft:'log',confirm_batch:'confirm',correct_batch:'correct',reverse_batch:'correct',save_policy:'plan',log_waste:'wasteLog',confirm_waste:'wasteConfirm',
};
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (value && typeof value==='object') return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
  return JSON.stringify(value);
}
/** One identity and in-flight/result cache per exact command intent, including uncertain transport retries. */
export class ProductionCommandSession {
  private attempts = new Map<string,{request:ProductionCommand;pending?:Promise<ProductionCommandResult>;result?:ProductionCommandResult}>();
  constructor(private readonly port: ProductionCommandPort,private readonly permission: (key:keyof ProductionAccess)=>boolean,private readonly identity:()=>string=()=>crypto.randomUUID()) {}
  execute(input: Omit<ProductionCommand,'request_id'>): Promise<ProductionCommandResult> {
    if (!this.permission(commandAccess[input.command])) return Promise.reject(new ProductionError('PRODUCTION_ACCESS_DENIED'));
    const key=canonical(input);
    let attempt=this.attempts.get(key);
    if (!attempt) {attempt={request:{...input,request_id:this.identity()}};this.attempts.set(key,attempt);}
    if(attempt.result)return Promise.resolve(attempt.result);
    if(attempt.pending)return attempt.pending;
    const current=attempt;
    current.pending=this.port.execute(current.request).then(result=>{current.result=result;return result;}).finally(()=>{current.pending=undefined;});
    return current.pending;
  }
}
