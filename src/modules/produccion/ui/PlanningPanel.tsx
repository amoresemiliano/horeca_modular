import { useState } from 'react';
import type { PlanningPolicyDeclaration } from '../domain/contracts';
import type { OwnerContext, PolicyRecord } from '../application/readModels';
import { displayQuantity, planningLabels, planningProjection } from '../application/workflow';
import { decimalAtoms } from '../domain/quantities';
import { productionMessage } from '../application/errors';

export function PlanningPanel({policies,owners,canManage,busy,next,onMore,onSave}: {
  policies:PolicyRecord[];owners:OwnerContext;canManage:boolean;busy:boolean;next?:string;
  onMore:()=>void;onSave:(id:string,revision:number,body:PlanningPolicyDeclaration)=>Promise<void>;
}) {
  const [editing,setEditing]=useState<PolicyRecord | 'new' | null>(null);
  return <section aria-labelledby="planning-title"><div className="prod-section-title"><h2 id="planning-title">Qué producir</h2>{canManage && <button className="prod-secondary" disabled={busy} onClick={()=>setEditing('new')}>Configurar mínimos y máximos</button>}</div>
    <p>La planificación orienta la producción y no modifica existencias.</p>
    {!policies.length && <p className="prod-empty">No hay políticas de planificación en esta unidad.</p>}
    <div className="prod-grid">{policies.map(p=>{
      const stock=owners.stock.find(s=>s.policyId===p.id),actual=stock?.unit===p.unit && stock.version && Number.isFinite(Date.parse(stock.observedAt)) ? stock.actual : null;
      const result=planningProjection(p.minimum,p.maximum,actual);
      return <article className="prod-card" key={p.id}><h3>{owners.products.find(product=>product.id===p.product_id)?.label || p.product_id}</h3>
        <span className={`prod-badge prod-${result.state.toLowerCase()}`}>{planningLabels[result.state]}</span>
        <p>Mínimo {displayQuantity(p.minimum)} · máximo {displayQuantity(p.maximum)} {p.unit}</p>
        {result.state==='UNKNOWN' ? <p>Stock no disponible. No se puede calcular una sugerencia.</p> : <><p>Stock informado: {displayQuantity(actual!)} {p.unit}</p><small>Observado: {stock?.observedAt} · versión {stock?.version}</small></>}
        {result.state!=='UNKNOWN' && <p>{['CRITICAL','NECESSARY'].includes(result.state) ? `Producción sugerida: ${displayQuantity(result.suggestedQuantity!)} ${p.unit}` : 'No requiere reposición.'}</p>}
        <small>Revisión de política {p.revision} · {p.stock_scope.location_ids.length} destino(s)</small>
        {canManage && <button className="prod-link" disabled={busy} onClick={()=>setEditing(p)}>Modificar límites</button>}
      </article>;
    })}</div>
    {next && <button className="prod-secondary" disabled={busy} onClick={onMore}>Más políticas</button>}
    {editing && <PolicyEditor key={editing==='new' ? 'new' : editing.id} policy={editing==='new'?undefined:editing} owners={owners} busy={busy} onBack={()=>setEditing(null)} onSave={async(id,revision,body)=>{await onSave(id,revision,body);setEditing(null);}}/>}
  </section>;
}
function PolicyEditor({policy,owners,busy,onBack,onSave}: {policy?:PolicyRecord;owners:OwnerContext;busy:boolean;onBack:()=>void;onSave:(id:string,revision:number,body:PlanningPolicyDeclaration)=>Promise<void>}) {
  const [id]=useState(()=>policy?.id || crypto.randomUUID()),[productId,setProduct]=useState(policy?.product_id || '');
  const [minimum,setMin]=useState(policy?.minimum || ''),[maximum,setMax]=useState(policy?.maximum || '');
  const [locations,setLocations]=useState<string[]>(policy?.stock_scope.location_ids || []),[error,setError]=useState('');
  return <section className="prod-panel"><h3>Política de planificación</h3>{!owners.available&&<p className="prod-unavailable">Se necesita el catálogo y los destinos aprobados para guardar límites.</p>}
    {error&&<p role="alert" className="prod-error">{error}</p>}
    <form onSubmit={async e=>{e.preventDefault();try{
      const product=owners.products.find(p=>p.id===productId);
      if(!owners.available||!product||!locations.length||locations.some(id=>!owners.locations.some(l=>l.id===id)))throw Error('REFERENCE_DENIED');
      planningProjection(minimum,maximum,null);decimalAtoms(minimum);decimalAtoms(maximum);
      await onSave(id,policy?.revision || 0,{product_id:productId,minimum,maximum,unit:product.base_unit,stock_scope:{location_ids:locations}});
    }catch(err){setError(productionMessage(err));}}}>
      <fieldset disabled={busy || !owners.available} className="prod-fields"><label>Producto<select required value={productId} onChange={e=>setProduct(e.target.value)}><option value="">Seleccionar producto</option>{owners.products.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <label>Mínimo<input required inputMode="decimal" value={minimum} onChange={e=>setMin(e.target.value)}/></label><label>Máximo<input required inputMode="decimal" value={maximum} onChange={e=>setMax(e.target.value)}/></label>
        <fieldset className="prod-wide"><legend>Destinos incluidos en el stock</legend>{owners.locations.map(l=><label className="prod-check" key={l.id}><input type="checkbox" checked={locations.includes(l.id)} onChange={e=>setLocations(current=>e.target.checked?[...current,l.id]:current.filter(id=>id!==l.id))}/>{l.label}</label>)}</fieldset>
      </fieldset><div className="prod-actions"><button disabled={busy || !owners.available}>Guardar límites</button><button type="button" className="prod-secondary" disabled={busy} onClick={onBack}>Cerrar</button></div>
    </form></section>;
}
