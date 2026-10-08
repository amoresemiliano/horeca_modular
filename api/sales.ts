import { authorize, serverClient, synchronize, continueSalesSync, mapping, Request, Response } from '../server/salesRuntime.js';
import { IngestSalesCsvUseCase } from '../src/application/sales/useCases/IngestSalesCsvUseCase.js';
import { TrustedSalesRepository } from '../src/infrastructure/sales/repositories/TrustedSalesRepository.js';
import { SupabaseSalesImportRepository } from '../src/infrastructure/sales/repositories/SupabaseSalesImportRepository.js';

export default async function handler(request: Request, response: Response) {
  if (request.method !== 'POST') { response.status(405).json({error:'METHOD_NOT_ALLOWED'}); return; }
  const body = request.body ?? {};
  const org = typeof body.organizationId === 'string' ? body.organizationId : '';
  const action = body.action;
  try {
    await authorize(request,org,action==='csv'?'sales.import.process':action==='health'?'sales.view':'integrations.sync.trigger');
    const client = serverClient();
    if (action === 'csv') {
      await authorize(request,org,'sales.import.upload');
      if (typeof body.csvContent !== 'string' || body.csvContent.length > 2_000_000 || typeof body.filename !== 'string') throw new Error('INVALID_INPUT');
      const result = await new IngestSalesCsvUseCase(new TrustedSalesRepository(client),new SupabaseSalesImportRepository(client))
        .execute({organizationId:org,csvContent:body.csvContent,filename:body.filename});
      response.status(200).json(result); return;
    }
    if (action === 'health') {
      const [configs,runs,events,units,lastReceived,lastProcessed,failed,lastSuccess] = await Promise.all([
        client.from('sales_location_mappings').select('external_location_id,operational_unit_id').eq('organization_id',org).eq('is_active',true),
        client.from('sales_sync_runs').select('id,mode,status,started_at,completed_at,pages_fetched,records_fetched,created,updated,unchanged,rejected,unmapped_products,error_summary,continuation_version,checkpoint_enabled').eq('organization_id',org).order('started_at',{ascending:false}).limit(10),
        client.from('sales_lastapp_inbox').select('id,status,received_at,processed_at,error_summary').eq('organization_id',org).neq('status','PROCESSED').order('received_at').limit(100),
        client.from('eco_operational_units').select('id,name').eq('organization_id',org).eq('is_active',true),
        client.from('sales_lastapp_inbox').select('received_at').eq('organization_id',org).order('received_at',{ascending:false}).limit(1),
        client.from('sales_lastapp_inbox').select('processed_at').eq('organization_id',org).eq('status','PROCESSED').order('processed_at',{ascending:false}).limit(1),
        client.from('sales_lastapp_inbox').select('id',{count:'exact',head:true}).eq('organization_id',org).eq('status','FAILED'),
        client.from('sales_sync_runs').select('completed_at').eq('organization_id',org).eq('status','COMPLETED').neq('mode','WEBHOOK').order('completed_at',{ascending:false}).limit(1),
      ]);
      if ([configs,runs,events,units,lastReceived,lastProcessed,failed,lastSuccess].some(result=>result.error)) throw new Error('HEALTH_UNAVAILABLE');
      response.status(200).json({configured:!!process.env.LAST_APP_TOKEN && !!configs.data?.length,
        locations:configs.data?.map(c=>({...c,name:units.data?.find(u=>u.id===c.operational_unit_id)?.name??'Local configurado'})),
        runs:runs.data,pendingEvents:events.data,lastReceivedWebhook:lastReceived.data?.[0]?.received_at??null,
        lastProcessedWebhook:lastProcessed.data?.[0]?.processed_at??null,failedEventCount:failed.count??0,
        lastSuccessfulReconciliation:lastSuccess.data?.[0]?.completed_at??null}); return;
    }
    if (action === 'continue') {
      if(typeof body.runId!=='string'||!Number.isSafeInteger(body.version)||Number(body.version)<0||
        ['externalLocationId','startDate','endDate','mode','offset'].some(key=>key in body))throw new Error('INVALID_INPUT');
      response.status(200).json(await continueSalesSync(client,{organizationId:org,runId:body.runId,version:Number(body.version)}));return;
    }
    if (action === 'replay') {
      if (typeof body.eventId !== 'string') throw new Error('INVALID_INPUT');
      const {data,error} = await client.rpc('sales_claim_lastapp_event',{p_org:org,p_id:body.eventId});
      if (error) throw new Error('EVENT_CLAIM_FAILED');
      const event = data?.[0];
      if (!event) { response.status(200).json({status:'UNCHANGED'}); return; }
      try {
        const now = new Date().toISOString();
        const result = await synchronize(client,{organizationId:org,externalLocationId:event.external_location_id,
          startDate:now,endDate:now,mode:'WEBHOOK',tabId:event.external_tab_id,eventId:event.source_event_id});
        if (result.rejected) throw new Error('EVENT_SOURCE_REJECTED');
        const {error:completeError} = await client.from('sales_lastapp_inbox').update({status:'PROCESSED',processed_at:new Date().toISOString(),lease_until:null,error_summary:null}).eq('id',event.id).eq('attempts',event.attempts);
        if (completeError) throw new Error('EVENT_FINALIZATION_FAILED');
        response.status(200).json(result); return;
      } catch {
        await client.from('sales_lastapp_inbox').update({status:'FAILED',lease_until:null,error_summary:'EVENT_REFRESH_FAILED'}).eq('id',event.id).eq('attempts',event.attempts);
        throw new Error('EVENT_REFRESH_FAILED');
      }
    }
    if (action !== 'sync' || typeof body.externalLocationId !== 'string' || typeof body.startDate !== 'string' || typeof body.endDate !== 'string') throw new Error('INVALID_INPUT');
    const duration = Date.parse(body.endDate)-Date.parse(body.startDate);
    if (!Number.isFinite(duration) || duration<=0 || duration>31*86400000) throw new Error('INVALID_INPUT');
    await mapping(client,org,body.externalLocationId);
    response.status(200).json(await synchronize(client,{organizationId:org,externalLocationId:body.externalLocationId,
      startDate:body.startDate,endDate:body.endDate,mode:body.mode==='BACKFILL'?'BACKFILL':'RECONCILIATION'}));
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const safe = ['DENIED','LAST_APP_NOT_CONFIGURED','SERVER_NOT_CONFIGURED','LOCATION_NOT_MAPPED','INVALID_INPUT','HEALTH_UNAVAILABLE','EVENT_REFRESH_FAILED','SYNC_NOT_FOUND','SYNC_SCOPE_CHANGED','SYNC_RESTART_REQUIRED'];
    response.status(message==='DENIED'?403:400).json({error:safe.includes(message)?message:'SALES_OPERATION_FAILED'});
  }
}
