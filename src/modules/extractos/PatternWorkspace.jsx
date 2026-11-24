import {useMemo,useState} from 'react';
import {buildPatternReviewGroups,settlementCandidates} from '../../domains/finance/application/patternLearning';
import PatternReview from './PatternReview';
export default function PatternWorkspace({movements,catalogs,orgId,canReconcile,onSaved}){
 const groups=useMemo(()=>buildPatternReviewGroups(movements,orgId),[movements,orgId]),pairs=useMemo(()=>settlementCandidates(movements,orgId),[movements,orgId]);
 const [selected,setSelected]=useState(null),[page,setPage]=useState(1);
 const pages=Math.max(1,Math.ceil(groups.length/10)),current=Math.min(page,pages);
 return <details aria-label="Revisión por grupos" className="border rounded-lg p-3 space-y-2 bg-white text-xs">
  <summary className="cursor-pointer font-semibold">Revisión por grupos ({groups.length})</summary>
  <p>Primero revisa transferencias y liquidaciones; después los patrones más frecuentes. Nuevo → propuesta → reconocido, siempre sin conflictos.</p>
  {canReconcile&&pairs.slice(0,10).map(p=><div key={p.bank.id+p.card.id} className="bg-emerald-50 rounded p-2"><span>Posible liquidación de tarjeta · {Math.abs(p.bank.monto)} {p.bank.currency} · {p.days} días{p.ambiguous?' · coincidencias ambiguas':''}. Revisa cada movimiento; la vinculación está pendiente.</span></div>)}
  {groups.slice((current-1)*10,current*10).map(g=><div key={g.key} role="group" aria-label={`${g.merchant} · ${g.context}`} className="flex justify-between flex-wrap gap-2 border-t pt-2"><span className="break-words min-w-0">{g.merchant} · {g.rows.length} movimientos · {g.state}<small className="block">{g.context} · {g.examples} ejemplos confirmados{g.exceptions.length?` · ${g.exceptions.length} excepciones para revisar`:''}</small></span><button onClick={()=>setSelected(g)} className="underline text-emerald-800">Clasificar grupo</button></div>)}
  {!groups.length&&<p>No hay grupos pendientes de clasificación.</p>}
  {pages>1&&<nav aria-label="Páginas de grupos" className="flex gap-3"><button disabled={current<=1} onClick={()=>setPage(current-1)}>Grupos anteriores</button><span>{current} / {pages}</span><button disabled={current>=pages} onClick={()=>setPage(current+1)}>Grupos siguientes</button></nav>}
  {selected&&<PatternReview key={selected.key} group={selected} catalogs={catalogs} orgId={orgId} onClose={()=>setSelected(null)} onSaved={async n=>{await onSaved(typeof n==='number'?`${n} movimientos clasificados`:undefined);}} />}
 </details>;
}
