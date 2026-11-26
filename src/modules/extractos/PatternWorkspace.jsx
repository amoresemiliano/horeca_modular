import {useMemo,useState} from 'react';
import {buildPatternReviewGroups,settlementCandidates} from '../../domains/finance/application/patternLearning';
import PatternReview from './PatternReview';
import {reviewFinancePattern} from '../../lib/extractosService';
import {economicLabels} from '../../domains/finance/domain/economic';
export default function PatternWorkspace({movements,catalogs,orgId,canReconcile,onSaved}){
 const groups=useMemo(()=>buildPatternReviewGroups(movements,orgId),[movements,orgId]),pairs=useMemo(()=>settlementCandidates(movements,orgId),[movements,orgId]);
 const [selected,setSelected]=useState(null),[page,setPage]=useState(1),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const pages=Math.max(1,Math.ceil(groups.length/10)),current=Math.min(page,pages);
 async function approve(group){setBusy(true);setError('');try{const n=await reviewFinancePattern(orgId,group.rows.map(m=>m.allocations[0]),group.proposal);await onSaved(`${n} movimientos clasificados`);}catch(e){setError(e.message);}finally{setBusy(false);}}
 const canApprove=g=>g.recognized||(g.state==='Propuesta'&&!g.exceptions.length&&['OPERATING_INCOME','OPERATING_EXPENSE','OTHER_NON_OPERATING'].includes(g.proposal?.economic_type)&&g.proposal?.category_id&&g.proposal?.subcategory_id&&g.proposal?.counterparty_id);
 return <section aria-label="Clasificación asistida" className="border rounded-lg p-3 space-y-2 bg-white text-xs">
  <h3 className="font-semibold text-sm">Clasificación asistida</h3>
  <p>El sistema agrupa movimientos similares para que puedas clasificarlos una sola vez.</p>
  <div className="flex flex-wrap gap-2">{[['Patrones',groups.length],['Movimientos',groups.reduce((n,g)=>n+g.rows.length,0)],['Propuestas',groups.filter(g=>g.state==='Propuesta').length],['Reconocidos',groups.filter(g=>g.state==='Reconocido').length],['Conflictos',groups.filter(g=>g.state==='Conflicto').length]].map(([label,n])=><span key={label} className="rounded bg-gray-50 px-2 py-1">{label}: <strong>{n}</strong></span>)}</div>
  <p className="text-gray-600">Nuevo: sin historial suficiente. Propuesta: un ejemplo compatible. Reconocido: al menos dos ejemplos humanos consistentes. Conflicto: interpretaciones diferentes. La confirmación siempre es tuya.</p>
  {error&&<p role="alert" className="text-red-700">{error}</p>}
  {canReconcile&&pairs.slice(0,10).map(p=><div key={p.bank.id+p.card.id} className="bg-emerald-50 rounded p-2"><span>Posible liquidación de tarjeta · {Math.abs(p.bank.monto)} {p.bank.currency} · {p.days} días{p.ambiguous?' · coincidencias ambiguas':''}. Revisa cada movimiento; la vinculación está pendiente.</span></div>)}
  {groups.slice((current-1)*10,current*10).map(g=><div key={g.key} role="group" aria-label={`${g.merchant} · ${g.context}`} className="flex justify-between flex-wrap gap-2 border-t pt-2"><span className="break-words min-w-0">{g.merchant} · {g.rows.length} movimientos · {g.state}<small className="block">{g.context} · {g.examples} ejemplos confirmados{g.exceptions.length?` · ${g.exceptions.length} excepciones para revisar`:''}</small>{g.proposal&&<small className="block text-emerald-900">{economicLabels[g.proposal.economic_type]} · {catalogs.categories.find(c=>c.id===g.proposal.category_id)?.name || 'Sin categoría'} · {catalogs.subcategories.find(c=>c.id===g.proposal.subcategory_id)?.name || 'Sin subcategoría'} · {catalogs.counterparties.find(c=>c.id===g.proposal.counterparty_id)?.name || 'Sin proveedor'}</small>}{g.rows.slice(0,3).map(row=><small key={row.id} className="block text-gray-600">{row.fecha} · {row.descripcion} · {row.monto} {row.currency}</small>)}</span><span className="flex gap-2 items-start">{canApprove(g)&&<button disabled={busy} onClick={()=>approve(g)} className="text-emerald-800 font-semibold">{g.recognized?'Aprobar grupo':'Aprobar propuesta'}</button>}<button disabled={busy} onClick={()=>setSelected(g)} className="underline text-emerald-800">{g.state==='Conflicto'?'Revisar diferencias':g.state==='Reconocido'?'Revisar grupo':g.state==='Propuesta'?'Revisar propuesta':'Clasificar grupo'}</button></span></div>)}
  {!groups.length&&<p>No hay grupos pendientes de clasificación.</p>}
  {pages>1&&<nav aria-label="Páginas de grupos" className="flex gap-3"><button disabled={current<=1} onClick={()=>setPage(current-1)}>Grupos anteriores</button><span>{current} / {pages}</span><button disabled={current>=pages} onClick={()=>setPage(current+1)}>Grupos siguientes</button></nav>}
  {selected&&<PatternReview key={selected.key} group={selected} catalogs={catalogs} orgId={orgId} onClose={()=>setSelected(null)} onSaved={async n=>{await onSaved(typeof n==='number'?`${n} movimientos clasificados`:undefined);}} />}
 </section>;
}
