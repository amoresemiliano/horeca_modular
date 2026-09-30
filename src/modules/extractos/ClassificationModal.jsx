import { useState } from 'react';
import { updateAllocationClassification } from '../../lib/extractosService';
import FinanceDialog from './FinanceDialog';
import AllocationFields, { emptyInterpretation } from './AllocationFields';

export default function ClassificationModal({ movement, catalogs, orgId, onClose, onSaved }) {
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState({ ...emptyInterpretation(), ...movement.allocations[0] });
  const [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  async function save(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await updateAllocationClassification({ orgId, allocationId: movement.allocations[index].id, economicType: value.economic_type,
        categoryId: value.category_id, subcategoryId: value.subcategory_id, counterpartyId: value.counterparty_id, notes: value.notes });
      await onSaved(); onClose();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  return <FinanceDialog title="Clasificar movimiento" onClose={onClose} busy={saving || creating}>
    <p>{movement.descripcion} · {movement.monto} {movement.currency}</p>
    <form onSubmit={save} className="space-y-4"><fieldset disabled={saving || creating} className="space-y-4">
      {movement.allocations.length > 1 && <label>Línea del split<select className="block border rounded p-2 w-full" value={index} onChange={e => { const i = Number(e.target.value); setIndex(i); setValue({ ...emptyInterpretation(), ...movement.allocations[i] }); }}>{movement.allocations.map((a, i) => <option key={a.id} value={i}>Línea {i + 1}: {a.monto}</option>)}</select></label>}
      {value.transfer_candidate_id ? <p>Transferencia confirmada y vinculada. Su interpretación está protegida.</p> : <AllocationFields key={index} value={value} onChange={setValue} catalogs={catalogs} orgId={orgId} quickCreate onBusyChange={setCreating} />}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <button disabled={!value.id || !!value.transfer_candidate_id} className="bg-emerald-700 text-white rounded px-4 py-2">{saving ? 'Guardando…' : 'Confirmar clasificación'}</button>
    </fieldset></form>
  </FinanceDialog>;
}
