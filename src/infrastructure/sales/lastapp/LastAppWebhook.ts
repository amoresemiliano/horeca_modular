import { createHash, timingSafeEqual } from 'node:crypto';

export function validateLastAppWebhook(authorization: unknown, token: string, body: Record<string,unknown>, locationHeader: unknown) {
  if (!token || typeof authorization !== 'string' || !timingSafeEqual(
    createHash('sha256').update(authorization).digest(),createHash('sha256').update(`Bearer ${token}`).digest())) throw new Error('DENIED');
  const data = body.data as Record<string,unknown> | undefined;
  if (!data || typeof body.id !== 'string' || !body.id || body.id.length>200 ||
    !['tab:created','tab:closed','tab:cancelled','tab:updated'].includes(String(body.type)) ||
    typeof body.created !== 'string' || !Number.isFinite(Date.parse(body.created)) ||
    typeof data.id !== 'string' || typeof data.locationId !== 'string' ||
    (locationHeader != null && locationHeader !== data.locationId)) throw new Error('INVALID_EVENT');
  const event = {source_event_id:body.id,event_type:String(body.type),external_tab_id:data.id,
    external_location_id:data.locationId,source_created_at:body.created};
  return {...event,payload_hash:createHash('sha256').update(JSON.stringify(event)).digest('hex')};
}
