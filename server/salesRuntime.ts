import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LastAppAdapter } from '../src/infrastructure/sales/lastapp/LastAppAdapter';
import { TrustedSalesRepository } from '../src/infrastructure/sales/repositories/TrustedSalesRepository';
import { SyncSalesSourceUseCase } from '../src/application/sales/useCases/SyncSalesSourceUseCase';
import type { ProductMapping } from '../src/application/sales/services/LastAppSalesMapper';

export interface Request { method?: string; headers: Record<string,string|string[]|undefined>; body?: Record<string,unknown> }
export interface Response { status(code:number): Response; json(value:unknown): void; end(): void }
export function serverClient(): SupabaseClient {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SERVER_NOT_CONFIGURED');
  return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function authorize(request: Request, org: string, capability: string) {
  const auth = request.headers.authorization;
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ') || !org) throw new Error('DENIED');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) throw new Error('SERVER_NOT_CONFIGURED');
  const caller = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{
    global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:user,error:userError} = await caller.auth.getUser(auth.slice(7));
  if (userError || !user.user) throw new Error('DENIED');
  const {data,error} = await caller.rpc('can_execute_capability_for_org',{
    requested_organization_id:org, required_capability_code:capability});
  if (error || data !== true) throw new Error('DENIED');
}
export async function mapping(client: SupabaseClient, org: string, location: string) {
  const {data,error} = await client.from('sales_location_mappings').select('*')
    .eq('organization_id',org).eq('external_location_id',location).eq('is_active',true).single();
  if (error || !data) throw new Error('LOCATION_NOT_MAPPED');
  const {data:unit,error:unitError} = await client.from('eco_operational_units').select('id')
    .eq('id',data.operational_unit_id).eq('organization_id',org).eq('is_active',true).single();
  if (unitError || !unit) throw new Error('LOCATION_NOT_MAPPED');
  return data;
}
export async function synchronize(client: SupabaseClient, input: {organizationId:string; externalLocationId:string;
  startDate:string; endDate:string; mode:'BACKFILL'|'RECONCILIATION'|'WEBHOOK'; tabId?:string; eventId?:string}) {
  const source = new LastAppAdapter({token:process.env.LAST_APP_TOKEN ?? '',timeoutMs:4000,maxAttempts:2});
  const config = await mapping(client,input.organizationId,input.externalLocationId);
  const {data:products,error:productError} = await client.from('sales_product_mappings').select('*')
    .eq('organization_id',input.organizationId).eq('external_location_id',input.externalLocationId);
  if (productError) throw new Error('MAPPING_READ_FAILED');
  const productMap = new Map<string,ProductMapping>((products??[]).map(p => [p.external_product_id,{status:p.status,productId:p.product_id}]));
  const {data:run,error} = await client.from('sales_sync_runs').insert({organization_id:input.organizationId,
    external_location_id:input.externalLocationId,operational_unit_id:config.operational_unit_id,
    mode:input.mode,requested_start:input.startDate,requested_end:input.endDate,event_id:input.eventId,status:'PROCESSING'}).select('id').single();
  if (error || !run) throw new Error('SYNC_PROVENANCE_FAILED');
  const update = async (values: Record<string,unknown>) => {
    const {error:err} = await client.from('sales_sync_runs').update(values).eq('id',run.id).eq('organization_id',input.organizationId);
    if (err) throw new Error('SYNC_PROVENANCE_FAILED');
  };
  try {
    const operation = new SyncSalesSourceUseCase(source,new TrustedSalesRepository(client));
    const counts = await operation.execute({locationId:input.externalLocationId,startDate:input.startDate,endDate:input.endDate},
      {organizationId:input.organizationId,operationalUnitId:config.operational_unit_id,externalLocationId:input.externalLocationId,
        currency:config.currency,syncRunId:run.id,observedAt:new Date().toISOString(),products:productMap},evidence => update({...evidence}),input.tabId);
    const status = counts.rejected ? 'PARTIAL' : 'COMPLETED';
    await update({...counts,status,completed_at:new Date().toISOString()});
    return {id:run.id,status,...counts};
  } catch {
    await update({status:'FAILED',error_summary:'SOURCE_SYNC_FAILED',completed_at:new Date().toISOString()});
    throw new Error('SOURCE_SYNC_FAILED');
  }
}
