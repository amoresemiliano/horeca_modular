import { useEffect, useState } from 'react';
import { salesOperation } from '../../infrastructure/sales/serverSalesClient';

export function SalesSyncPanel({ organizationId, onSynced }) {
  const [health,setHealth] = useState(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [location,setLocation] = useState('');
  const [start,setStart] = useState('');
  const [end,setEnd] = useState('');
  useEffect(() => {
    let cancelled=false;
    setHealth(null); setLocation(''); setError('');
    salesOperation({action:'health',organizationId}).then(result => {if(!cancelled)setHealth(result);})
      .catch(() => {if(!cancelled)setError('Sincronización no disponible. Falta configuración o autorización.');});
    return () => {cancelled=true;};
  },[organizationId]);
  const run = async (action, eventId) => {
    setBusy(true); setError('');
    try {
      await salesOperation({action,organizationId,externalLocationId:location,
        startDate:start ? new Date(start).toISOString():null,endDate:end ? new Date(end).toISOString():null,eventId});
      setHealth(await salesOperation({action:'health',organizationId}));
      await onSynced();
    } catch (err) {setError(err.message);}
    finally {setBusy(false);}
  };
  const latest=health?.runs?.[0];
  return <section className="bg-white border rounded-xl p-4 mb-4 space-y-3">
    <h3 className="font-bold">Sincronizar Last.app</h3>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {health && !health.configured && <p>Last.app aún no está configurado para esta organización.</p>}
    {health?.configured && <>
      <div className="flex flex-wrap gap-3 items-end">
        <label>Local<select aria-label="Local Last.app" value={location} onChange={e=>setLocation(e.target.value)} className="block border p-2">
          <option value="">Selecciona un local</option>
          {health.locations.map(l=><option key={l.external_location_id} value={l.external_location_id}>{l.name}</option>)}
        </select></label>
        <label>Desde<input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} className="block border p-2"/></label>
        <label>Hasta<input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)} className="block border p-2"/></label>
        <button type="button" disabled={busy||!location||!start||!end} onClick={()=>run('sync')} className="border rounded p-2 disabled:opacity-50">{busy?'Sincronizando…':'Sincronizar'}</button>
      </div>
      <p className="text-sm">Selecciona un intervalo de hasta 31 días. Los datos ya importados siguen disponibles durante una interrupción de Last.app.</p>
      <p>Última sincronización correcta: {health.lastSuccessfulReconciliation ? new Date(health.lastSuccessfulReconciliation).toLocaleString('es-ES'):'Pendiente'}</p>
      <p>Eventos fallidos: {health.failedEventCount ?? 0} · Último evento recibido: {health.lastReceivedWebhook ? new Date(health.lastReceivedWebhook).toLocaleString('es-ES'):'Pendiente'}</p>
      {latest && <p>Estado: {latest.status} · Creadas: {latest.created} · Actualizadas: {latest.updated} · Sin cambios: {latest.unchanged} · Rechazadas: {latest.rejected} · Productos sin mapear: {latest.unmapped_products}</p>}
      {health.pendingEvents?.length>0 && <div><p>Eventos pendientes: {health.pendingEvents.length}</p>
        <button type="button" disabled={busy} onClick={()=>run('replay',health.pendingEvents[0].id)} className="border rounded p-2">Procesar el evento pendiente más antiguo</button></div>}
    </>}
  </section>;
}
