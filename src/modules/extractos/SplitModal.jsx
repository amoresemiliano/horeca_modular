import { useState } from 'react';
import FinanceDialog from './FinanceDialog';
import AllocationFields from './AllocationFields';
import { interpretationDraft } from './workflow';
const cents = value => /^-?\d+(\.\d{1,2})?$/.test(String(value)) && Math.abs(Number(value)) <= 999999999999.99 ? Math.round(Number(value) * 100) : NaN;
function SplitEditor({ onClose, movement, categories, subcategories, counterparties, onConfirmSplit }) {
  const [allocations, setAllocations] = useState(() => movement.allocations?.length ? movement.allocations.map(a => interpretationDraft(a)) : [{ ...interpretationDraft(), monto: movement.monto }]);
  const [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const original = cents(movement.monto), sum = allocations.reduce((n, a) => n + cents(a.monto), 0), difference = original - sum;
  const balanced = Number.isSafeInteger(sum) && sum === original;
  const protectedMovement = movement.allocations?.some(a => a.transfer_candidate_id || a.reconciliation_status === 'CONFIRMED');
  const catalogs = { categories, subcategories, counterparties };
  async function save() {
    if (!balanced || protectedMovement) return;
    setLoading(true); setError('');
    try { await onConfirmSplit(movement.id, original / 100, allocations); onClose(); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  return <FinanceDialog title="Dividir movimiento" onClose={onClose} busy={loading}>
    <p className="text-sm">Divide este movimiento en varias interpretaciones económicas. El movimiento bancario original no cambia.</p>
    <p className="font-medium">{movement.descripcion} · {movement.monto} {movement.currency}</p>
    {protectedMovement && <p role="alert">Este movimiento vinculado no puede dividirse.</p>}
    <p role="status" className={'p-3 rounded-lg ' + (balanced ? 'bg-emerald-50' : 'bg-amber-50')}>Original: {(original / 100).toFixed(2)} · Suma: {(sum / 100).toFixed(2)} · {balanced ? 'Balanceado' : 'Diferencia: ' + (difference / 100).toFixed(2)} {movement.currency}</p>
    <fieldset disabled={loading || protectedMovement} className="space-y-3">{allocations.map((a, index) => <section key={index} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex justify-between"><h3 className="font-semibold">Línea {index + 1}</h3>{allocations.length > 1 && <button type="button" className="text-red-700 text-sm" onClick={() => setAllocations(prev => prev.filter((_, i) => i !== index))}>Quitar línea {index + 1}</button>}</div>
      {a.classification_status === 'SUGGESTED' && <p className="text-sm text-amber-900">Sugerencia pendiente de revisión. Confirmar el split confirma las líneas elegidas.</p>}
      <label className="block">Importe<input aria-label="Importe" className="block border border-gray-200 rounded-lg p-2 w-full" inputMode="decimal" value={a.monto} onChange={e => setAllocations(prev => prev.map((x, i) => i === index ? { ...x, monto: e.target.value } : x))} /></label>
      <AllocationFields value={a} onChange={value => setAllocations(prev => prev.map((x, i) => i === index ? value : x))} catalogs={catalogs} />
    </section>)}
      <button type="button" className="border border-dashed rounded-lg p-3 w-full" onClick={() => setAllocations(prev => [...prev, { ...interpretationDraft(), monto: Number.isFinite(difference) ? (difference / 100).toFixed(2) : '0.00' }])}>+ Añadir línea</button>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <p className="text-xs text-gray-500">Revisa todas las líneas antes de confirmar. Las líneas sin tipo siguen sin interpretación económica.</p>
      <button disabled={!balanced} type="button" onClick={save} className="bg-emerald-700 text-white rounded-lg px-4 py-2 disabled:opacity-50">{loading ? 'Guardando…' : 'Confirmar split'}</button>
    </fieldset>
  </FinanceDialog>;
}
export default function SplitModal(props) { return props.isOpen && props.movement ? <SplitEditor key={props.movement.id} {...props} /> : null; }
