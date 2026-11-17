import {useMemo,useState} from 'react';
import {buildPatternReviewGroups,settlementCandidates} from '../../domains/finance/application/patternLearning';
import {recognizeFinancePatterns,confirmCardSettlement} from '../../lib/extractosService';
import PatternReview from './PatternReview';
import FinanceDialog from './FinanceDialog';
export default function PatternWorkspace({movements,catalogs,orgId,canReconcile,onSaved}){
 const groups=useMemo(()=>buildPatternReviewGroups(movements,orgId),[movements,orgId]),pairs=useMemo(()=>settlementCandidates(movements,orgId),[movements,orgId]);
 const [selected,setSelected]=useState(null),[pair,setPair]=useState(null),[page,setPage]=useState(1),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const pages=Math.max(1,Math.ceil(groups.length/10)),current=Math.min(page,pages);
 async function recognize(){setBusy(true);setError('');try{const r=await recognizeFinancePatterns(orgId);await onSaved(`${r.recognized} reconocidos y ${r.suggested} propuestas`);}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <section aria-label="Revisión por grupos" className="border rounded-lg p-3 space-y-2 bg-white text-xs">
  <div className="flex justify-between gap-2 flex-wrap"><h3 className="font-semibold">Revisión por grupos ({groups.length})</h3><button disabled={busy||!groups.some(g=>g.recognized)} className="text-emerald-800 underline" onClick={recognize}>Aplicar patrones reconocidos</button></div>
  <p>Primero revisa transferencias y liquidaciones; después los patrones más frecuentes. Nuevo → propuesta → reconocido, siempre sin conflictos.</p>
  {canReconcile&&pairs.slice(0,10).map(p=><div key={p.bank.id+p.card.id} className="bg-emerald-50 rounded p-2 flex flex-wrap gap-2 items-center"><span>Liquidación de tarjeta · {Math.abs(p.bank.monto)} {p.bank.currency} · {p.days} días{p.ambiguous?' · coincidencias ambiguas':''}</span><button disabled={busy||p.ambiguous} onClick={()=>setPair(p)} className="underline">Revisar liquidación</button></div>)}
  {groups.slice((current-1)*10,current*10).map(g=><div key={g.key} role="group" aria-label={`${g.merchant} · ${g.context}`} className="flex justify-between flex-wrap gap-2 border-t pt-2"><span className="break-words min-w-0">{g.merchant} · {g.rows.length} movimientos · {g.state}<small className="block">{g.context}{g.exceptions.length?` · ${g.exceptions.length} excepciones para revisar`:''}</small></span><button disabled={busy} onClick={()=>setSelected(g)} className="underline text-emerald-800">Clasificar grupo</button></div>)}
  {!groups.length&&<p>No hay grupos pendientes de clasificación.</p>}
  {pages>1&&<nav aria-label="Páginas de grupos" className="flex gap-3"><button disabled={current<=1} onClick={()=>setPage(current-1)}>Grupos anteriores</button><span>{current} / {pages}</span><button disabled={current>=pages} onClick={()=>setPage(current+1)}>Grupos siguientes</button></nav>}
  {error&&<p role="alert" className="text-red-700">{error}</p>}
  {selected&&<PatternReview key={selected.key} group={selected} catalogs={catalogs} orgId={orgId} onClose={()=>setSelected(null)} onSaved={async n=>{await onSaved(typeof n==='number'?`${n} movimientos clasificados`:undefined);}} />}
  {pair&&<FinanceDialog title="Confirmar liquidación de tarjeta" onClose={()=>setPair(null)} busy={busy}><p>El pago bancario y el abono de tarjeta quedarán vinculados. No se contabilizan de nuevo como gasto operativo.</p>{[pair.bank,pair.card].map(m=><p key={m.id} className="break-words">{m.fecha} · {m.descripcion} · {m.monto} {m.currency}</p>)}{error&&<p role="alert">{error}</p>}<button disabled={busy} className="bg-emerald-700 text-white rounded p-2" onClick={async()=>{setBusy(true);setError('');try{await confirmCardSettlement(orgId,pair);setPair(null);await onSaved('Liquidación vinculada sin duplicar gasto');}catch(e){setError(e.message);}finally{setBusy(false);}}}>Confirmar liquidación vinculada</button></FinanceDialog>}
 </section>;
}
