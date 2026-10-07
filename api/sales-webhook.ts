import { serverClient, Request, Response } from '../server/salesRuntime';
import { validateLastAppWebhook } from '../src/infrastructure/sales/lastapp/LastAppWebhook';

/** Durable receipt only. A trusted worker/manual replay refreshes authoritative Tab state. */
export default async function handler(request: Request, response: Response) {
  if (request.method !== 'POST') {response.status(405).end();return;}
  try {
    const event = validateLastAppWebhook(request.headers.authorization,process.env.LAST_APP_TOKEN??'',request.body??{},request.headers.locationid);
    const client = serverClient();
    const {data:config,error} = await client.from('sales_location_mappings').select('organization_id')
      .eq('external_location_id',event.external_location_id).eq('is_active',true).single();
    if (error || !config) throw new Error('LOCATION_NOT_MAPPED');
    const {error:receiptError} = await client.from('sales_lastapp_inbox').upsert({...event,organization_id:config.organization_id},
      {onConflict:'organization_id,source_event_id',ignoreDuplicates:true});
    if (receiptError) throw new Error('RECEIPT_FAILED');
    response.status(200).end();
  } catch (error) {
    response.status(error instanceof Error && error.message==='DENIED'?401:503).end();
  }
}
