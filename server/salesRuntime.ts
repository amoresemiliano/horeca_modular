import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LastAppAdapter } from '../src/infrastructure/sales/lastapp/LastAppAdapter.js';
import { LastAppRateLimiter } from '../src/infrastructure/sales/lastapp/LastAppRateLimiter.js';
import { SupabaseLastAppRateBudget } from '../src/infrastructure/sales/lastapp/SupabaseLastAppRateBudget.js';
import { TrustedSalesRepository } from '../src/infrastructure/sales/repositories/TrustedSalesRepository.js';
import { SyncSalesSourceUseCase } from '../src/application/sales/useCases/SyncSalesSourceUseCase.js';
import type { ProductMapping } from '../src/application/sales/services/LastAppSalesMapper.js';
import { SupabaseSalesSyncCheckpoint } from '../src/infrastructure/sales/repositories/SupabaseSalesSyncCheckpoint.js';
import type { SalesSyncCheckpoint } from '../src/application/sales/ports/SalesSyncCheckpointPort.js';

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
  const source = new LastAppAdapter({token:process.env.LAST_APP_TOKEN ?? '',timeoutMs:4000,maxAttempts:2,
    rateLimiter:new LastAppRateLimiter(new SupabaseLastAppRateBudget(client)),deadline:performance.now()+40000});
  const config = await mapping(client,input.organizationId,input.externalLocationId);
  const {data:products,error:productError} = await client.from('sales_product_mappings').select('*')
    .eq('organization_id',input.organizationId).eq('external_location_id',input.externalLocationId);
  if (productError) throw new Error('MAPPING_READ_FAILED');
  const productMap = new Map<string,ProductMapping>((products??[]).map(p => [p.external_product_id,{status:p.status,productId:p.product_id}]));
  const {data:run,error} = await client.from('sales_sync_runs').insert({organization_id:input.organizationId,
    external_location_id:input.externalLocationId,operational_unit_id:config.operational_unit_id,
    mode:input.mode,requested_start:input.startDate,requested_end:input.endDate,event_id:input.eventId,status:'PROCESSING'}).select('id').single();
  if (error || !run) throw new Error('SYNC_PROVENANCE_FAILED');
  if (input.mode !== 'WEBHOOK') return continueSalesSync(client,{organizationId:input.organizationId,runId:run.id,version:0});
  const update = async (values: Record<string,unknown>) => {
    const {error:err} = await client.from('sales_sync_runs').update(values).eq('id',run.id).eq('organization_id',input.organizationId);
    if (err) throw new Error('SYNC_PROVENANCE_FAILED');
  };
  try {
    const operation = new SyncSalesSourceUseCase(source,new TrustedSalesRepository(client));
    if (!input.tabId) throw new Error('SOURCE_TAB_ID_REQUIRED');
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

export function syncResult(run: SalesSyncCheckpoint) {
  return {id:run.id,status:run.status,continuationVersion:run.continuation_version,
    continuationRequired:!run.source_exhausted||run.pending_tab_ids.length>0,
    pages_fetched:run.pages_fetched,records_fetched:run.records_fetched,created:run.created,
    updated:run.updated,unchanged:run.unchanged,rejected:run.rejected,unmapped_products:run.unmapped_products};
}
export async function continueSalesSync(client: SupabaseClient,input:{organizationId:string;runId:string;version:number}) {
  const {data:run,error}=await client.from('sales_sync_runs').select('*').eq('organization_id',input.organizationId).eq('id',input.runId).single();
  if(error||!run||run.mode==='WEBHOOK')throw new Error('SYNC_NOT_FOUND');
  if(!run.checkpoint_enabled)throw new Error('SYNC_RESTART_REQUIRED');
  const config=await mapping(client,input.organizationId,run.external_location_id);
  if(config.operational_unit_id!==run.operational_unit_id)throw new Error('SYNC_SCOPE_CHANGED');
  const {data:claim,error:claimError}=await client.rpc('sales_claim_sync_slice',{
    p_org:input.organizationId,p_run:input.runId,p_version:input.version});
  if(claimError||!claim?.run)throw new Error('SYNC_CLAIM_FAILED');
  if(!claim.claimed)return {...syncResult(claim.run),retryAfterMs:claim.run.status==='PROCESSING'?5000:0};
  const checkpoint=new SupabaseSalesSyncCheckpoint(client,input.organizationId,claim.run.slice_lease,claim.run);
  try {
    const source=new LastAppAdapter({token:process.env.LAST_APP_TOKEN??'',timeoutMs:4000,maxAttempts:2,
      rateLimiter:new LastAppRateLimiter(new SupabaseLastAppRateBudget(client)),deadline:performance.now()+30000});
    const {data:products,error:productError}=await client.from('sales_product_mappings').select('*')
      .eq('organization_id',input.organizationId).eq('external_location_id',run.external_location_id);
    if(productError)throw new Error('MAPPING_READ_FAILED');
    const productMap=new Map<string,ProductMapping>((products??[]).map(p=>[p.external_product_id,{status:p.status,productId:p.product_id}]));
    await new SyncSalesSourceUseCase(source,new TrustedSalesRepository(client)).executeSlice(
      {locationId:run.external_location_id,startDate:run.requested_start,endDate:run.requested_end},
      {organizationId:input.organizationId,operationalUnitId:run.operational_unit_id,externalLocationId:run.external_location_id,
        currency:config.currency,syncRunId:run.id,observedAt:new Date().toISOString(),products:productMap},checkpoint);
    return syncResult(await checkpoint.finish());
  } catch {
    // A lost process leaves the lease reclaimable; an ordinary failure keeps the exact checkpoint.
    return syncResult(await checkpoint.finish(true));
  }
}
