import { useState } from 'react';
import type { ProductionCommandType, WasteDeclaration } from '../domain/contracts';
import type { BatchDetail as Detail, OwnerContext, ProductionAccess } from '../application/readModels';
import { batchSnapshot, displayQuantity, editableBatch, statusLabels, wasteLabels } from '../application/workflow';
import { decimalAtoms } from '../domain/quantities';
import { productionMessage } from '../application/errors';

export function BatchDetail({detail,owners,access,busy,blocked=false,onBack,onEdit,onCommand}: {
  detail:Detail;owners:OwnerContext;access:ProductionAccess;busy:boolean;blocked?:boolean;onBack:()=>void;onEdit:(correction:boolean)=>void;
  onCommand:(command:ProductionCommandType,body:Record<string,unknown>)=>Promise<void>;
}) {
  const [action,setAction]=useState<'confirm'|'reverse'|'cancel'|null>(null),[reason,setReason]=useState(''),[reviewed,setReviewed]=useState(false),[error,setError]=useState('');
  const batch=detail.batch,snapshot=batchSnapshot(batch),active=['CONFIRMED','CORRECTED'].includes(batch.status);
  const locked=busy||blocked;
  const productName=(id:string)=>owners.products.find(p=>p.id===id)?.label || id;
  const locationName=(id:string)=>owners.locations.find(p=>p.id===id)?.label || id;
  return <section className="prod-panel" aria-labelledby="batch-detail-title">
    <button className="prod-link" onClick={onBack} disabled={locked}>← Volver a Producción</button>
    <h2 id="batch-detail-title">Detalle del lote</h2><span className={`prod-badge prod-${batch.status.toLowerCase()}`}>{statusLabels[batch.status]}</span>
    <dl className="prod-facts"><dt>Lote</dt><dd>{batch.id}</dd><dt>Fecha efectiva</dt><dd>{batch.effective_date}</dd><dt>Registrado</dt><dd>{formatTime(batch.recorded_at)}</dd>
      <dt>Perfil que registró</dt><dd>{batch.actor_profile_id}</dd><dt>Unidad operativa</dt><dd>{batch.operational_unit_id}</dd><dt>Revisión actual</dt><dd>{batch.revision}</dd>
      <dt>Modo</dt><dd>{snapshot.mode==='MANUAL_OUTPUT'?'Salida manual · sin trazabilidad de ingredientes implícita':'Referencia de receta'}</dd><dt>Notas</dt><dd>{snapshot.notes || 'Sin notas'}</dd></dl>
    {batch.status!=='DRAFT' && <p className="prod-notice">Historial inmutable. Las correcciones crean otra revisión; la reversión conserva los hechos originales.</p>}
    <h3>Salida declarada</h3>{!snapshot.outputs.length&&<p>Esta revisión no declara salida. Consulta la ejecución anterior en el historial.</p>}
    {snapshot.outputs.map(o=><article className="prod-card" key={o.line_id}><h4>{productName(o.product_id)}</h4>
      <p className="prod-output">{displayQuantity(o.quantity)} {o.unit}</p>
      <p>{o.mode==='PACKAGED' ? `${o.unit_count} envases × ${displayQuantity(String(o.conversion_snapshot.net_quantity || ''))} ${o.unit}` : 'Cantidad suelta aprobada'}</p>
      {o.package_id&&<small>Envase: {owners.packages.find(p=>p.id===o.package_id&&p.version===o.package_version)?.label || o.package_id} · versión {o.package_version}</small>}
      <p>Destino: {locationName(o.destination_location_id)}</p></article>)}
    <h3>Consumos reales declarados</h3>{!snapshot.consumptions.length ? <p>Esta revisión no declara consumos reales. No se deducen ingredientes de forma automática.</p> : snapshot.consumptions.map(c=><p key={c.line_id}>{productName(c.product_id)} · {displayQuantity(c.quantity)} {c.unit} · origen {locationName(c.source_location_id)}</p>)}
    <h3>Integración con Inventario</h3>
    <p className="prod-unavailable">{detail.outbox.length ? 'Pendiente de integración con Inventario. La producción confirmada no representa stock disponible.' : 'Sin envío a Inventario. La entrega de eventos todavía no está disponible.'}</p>
    {detail.outbox.map(e=><details key={e.event_id}><summary>{eventLabel(e.event_type)} · Pendiente</summary><p>Evento {e.event_id} · revisión {e.batch_revision} · {formatTime(e.occurred_at)}</p></details>)}
    <h3>Historial de ejecuciones</h3>{!detail.executions.length&&<p>El borrador todavía no tiene una ejecución confirmada.</p>}
    <ol className="prod-chain">{detail.executions.map(e=><li key={e.id}><strong>Revisión {e.batch_revision} · {e.action==='CONFIRM'?'Confirmación':e.action==='CORRECT'?'Corrección':'Reversión'}</strong>
      <p>{formatTime(e.recorded_at)} · perfil {e.actor_profile_id}</p>{e.reason&&<p>Motivo: {e.reason}</p>}
      {e.supersedes_execution_id&&<p>Sustituye la ejecución {e.supersedes_execution_id}</p>}
      {e.snapshot.outputs.map(o=><p key={o.line_id}>{productName(o.product_id)} · {displayQuantity(o.quantity)} {o.unit}</p>)}
      {e.snapshot.consumptions.length>0&&<details><summary>Consumos declarados de esta ejecución</summary>{e.snapshot.consumptions.map(c=><p key={c.line_id}>{productName(c.product_id)} · {displayQuantity(c.quantity)} {c.unit} · origen {locationName(c.source_location_id)}</p>)}</details>}
      </li>)}</ol>
    {detail.truncated&&<p role="status">Detalle limitado a las últimas 50 ejecuciones, 100 mermas y 100 eventos. Puede haber hechos anteriores; no es un historial completo.</p>}
    {error&&<p role="alert" className="prod-error">{error}</p>}
    <div className="prod-actions">
      {batch.status==='DRAFT'&&access.log&&editableBatch(batch)&&<button className="prod-secondary" disabled={locked||!owners.available} onClick={()=>onEdit(false)}>Editar borrador</button>}
      {batch.status==='DRAFT'&&access.confirm&&<button disabled={locked||!owners.available||!editableBatch(batch)} onClick={()=>{setAction('confirm');setReviewed(false);}}>Revisar confirmación</button>}
      {batch.status==='DRAFT'&&access.log&&<button className="prod-secondary" disabled={locked} onClick={()=>{setAction('cancel');setReason('');}}>Cancelar borrador</button>}
      {active&&access.correct&&editableBatch(batch)&&<button className="prod-secondary" disabled={locked||!owners.available} onClick={()=>onEdit(true)}>Corregir producción</button>}
      {active&&access.correct&&<button className="prod-secondary" disabled={locked} onClick={()=>{setAction('reverse');setReason('');}}>Revertir producción</button>}
    </div>
    {!owners.available&&(batch.status==='DRAFT'||active)&&<p>Editar, confirmar o corregir cantidades requiere catálogo y destinos disponibles.</p>}
    {!editableBatch(batch)&&batch.status!=='REVERSED'&&<p>Los lotes con varios productos o referencia de receta se muestran en consulta. Esta primera entrada operativa edita una salida manual por lote.</p>}
    {action&&<section className="prod-review"><h3>{action==='confirm'?'Confirmar producción':action==='reverse'?'Revertir sin borrar historial':'Cancelar borrador'}</h3>
      {action==='confirm'?<><p>Revisa fecha, producto, envases, conversión, cantidad y destino mostrados arriba. Se guardará una ejecución inmutable; el envío a Inventario quedará pendiente.</p><label className="prod-check"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>He revisado la producción declarada</label></>
        : <><p>{action==='reverse'?'Se añadirá una reversión. La compensación con Inventario quedará pendiente; no se elimina la producción anterior.':'El borrador se conservará como cancelado y no generará salida.'}</p><label>Motivo<textarea required value={reason} maxLength={2000} onChange={e=>setReason(e.target.value)}/></label></>}
      <div className="prod-actions"><button disabled={locked||(action==='confirm'?!reviewed:!reason.trim())} onClick={async()=>{try{await onCommand(action==='confirm'?'confirm_batch':action==='reverse'?'reverse_batch':'cancel_draft',action==='confirm'?{}:{reason:reason.trim()});setAction(null);}catch(e){setError(productionMessage(e));}}}>{busy?'Enviando…':action==='confirm'?'Confirmar producción':action==='reverse'?'Confirmar reversión':'Confirmar cancelación'}</button><button className="prod-secondary" disabled={locked} onClick={()=>setAction(null)}>Volver</button></div>
    </section>}
    <WastePanel detail={detail} owners={owners} access={access} busy={locked} onCommand={onCommand}/>
  </section>;
}
function WastePanel({detail,owners,access,busy,onCommand}:{detail:Detail;owners:OwnerContext;access:ProductionAccess;busy:boolean;onCommand:(command:ProductionCommandType,body:Record<string,unknown>)=>Promise<void>}) {
  const [open,setOpen]=useState(false),[classification,setClassification]=useState<WasteDeclaration['classification']>('OUTPUT_LOSS');
  const [related,setRelated]=useState(''),[product,setProduct]=useState(''),[location,setLocation]=useState(''),[quantity,setQuantity]=useState(''),[reason,setReason]=useState(''),[error,setError]=useState('');
  const [wasteId,setWasteId]=useState(()=>crypto.randomUUID()),[confirming,setConfirming]=useState<string|null>(null);
  const snapshot=batchSnapshot(detail.batch),active=['CONFIRMED','CORRECTED'].includes(detail.batch.status);
  const lines=classification==='PROCESS_ALREADY_CONSUMED'?snapshot.consumptions:snapshot.outputs;
  const line=lines.find(l=>l.line_id===related);
  const productId=classification==='STOCK_REMOVAL'?product:line?.product_id;
  const unit=classification==='STOCK_REMOVAL'?owners.products.find(p=>p.id===product)?.base_unit:line?.unit;
  return <section aria-labelledby="waste-title"><h3 id="waste-title">Mermas</h3>
    {detail.wastes.length===0&&<p>No hay mermas declaradas.</p>}
    {detail.wastes.map(w=><article className="prod-card" key={w.id}><strong>{wasteLabels[w.classification]}</strong><p>{displayQuantity(w.quantity)} {w.unit} · {w.reason}</p>
      <span className="prod-badge">{w.confirmed?'Merma confirmada':'Merma registrada · sin confirmar'}</span>
      {w.execution_id!==detail.batch.current_execution_id&&<p>Ejecución sustituida: se conserva como historial.</p>}
      {!w.confirmed&&active&&w.execution_id===detail.batch.current_execution_id&&access.wasteConfirm&&<button className="prod-secondary" disabled={busy} onClick={()=>setConfirming(w.id)}>Revisar merma</button>}
      {confirming===w.id&&<div className="prod-review"><p>{w.classification==='PROCESS_ALREADY_CONSUMED'?'Es pérdida de material ya consumido: no solicita otra retirada de stock.':'La merma confirmada solicitará una retirada, pendiente de integración con Inventario.'}</p>
        <button disabled={busy} onClick={async()=>{try{await onCommand('confirm_waste',{waste_id:w.id});setConfirming(null);}catch(e){setError(productionMessage(e));}}}>Confirmar merma</button><button className="prod-secondary" disabled={busy} onClick={()=>setConfirming(null)}>Volver</button></div>}
    </article>)}
    {active&&access.wasteLog&&<button className="prod-secondary" disabled={busy||!owners.available} onClick={()=>setOpen(true)}>Registrar merma</button>}
    {error&&<p role="alert" className="prod-error">{error}</p>}
    {open&&<form className="prod-review" onSubmit={async e=>{e.preventDefault();try{
      if(!productId||!unit||!reason.trim()||decimalAtoms(quantity)<=0n)throw Error('INVALID_EXECUTION');
      const locationId=classification==='STOCK_REMOVAL'?location:classification==='OUTPUT_LOSS'?(line as typeof snapshot.outputs[number])?.destination_location_id:undefined;
      if(classification!=='PROCESS_ALREADY_CONSUMED'&&!locationId)throw Error('REFERENCE_DENIED');
      await onCommand('log_waste',{waste_id:wasteId,product_id:productId,quantity,unit,classification,reason:reason.trim(),...(classification!=='STOCK_REMOVAL'?{related_line_id:related}:{}),...(locationId?{location_id:locationId}:{})});
      setOpen(false);setWasteId(crypto.randomUUID());setQuantity('');setReason('');
    }catch(err){setError(productionMessage(err));}}}><h4>Registrar merma sin confirmar</h4>
      <fieldset disabled={busy} className="prod-fields"><label>Tipo de merma<select aria-label="Tipo de merma" value={classification} onChange={e=>{setClassification(e.target.value as WasteDeclaration['classification']);setRelated('');}}>{Object.entries(wasteLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        {classification==='STOCK_REMOVAL'?<><label>Material<select aria-label="Material" required value={product} onChange={e=>setProduct(e.target.value)}><option value="">Seleccionar material</option>{owners.products.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label><label>Origen de stock<select aria-label="Origen de stock" required value={location} onChange={e=>setLocation(e.target.value)}><option value="">Seleccionar origen</option>{owners.locations.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></label></>
          : <label>{classification==='PROCESS_ALREADY_CONSUMED'?'Consumo real declarado':'Salida declarada'}<select aria-label={classification==='PROCESS_ALREADY_CONSUMED'?'Consumo real declarado':'Salida declarada'} required value={related} onChange={e=>setRelated(e.target.value)}><option value="">Seleccionar declaración</option>{lines.map(l=><option key={l.line_id} value={l.line_id}>{owners.products.find(p=>p.id===l.product_id)?.label || l.product_id} · {displayQuantity(l.quantity)} {l.unit}</option>)}</select></label>}
        <label>Cantidad de merma {unit&&`(${unit})`}<input required inputMode="decimal" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label><label className="prod-wide">Motivo de merma<textarea required maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
      </fieldset><p>{classification==='PROCESS_ALREADY_CONSUMED'?'No solicita una segunda retirada del material consumido.':'Registrar no confirma la merma ni modifica el stock.'}</p>
      <div className="prod-actions"><button disabled={busy}>Guardar merma sin confirmar</button><button type="button" className="prod-secondary" disabled={busy} onClick={()=>setOpen(false)}>Cerrar</button></div>
    </form>}
  </section>;
}
export function formatTime(value:string) { return new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',dateStyle:'short',timeStyle:'short'}).format(new Date(value)); }
function eventLabel(type:string) { return ({OUTPUT_CONFIRMED:'Salida confirmada',CONSUMPTION_DECLARED:'Consumo real declarado',STOCK_WASTE_CONFIRMED:'Merma confirmada',EXECUTION_COMPENSATION_REQUIRED:'Compensación de ejecución anterior'} as Record<string,string>)[type] || 'Evento de producción'; }
