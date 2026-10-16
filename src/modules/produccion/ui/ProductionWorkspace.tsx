import { useEffect, useRef, useState } from 'react';
import type { BatchStatus, ProductionCommand, ProductionCommandType } from '../domain/contracts';
import type { BatchDetail as Detail, BatchRecord, HistoryFilter, OwnerContext, PolicyRecord, ProductionAccess, ProductionCommandPort, ProductionOwnerReadPort, ProductionReadPort, ProductionScope } from '../application/readModels';
import { unavailableOwners } from '../application/readModels';
import { batchSnapshot, businessToday, declarationFromBatch, displayQuantity, ProductionCommandSession, scopedOwners, statusLabels } from '../application/workflow';
import { productionMessage } from '../application/errors';
import { ProductionEditor } from './ProductionEditor';
import { PlanningPanel } from './PlanningPanel';
import { BatchDetail, formatTime } from './BatchDetail';
import './production.css';

interface Props {
  scope:ProductionScope;unitLabel:string;access:ProductionAccess;reads:ProductionReadPort;commands:ProductionCommandPort;
  owners?:ProductionOwnerReadPort;initialTab?:string;
}
const emptyOwners:OwnerContext={available:false,products:[],packages:[],locations:[],recipes:[],stock:[]};
export function ProductionWorkspace({scope,unitLabel,access,reads,commands,owners=unavailableOwners,initialTab}:Props) {
  const [tab,setTab]=useState(initialTab==='Historial'?'history':'today');
  const [date,setDate]=useState(businessToday),[status,setStatus]=useState<BatchStatus|''>(''),[productId,setProduct]=useState('');
  const [items,setItems]=useState<BatchRecord[]>([]),[next,setNext]=useState<HistoryFilter['cursor']>();
  const [cursor,setCursor]=useState<HistoryFilter['cursor']>(),[previous,setPrevious]=useState<HistoryFilter['cursor'][]>([]);
  const [policies,setPolicies]=useState<PolicyRecord[]>([]),[policyNext,setPolicyNext]=useState<string>();
  const [references,setReferences]=useState(emptyOwners),[detail,setDetail]=useState<Detail|null>(null);
  const [editor,setEditor]=useState<{id:string;batch?:BatchRecord;correction?:boolean}|null>(null);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[stale,setStale]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[refresh,setRefresh]=useState(0);
  const authority=useRef(access);authority.current=access;
  const [session]=useState(()=>new ProductionCommandSession(commands,key=>authority.current[key]));
  const {organizationId,operationalUnitId}=scope;
  useEffect(()=>{setTab(initialTab==='Historial'?'history':'today');setEditor(null);setDetail(null);},[initialTab]);
  useEffect(()=>{
    let active=true;
    if(!access.view)return;
    setReferences(emptyOwners);
    owners.load({organizationId,operationalUnitId}).then(value=>{if(active)setReferences(scopedOwners(value,{organizationId,operationalUnitId}));}).catch(()=>{if(active)setReferences(emptyOwners);});
    return()=>{active=false;};
  },[owners,organizationId,operationalUnitId,access.view,refresh]);
  useEffect(()=>{
    let active=true;
    if(!access.view)return;
    setLoading(true);setError('');setItems([]);
    Promise.all([reads.history({organizationId,operationalUnitId},{date:date || undefined,status:status || undefined,productId:productId || undefined,cursor}),reads.policies({organizationId,operationalUnitId})])
      .then(([page,planning])=>{if(active){setItems(page.items);setNext(page.next);setPolicies(planning.items);setPolicyNext(planning.next);}})
      .catch(e=>{if(active){setError(productionMessage(e));setNext(undefined);setPolicies([]);}})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[reads,organizationId,operationalUnitId,access.view,date,status,productId,cursor,refresh]);
  if(!access.view||!organizationId||!operationalUnitId)return <section className="prod-workspace"><h2>Producción no disponible</h2><p>Selecciona una organización y una unidad operativa con acceso de consulta a Producción.</p></section>;
  const changeFilters=(change:()=>void)=>{change();setCursor(undefined);setPrevious([]);};
  const reload=()=>{setDetail(null);setEditor(null);setStale(false);setRefresh(n=>n+1);};
  async function openDetail(id:string) {
    setBusy(true);setError('');
    try{setDetail(await reads.detail(scope,id));}catch(e){setError(productionMessage(e));}finally{setBusy(false);}
  }
  async function execute(command:ProductionCommandType,id:string,revision:number,body:ProductionCommand['body']) {
    setBusy(true);setError('');setNotice('');
    try {
      const result=await session.execute({command,entity_id:id,expected_revision:revision,organization_id:organizationId,operational_unit_id:operationalUnitId,body});
      setNotice(result.status==='DRAFT'?'Borrador guardado. Todavía no está confirmado.':result.status==='WASTE_LOGGED'?'Merma registrada, pendiente de confirmación.':result.status==='WASTE_CONFIRMED'?'Merma confirmada. La integración con Inventario sigue pendiente.':result.status==='POLICY_SAVED'?'Límites guardados. No se ha modificado el stock.':'Producción actualizada. El historial se conserva y la integración con Inventario sigue pendiente.');
      setRefresh(n=>n+1);
      try{if(command!=='save_policy')setDetail(await reads.detail(scope,id));}catch(e){setDetail(null);setError('La operación se ha guardado. '+productionMessage(e));}
      return result;
    }catch(e){
      setError(productionMessage(e));
      if(e instanceof Error&&['STALE_REVISION','DRAFT_CONFIRMATION_MISMATCH','IDEMPOTENCY_CONFLICT'].includes(e.message))setStale(true);
      throw e;
    }finally{setBusy(false);}
  }
  const list=(batches:BatchRecord[])=>batches.length ? <div className="prod-grid">{batches.map(batch=><article className="prod-card" key={batch.id}>
    <div className="prod-section-title"><strong>{batch.effective_date}</strong><span className={`prod-badge prod-${batch.status.toLowerCase()}`}>{statusLabels[batch.status]}</span></div>
    {batchSnapshot(batch).outputs.map(o=><p className="prod-summary" key={o.line_id}><span>{references.products.find(p=>p.id===o.product_id)?.label || o.product_id}</span><strong>{displayQuantity(o.quantity)} {o.unit}</strong></p>)}
    {batch.status==='REVERSED'&&<p>Revertido · salida anterior conservada en el detalle.</p>}
    <small>Registrado {formatTime(batch.recorded_at)} · revisión {batch.revision}</small>
    <small>Perfil: {batch.actor_profile_id}</small>
    <p>{['DRAFT','CANCELLED'].includes(batch.status)?'Sin envío a Inventario':'Pendiente de integración con Inventario'}</p>
    <button className="prod-secondary" disabled={busy} onClick={()=>openDetail(batch.id)}>Abrir lote</button>
  </article>)}</div> : <p className="prod-empty">No hay lotes para estos filtros.</p>;
  return <div className="prod-workspace">
    <header className="prod-header"><div><h1>Producción</h1><p>{unitLabel} · registro y seguimiento de cocina</p></div><button className="prod-secondary" disabled={busy} onClick={reload}>Actualizar datos</button></header>
    <nav className="prod-tabs" aria-label="Secciones de Producción">{[['today','Hoy'],['planning','Planificación'],['history','Historial']].map(([value,label])=><button key={value} aria-pressed={tab===value} className={tab===value?'':'prod-secondary'} disabled={busy} onClick={()=>{setTab(value);setEditor(null);setDetail(null);changeFilters(()=>{setStatus('');setProduct('');setDate(value==='history'?'':businessToday());});}}>{label}</button>)}</nav>
    {!references.available&&<p className="prod-unavailable" role="status">Catálogo y destinos pendientes de integración. El registro de producción y sus conversiones requieren referencias aprobadas. El stock no está disponible.</p>}
    {notice&&<p role="status" className="prod-success">{notice}</p>}{error&&<p role="alert" className="prod-error">{error}</p>}
    {stale&&<p className="prod-notice">Actualiza los datos para continuar; revisa de nuevo antes de enviar.</p>}
    {editor ? <ProductionEditor key={editor.id+(editor.correction?'correct':'edit')} owners={references} batch={editor.batch} date={date} correction={editor.correction} busy={busy} blocked={stale || (editor.correction ? !access.correct : !access.log)} onBack={()=>setEditor(null)} onSave={async(declaration,reason)=>{
      await execute(editor.correction?'correct_batch':editor.batch?'update_draft':'create_draft',editor.id,editor.batch?.revision || 0,editor.correction?{reason,execution:declaration}:declaration);setEditor(null);
    }}/> : detail ? <BatchDetail key={detail.batch.id+':'+detail.batch.revision} detail={detail} owners={references} access={access} busy={busy} blocked={stale} onBack={()=>setDetail(null)} onEdit={correction=>setEditor({id:detail.batch.id,batch:detail.batch,correction})} onCommand={async(command,body)=>{
      await execute(command,detail.batch.id,detail.batch.revision,command==='confirm_batch'?declarationFromBatch(detail.batch):body as ProductionCommand['body']);
    }}/> : <>
      {tab!=='planning'&&<section className="prod-toolbar" aria-label="Filtros de producción"><label>Fecha efectiva<input type="date" value={date} onChange={e=>changeFilters(()=>setDate(e.target.value))}/></label>
        {tab==='history'&&<><label>Estado<select aria-label="Estado" value={status} onChange={e=>changeFilters(()=>setStatus(e.target.value as BatchStatus|''))}><option value="">Todos los estados</option>{Object.entries(statusLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
          {references.available&&<label>Producto de salida actual<select value={productId} onChange={e=>changeFilters(()=>setProduct(e.target.value))}><option value="">Todos los productos</option>{references.products.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>}</>}
        {access.log&&<button disabled={busy||loading} onClick={()=>setEditor({id:crypto.randomUUID()})}>Nueva producción</button>}</section>}
      {loading ? <p role="status">Cargando Producción…</p> : tab==='planning' ? <PlanningPanel policies={policies} owners={references} canManage={access.plan} busy={busy||stale} next={policyNext} onMore={async()=>{setBusy(true);try{const page=await reads.policies(scope,policyNext);setPolicies(current=>[...current,...page.items]);setPolicyNext(page.next);}catch(e){setError(productionMessage(e));}finally{setBusy(false);}}} onSave={async(id,revision,body)=>{await execute('save_policy',id,revision,body);}}/>
        : tab==='history' ? <section aria-labelledby="history-title"><h2 id="history-title">Historial de producción</h2><p>Fechas efectivas y revisiones de esta unidad. Hasta 20 lotes por página.</p>{list(items)}</section>
        : <><PlanningPanel policies={policies} owners={references} canManage={false} busy={busy||stale} onMore={()=>{}} onSave={async()=>{}}/>{policyNext&&<button className="prod-secondary" onClick={()=>setTab('planning')}>Ver más necesidades en Planificación</button>}<section><h2>En preparación</h2>{list(items.filter(b=>b.status==='DRAFT'))}</section><section><h2>Producción registrada</h2>{list(items.filter(b=>b.status!=='DRAFT'))}</section></>}
      {tab!=='planning'&&(previous.length>0||next)&&<div className="prod-actions"><button className="prod-secondary" disabled={loading||busy||!previous.length} onClick={()=>{setCursor(previous.at(-1));setPrevious(p=>p.slice(0,-1));}}>Página anterior</button><button className="prod-secondary" disabled={loading||busy||!next} onClick={()=>{setPrevious(p=>[...p,cursor]);setCursor(next);}}>Página siguiente</button></div>}
    </>}
  </div>;
}
