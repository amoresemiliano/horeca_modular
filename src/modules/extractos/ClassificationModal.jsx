import { useState } from 'react';
import { updateAllocationClassification } from '../../lib/extractosService';
import FinanceDialog from './FinanceDialog';
import AllocationFields from './AllocationFields';
import { interpretationDraft, classificationInput } from './workflow';

export default function ClassificationModal({ movement, catalogs, orgId, onClose, onSaved, suggestion, onDismissSuggestion }) {
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState(() => interpretationDraft(movement.allocations[0]));
  const [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [proposal, setProposal] = useState(false);
  async function save(e, requestedStatus) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await updateAllocationClassification(classificationInput(orgId, movement.allocations[index].id, value, requestedStatus));
      await onSaved(); onClose();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  return <FinanceDialog title="Clasificar movimiento" size="small" onClose={onClose} busy={saving || creating}>
    <p>{movement.descripcion} · {movement.monto} {movement.currency}</p>
    {suggestion && <section className="bg-amber-50 rounded-lg p-2 text-xs"><strong>{suggestion.explanation}</strong><p>Misma cuenta, moneda y patrón de comercio. Propuesta sin confirmar.</p><div className="flex gap-3 mt-1"><button disabled={saving || creating} type="button" className="text-emerald-800 underline" onClick={()=>{setValue(v=>({...v,...suggestion}));setProposal(true);}}>Usar sugerencia</button><button disabled={saving || creating} type="button" className="underline" onClick={()=>{setValue(interpretationDraft(movement.allocations[index]));setProposal(false);onDismissSuggestion?.(movement.id);}}>Descartar en esta sesión</button></div></section>}
    <form onSubmit={save} className="space-y-2"><fieldset disabled={saving || creating} className="space-y-2">
      {movement.allocations.length > 1 && <label>Línea del split<select aria-label="Línea del split" className="block border border-gray-200 rounded p-2 w-full" value={index} onChange={e => { const i = Number(e.target.value); setIndex(i); setValue(interpretationDraft(movement.allocations[i])); }}>{movement.allocations.map((a, i) => <option key={a.id} value={i}>Línea {i + 1}: {a.monto}</option>)}</select></label>}
      {movement.allocations[index]?.classification_status === 'SUGGESTED' && <p className="bg-amber-50 text-amber-900 p-3 rounded-lg">Sugerencia pendiente de revisión. Guardar un tipo económico confirma tu interpretación.</p>}
      {value.transfer_candidate_id ? <p>Transferencia confirmada y vinculada. Su interpretación está protegida.</p> : <AllocationFields key={index} value={value} onChange={setValue} catalogs={catalogs} orgId={orgId} quickCreate onBusyChange={setCreating} />}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="sticky bottom-0 bg-white pt-2 flex gap-2 border-t border-gray-100"><button disabled={!value.id || !!value.transfer_candidate_id} className="bg-emerald-700 text-white rounded px-3 py-1.5">{saving ? 'Guardando…' : value.economic_type === 'UNCLASSIFIED' ? 'Guardar como pendiente' : 'Confirmar clasificación'}</button>{proposal && <button type="button" disabled={value.economic_type === 'UNCLASSIFIED'} className="border border-amber-300 rounded px-3 py-1.5" onClick={e=>save(e,'SUGGESTED')}>Guardar sugerencia sin confirmar</button>}</div>
    </fieldset></form>
  </FinanceDialog>;
}
