import {useMemo,useState} from 'react';
import {buildPatternReviewGroups,settlementCandidates} from '../../domains/finance/application/patternLearning';
import PatternReview from './PatternReview';
export default function PatternWorkspace({movements,catalogs,orgId,canReconcile,onSaved}){
 const groups=useMemo(()=>buildPatternReviewGroups(movements,orgId),[movements,orgId]),pairs=useMemo(()=>settlementCandidates(movements,orgId),[movements,orgId]);
 const [selected,setSelected]=useState(null),[page,setPage]=useState(1);
 const pages=Math.max(1,Math.ceil(groups.length/10)),current=Math.min(page,pages);
 return <details aria-label="Clasificación asistida" className="border rounded-lg p-3 space-y-2 bg-white text-xs">
  <summary className="cursor-pointer font-semibold">Clasificación asistida ({groups.length})</summary>
  <p>El sistema agrupa movimientos similares para que puedas clasificarlos una sola vez.</p>
  <p>{groups.length} patrones pendientes · {groups.reduce((n,g)=>n+g.rows.length,0)} movimientos · {groups.filter(g=>g.state==='Propuesta').length} propuestas · {groups.filter(g=>g.state==='Reconocido').length} reconocidos · {groups.filter(g=>g.state==='Conflicto').length} conflictos</p>
  <p>Reconocido: el sistema encontró al menos dos ejemplos humanos consistentes. La confirmación siempre es tuya.</p>
  {canReconcile&&pairs.slice(0,10).map(p=><div key={p.bank.id+p.card.id} className="bg-emerald-50 rounded p-2"><span>Posible liquidación de tarjeta · {Math.abs(p.bank.monto)} {p.bank.currency} · {p.days} días{p.ambiguous?' · coincidencias ambiguas':''}. Revisa cada movimiento; la vinculación está pendiente.</span></div>)}
  {groups.slice((current-1)*10,current*10).map(g=><div key={g.key} role="group" aria-label={`${g.merchant} · ${g.context}`} className="flex justify-between flex-wrap gap-2 border-t pt-2"><span className="break-words min-w-0">{g.merchant} · {g.rows.length} movimientos · {g.state}<small className="block">{g.context} · {g.examples} ejemplos confirmados{g.exceptions.length?` · ${g.exceptions.length} excepciones para revisar`:''}</small>{g.rows.slice(0,3).map(row=><small key={row.id} className="block text-gray-600">{row.fecha} · {row.descripcion} · {row.monto} {row.currency}</small>)}</span><button onClick={()=>setSelected(g)} className="underline text-emerald-800">{g.state==='Conflicto'?'Revisar diferencias':g.state==='Reconocido'?'Revisar grupo':g.state==='Propuesta'?'Revisar propuesta':'Clasificar grupo'}</button></div>)}
  {!groups.length&&<p>No hay grupos pendientes de clasificación.</p>}
  {pages>1&&<nav aria-label="Páginas de grupos" className="flex gap-3"><button disabled={current<=1} onClick={()=>setPage(current-1)}>Grupos anteriores</button><span>{current} / {pages}</span><button disabled={current>=pages} onClick={()=>setPage(current+1)}>Grupos siguientes</button></nav>}
  {selected&&<PatternReview key={selected.key} group={selected} catalogs={catalogs} orgId={orgId} onClose={()=>setSelected(null)} onSaved={async n=>{await onSaved(typeof n==='number'?`${n} movimientos clasificados`:undefined);}} />}
 </details>;
}
