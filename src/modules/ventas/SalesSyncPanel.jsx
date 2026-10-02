import { useEffect, useState, useRef } from 'react';
import { salesOperation } from '../../infrastructure/sales/serverSalesClient';
import { continueSalesSyncUntilSettled } from '../../application/sales/services/ContinueSalesSync';

export function SalesSyncPanel({ organizationId, onSynced }) {
  const [health,setHealth] = useState(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [location,setLocation] = useState('');
  const [start,setStart] = useState('');
  const [end,setEnd] = useState('');
  const [progress,setProgress] = useState(null);
  const epoch=useRef(0);
  useEffect(() => {
    const lifecycle=epoch;
    lifecycle.current++;
    let cancelled=false;
    setHealth(null); setLocation(''); setError('');
    salesOperation({action:'health',organizationId}).then(result => {if(!cancelled)setHealth(result);})
      .catch(() => {if(!cancelled)setError('Sincronización no disponible. Falta configuración o autorización.');});
    return () => {cancelled=true;lifecycle.current++;};
  },[organizationId]);
  const run = async (action, eventId) => {
    const generation=epoch.current;
    const active=()=>epoch.current===generation;
    setBusy(true); setError('');
    try {
      const initial=await salesOperation(action==='continue'?{action,organizationId,runId:eventId.id,version:eventId.continuation_version}:
        {action,organizationId,externalLocationId:location,
          startDate:start ? new Date(start).toISOString():null,endDate:end ? new Date(end).toISOString():null,eventId});
      const result=action==='replay'?initial:await continueSalesSyncUntilSettled(initial,salesOperation,organizationId,setProgress,active);
      if(!active())return;
      if(result.status==='FAILED')setError('La sincronización se ha interrumpido. Puedes reanudarla desde el progreso guardado.');
      setHealth(await salesOperation({action:'health',organizationId}));
      await onSynced();
    } catch (err) {
      if(active()) {
        setError(err.message);
        // Recover the server-owned run ID even if the start/continue response was lost.
        try {const updated=await salesOperation({action:'health',organizationId});if(active())setHealth(updated);} catch { /* existing error remains visible */ }
      }
    }
    finally {if(active())setBusy(false);}
  };
  const latest=health?.runs?.[0];
  const resumable=health?.runs?.find(r=>r.checkpoint_enabled&&r.mode!=='WEBHOOK'&&['CONTINUABLE','FAILED','PROCESSING'].includes(r.status));
  return <section className="bg-white border rounded-xl p-4 mb-4 space-y-3">
    <h3 className="font-bold">Sincronizar Last.app</h3>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {progress && <p role="status">{busy?'Continuando':progress.status==='COMPLETED'?'Completada':progress.status==='PARTIAL'?'Completada con rechazos':'Pendiente'} · Procesadas {progress.records_fetched}</p>}
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
      {resumable && <button type="button" disabled={busy} onClick={()=>run('continue',resumable)} className="border rounded p-2">Reanudar sincronización pendiente</button>}
      <p>Última sincronización correcta: {health.lastSuccessfulReconciliation ? new Date(health.lastSuccessfulReconciliation).toLocaleString('es-ES'):'Pendiente'}</p>
      <p>Eventos fallidos: {health.failedEventCount ?? 0} · Último evento recibido: {health.lastReceivedWebhook ? new Date(health.lastReceivedWebhook).toLocaleString('es-ES'):'Pendiente'}</p>
      {latest && <p>Estado: {latest.status} · Creadas: {latest.created} · Actualizadas: {latest.updated} · Sin cambios: {latest.unchanged} · Rechazadas: {latest.rejected} · Productos sin mapear: {latest.unmapped_products}</p>}
      {health.pendingEvents?.length>0 && <div><p>Eventos pendientes: {health.pendingEvents.length}</p>
        <button type="button" disabled={busy} onClick={()=>run('replay',health.pendingEvents[0].id)} className="border rounded p-2">Procesar el evento pendiente más antiguo</button></div>}
    </>}
  </section>;
}
