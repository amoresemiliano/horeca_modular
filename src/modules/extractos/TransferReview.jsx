import FinanceDialog from './FinanceDialog';
const labels = {SUGGESTED:'Sugerida',CONFIRMED:'Confirmada',REJECTED:'Rechazada'};
export default function TransferReview({ candidates, movementMap, busy, error, onClose, onDetect, onReview }) {
  return <FinanceDialog title="Transferencias internas · revisión de pares" busy={busy} onClose={onClose}>
    <p className="text-xs text-gray-600">Importes opuestos, cuentas propias distintas, misma moneda y hasta tres días. Revisa cada par antes de confirmar.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}<button disabled={busy} className="border border-gray-200 rounded px-3 py-1.5" onClick={onDetect}>Buscar candidatos</button>
    {!candidates.length && <p>No hay candidatos. Usa «Buscar candidatos» para analizar el historial.</p>}
    {candidates.map(c=><section key={c.id} className="rounded-lg bg-gray-50 p-3 space-y-2"><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">{[c.source_movement_id,'arrow',c.target_movement_id].map(id=>id==='arrow'?<span key={id} aria-hidden="true">↔</span>:<div key={id} className="min-w-0">{movementMap.get(id)?<><strong className="block truncate" title={movementMap.get(id).source_account?.name}>{movementMap.get(id).source_account?.name} · {movementMap.get(id).monto} {movementMap.get(id).currency}</strong><span className="block text-xs text-gray-600 truncate" title={movementMap.get(id).descripcion}>{movementMap.get(id).fecha} · {movementMap.get(id).descripcion}</span></>:<p>Movimiento no disponible; recarga.</p>}</div>)}</div>
      <p className="text-xs text-gray-600">{labels[c.status]} · {c.evidence.dayDistance} días · referencia: {c.evidence.referenceMatch?'coincide':'sin coincidencia'} · descripción: {c.evidence.descriptionHint?'indicio':'sin indicio'}</p>
      {c.status==='SUGGESTED' && <div className="flex gap-2"><button disabled={busy || !movementMap.has(c.source_movement_id) || !movementMap.has(c.target_movement_id)} className="bg-emerald-700 text-white rounded px-3 py-1.5" onClick={()=>onReview(c.id,'CONFIRMED')}>Confirmar</button><button disabled={busy} className="border border-gray-200 rounded px-3 py-1.5" onClick={()=>onReview(c.id,'REJECTED')}>Rechazar</button></div>}
    </section>)}
  </FinanceDialog>;
}
