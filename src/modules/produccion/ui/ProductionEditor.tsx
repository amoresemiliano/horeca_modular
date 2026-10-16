import { useState } from 'react';
import type { ExecutionDeclaration } from '../domain/contracts';
import type { BatchRecord, OwnerContext } from '../application/readModels';
import { businessToday, displayQuantity, draftDeclaration, fieldsFromBatch, previewDraft, type DraftFields } from '../application/workflow';
import { productionMessage } from '../application/errors';

export function ProductionEditor({ owners, batch, date, correction, busy, blocked=false, onSave, onBack }: {
  owners:OwnerContext; batch?:BatchRecord; date?:string; correction?:boolean; busy:boolean;blocked?:boolean;
  onSave:(declaration:ExecutionDeclaration,reason:string)=>Promise<void>; onBack:()=>void;
}) {
  const [fields,setFields]=useState<DraftFields>(()=>batch ? fieldsFromBatch(batch) : {
    effectiveDate:date || businessToday(),productId:'',packageId:'',locationId:'',count:'',loose:false,quantity:'',shift:'',notes:'',lineId:crypto.randomUUID(),
  });
  const [reason,setReason]=useState(''),[review,setReview]=useState(false),[error,setError]=useState('');
  const product=owners.products.find(p=>p.id===fields.productId);
  const packages=owners.packages.filter(p=>p.product_id===fields.productId);
  let preview:ReturnType<typeof previewDraft> | undefined;
  try { preview=previewDraft(fields,owners); } catch { /* Incomplete entry has no invented conversion. */ }
  const change=(patch:Partial<DraftFields>)=>{setFields(f=>({...f,...patch}));setError('');};
  function declaration() { return draftDeclaration(fields,owners,batch ? { ...batch.draft, outputs:[],consumptions:batch.execution?.snapshot.consumptions || batch.draft.consumptions } : undefined); }
  const productName=product?.label || fields.productId;
  return <section className="prod-panel" aria-labelledby="production-editor-title">
    <button type="button" className="prod-link" onClick={onBack} disabled={busy}>← Volver</button>
    <h2 id="production-editor-title">{correction ? 'Corregir producción' : batch ? 'Editar borrador' : 'Nueva producción'}</h2>
    <p className="prod-notice">Salida manual: declaras el producto terminado. No calcula ingredientes ni acredita su trazabilidad.</p>
    {!owners.available && <p role="status" className="prod-unavailable">El catálogo y los destinos todavía no están disponibles. Puedes revisar el flujo; guardar requiere referencias aprobadas.</p>}
    {correction && batch && <div className="prod-before"><strong>Valores originales · revisión {batch.revision}</strong>
      {batch.execution?.snapshot.outputs.map(o=><p key={o.line_id}>{owners.products.find(p=>p.id===o.product_id)?.label || o.product_id}: {displayQuantity(o.quantity)} {o.unit} · {o.unit_count ?? 'Cantidad suelta'} {o.unit_count ? 'envases' : ''}</p>)}
      <p>La corrección creará una nueva revisión inmutable. La anterior permanece en el historial.</p></div>}
    {error && <p role="alert" className="prod-error">{error}</p>}
    {review ? <div className="prod-review">
      <h3>Revisar {correction ? 'reemplazo' : 'borrador'}</h3>
      <dl className="prod-facts"><dt>Fecha efectiva</dt><dd>{fields.effectiveDate}</dd><dt>Producto</dt><dd>{productName}</dd>
        <dt>Envase</dt><dd>{fields.loose ? 'Cantidad suelta aprobada' : packages.find(p=>p.id===fields.packageId)?.label}</dd>
        <dt>Conversión</dt><dd>{preview?.conversion}</dd><dt>Salida declarada</dt><dd><strong>{preview && displayQuantity(preview.quantity)} {preview?.unit}</strong></dd>
        <dt>Destino</dt><dd>{owners.locations.find(l=>l.id===fields.locationId)?.label}</dd><dt>Modo</dt><dd>Salida manual</dd>
        <dt>Turno</dt><dd>{fields.shift || 'Sin turno'}</dd><dt>Notas</dt><dd>{fields.notes || 'Sin notas'}</dd>
        {correction && <><dt>Motivo</dt><dd>{reason}</dd></>}</dl>
      <p>{correction ? 'La compensación de la ejecución anterior quedará pendiente de integración con Inventario.' : 'Guardar crea un borrador. La confirmación es una acción posterior y requiere otro permiso.'}</p>
      <div className="prod-actions"><button disabled={busy || blocked || !preview} onClick={async()=>{try {await onSave(declaration(),reason.trim());}catch(e){setError(productionMessage(e));}}}>{busy ? 'Guardando…' : correction ? 'Crear revisión corregida' : 'Guardar borrador'}</button>
        <button className="prod-secondary" disabled={busy} onClick={()=>setReview(false)}>Volver a editar</button></div>
    </div> : <form onSubmit={e=>{e.preventDefault();try{declaration();if(correction&&!reason.trim())throw Error('INVALID_EXECUTION');setReview(true);}catch(err){setError(productionMessage(err));}}}>
      <fieldset disabled={busy || blocked} className="prod-fields">
        <label>Fecha efectiva<input type="date" required value={fields.effectiveDate} onChange={e=>change({effectiveDate:e.target.value})}/></label>
        <label>Producto<select aria-label="Producto" required disabled={!owners.available} value={fields.productId} onChange={e=>change({productId:e.target.value,packageId:'',loose:false,quantity:'',count:''})}><option value="">Seleccionar producto</option>{owners.products.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <label>Formato<select disabled={!product} value={fields.loose ? 'LOOSE' : 'PACKAGED'} onChange={e=>change({loose:e.target.value==='LOOSE'})}><option value="PACKAGED">Envases</option>{product?.loose_allowed && <option value="LOOSE">Cantidad suelta aprobada</option>}</select></label>
        {fields.loose ? <label>Cantidad suelta ({product?.base_unit})<input required inputMode="decimal" value={fields.quantity} onChange={e=>change({quantity:e.target.value})}/></label>
          : <><label>Envase<select aria-label="Envase" required disabled={!product} value={fields.packageId} onChange={e=>change({packageId:e.target.value})}><option value="">Seleccionar envase</option>{packages.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
            <label>Número de envases<input required inputMode="numeric" type="number" min="1" step="1" max="2147483647" value={fields.count} onChange={e=>change({count:e.target.value})}/></label></>}
      <div className="prod-quantity prod-wide" role="status" aria-live="polite">{preview ? <><span>{preview.conversion}</span><strong>= {displayQuantity(preview.quantity)} {preview.unit}</strong></> : <><span>Salida normalizada</span><strong>Conversión no disponible</strong><small>Selecciona referencias válidas y una cantidad positiva. Nunca se presupone el peso del envase.</small></>}</div>
        <label>Destino<select aria-label="Destino" required disabled={!owners.available} value={fields.locationId} onChange={e=>change({locationId:e.target.value})}><option value="">Seleccionar destino</option>{owners.locations.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
        <label>Turno (opcional)<select value={fields.shift} onChange={e=>change({shift:e.target.value})}><option value="">Sin turno</option>{['Mañana','Tarde','Noche'].map(t=><option key={t}>{t}</option>)}</select></label>
        <label className="prod-wide">Notas (opcional)<textarea maxLength={2000} value={fields.notes} onChange={e=>change({notes:e.target.value})}/></label>
        {correction && <label className="prod-wide">Motivo de corrección<textarea required maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label>}
      </fieldset>

      <button type="submit" disabled={busy || blocked || !preview}>{correction ? 'Revisar corrección' : 'Revisar borrador'}</button>
    </form>}
  </section>;
}
