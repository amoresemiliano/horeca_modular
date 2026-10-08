import { createHash, timingSafeEqual } from 'node:crypto';

export const LAST_APP_INTEGRATOR_ID = 'ae7fb926-7f70-4bec-a9b7-1003121a4675';
export interface LocationLifecycleReceipt {
  source_event_id: string; event_type: 'location:integrated' | 'location:desintegrated';
  source_created_at: string; external_location_id: string; payload_hash: string;
  external_organization_id: string | null; external_integration_id: string | null;
  external_integrator_id: string | null; location_name: string | null; organization_name: string | null;
}
function record(value: unknown): value is Record<string,unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function uuid(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
}
function utcTimestamp(value: unknown): value is string {
  if(typeof value !== 'string' || value.length>64 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value))return false;
  const parsed=new Date(value);return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,19)===value.slice(0,19);
}
function optionalId(value: unknown): string | null {
  if(value===undefined)return null;if(!uuid(value))throw new Error('INVALID_EVENT');return value.toLowerCase();
}
function optionalName(value: unknown): string | null {
  if(value===undefined)return null;
  if(typeof value!=='string'||!value.trim()||value.length>300)throw new Error('INVALID_EVENT');return value;
}
export function validateLastAppWebhook(authorization: unknown, token: string, input: unknown, locationHeader: unknown, organizationHeader?: unknown) {
  if (!token || typeof authorization !== 'string' || !timingSafeEqual(
    createHash('sha256').update(authorization).digest(),createHash('sha256').update(`Bearer ${token}`).digest())) throw new Error('DENIED');
  if(!record(input))throw new Error('INVALID_EVENT');
  // Schema/example use the direct event; official prose explicitly describes {event: ...}.
  // Reject mixed fields, sibling payloads and recursively wrapped envelopes.
  const body='event' in input ? (Object.keys(input).length===1 && record(input.event) ? input.event : null) : input;
  if(!body || 'event' in body)throw new Error('INVALID_EVENT');
  const data = body.data;
  if(record(data) && ['location:integrated','location:desintegrated'].includes(String(body.type))){
    if(typeof body.id!=='string'||!body.id.trim()||body.id!==body.id.trim()||body.id.length>200||
      !utcTimestamp(body.created)||!uuid(data.locationId))throw new Error('INVALID_EVENT');
    const org=optionalId(data.organizationId),integrator=optionalId(data.integratorId);
    if((locationHeader!=null && (!uuid(locationHeader)||locationHeader.toLowerCase()!==data.locationId.toLowerCase()))||
      (organizationHeader!=null && (!uuid(organizationHeader)||organizationHeader.toLowerCase()!==org))||
      (integrator!==null && integrator!==LAST_APP_INTEGRATOR_ID))throw new Error('INVALID_EVENT');
    const event:Omit<LocationLifecycleReceipt,'payload_hash'>={source_event_id:body.id,event_type:body.type as LocationLifecycleReceipt['event_type'],
      source_created_at:new Date(body.created).toISOString(),external_location_id:data.locationId.toLowerCase(),
      external_organization_id:org,external_integration_id:optionalId(data.integrationId),external_integrator_id:integrator,
      location_name:optionalName(data.locationName),organization_name:optionalName(data.organizationName)};
    return {...event,payload_hash:createHash('sha256').update(JSON.stringify(event)).digest('hex')};
  }
  if (!record(data) || typeof body.id !== 'string' || !body.id || body.id.length>200 ||
    !['tab:created','tab:closed','tab:cancelled','tab:updated'].includes(String(body.type)) ||
    typeof body.created !== 'string' || !Number.isFinite(Date.parse(body.created)) ||
    typeof data.id !== 'string' || typeof data.locationId !== 'string' ||
    (locationHeader != null && locationHeader !== data.locationId)) throw new Error('INVALID_EVENT');
  const event = {source_event_id:body.id,event_type:String(body.type),external_tab_id:data.id,
    external_location_id:data.locationId,source_created_at:body.created};
  return {...event,payload_hash:createHash('sha256').update(JSON.stringify(event)).digest('hex')};
}
