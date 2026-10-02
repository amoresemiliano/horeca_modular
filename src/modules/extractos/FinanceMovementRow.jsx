import { useState } from 'react';
import { Pencil, Settings, Scissors } from 'lucide-react';
import { economicLabels, genericEconomicTypes } from '../../domains/finance/domain/economic';
import { updateAllocationClassification } from '../../lib/extractosService';
import { interpretationDraft, changeCategory, classificationInput, ruleExample } from './workflow';
import { currencyAmount } from './ExtractosGraficas';
const statusLabels = { PENDING: 'Pendiente', SUGGESTED: 'Sugerida · revisar', CONFIRMED: 'Confirmada' };
function Action({ label, reason, onClick, children }) {
  return <span title={reason || label} tabIndex={reason ? 0 : undefined} aria-label={reason || undefined} className="inline-flex"><button type="button" title={reason || label} aria-label={reason || label} disabled={!!reason} onClick={onClick} className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-lg hover:bg-emerald-50 focus-visible:outline-emerald-700 disabled:opacity-35">{children}</button></span>;
}
export default function FinanceMovementRow({ movement: m, catalogs, orgId, editable, onSaved, onEdit, onRule, onSplit }) {
  const a = m.allocations[0], multiple = m.allocations.length > 1;
  const [editing, setEditing] = useState(false), [value, setValue] = useState(() => interpretationDraft(a));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const linked = m.allocations.some(x => x.transfer_candidate_id);
  const noPermission = !editable ? 'Tu rol no permite clasificar movimientos' : '';
  const editReason = noPermission || (!a ? 'No hay asignación disponible para clasificar' : linked && !multiple ? 'Transferencia vinculada: usa la revisión de pares' : '');
  const ruleReason = noPermission || (!ruleExample(m) ? (multiple ? 'Edita las líneas del split; no hay una única clasificación para esta regla' : 'Clasifica primero el movimiento para crear una regla') : '');
  const splitReason = noPermission || (m.allocations.some(x => x.transfer_candidate_id || x.reconciliation_status === 'CONFIRMED') ? 'Este movimiento vinculado no puede dividirse' : '');
  async function save() {
    setBusy(true); setError('');
    try { await updateAllocationClassification(classificationInput(orgId, a.id, value)); await onSaved(); setEditing(false); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  const control = 'block border border-gray-200 rounded-lg px-2 py-1.5 w-full bg-white text-sm';
  return <tr className={'border-t border-gray-200 align-top ' + (editing ? 'bg-emerald-50/40' : '')}>
    <td className="p-3 text-xs">{m.fecha}</td><td className="p-3 break-words text-xs">{m.source_account?.name}<span className="block text-gray-400">•••• {m.source_account?.masked_identifier}</span></td>
    <td className="p-3 break-words" title={m.descripcion}>{m.descripcion}</td><td className={'p-3 text-right tabular-nums whitespace-nowrap ' + (Number(m.monto) < 0 ? 'text-red-700' : 'text-emerald-700')}>{currencyAmount(Number(m.monto) * 100, m.currency)}</td>
    <td className="p-3"><span className={'text-xs rounded px-2 py-0.5 inline-block mb-2 ' + (m.allocations.every(x => x.classification_status === 'CONFIRMED') ? 'bg-emerald-50' : 'bg-amber-100 text-amber-900')}>{multiple ? `${m.allocations.length} asignaciones · ${[...new Set(m.allocations.map(x => statusLabels[x.classification_status]))].join(' / ')}` : statusLabels[a?.classification_status || 'PENDING']}</span>
      {editing ? <fieldset disabled={busy} className="space-y-2">
        <label className="block text-xs">Categoría<select aria-label="Categoría" className={control} value={value.category_id || ''} onChange={e => setValue(changeCategory(value, e.target.value))}><option value="">Sin categoría</option>{catalogs.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        {value.category_id && <label className="block text-xs">Subcategoría<select aria-label="Subcategoría" className={control} value={value.subcategory_id || ''} onChange={e => setValue({ ...value, subcategory_id: e.target.value })}><option value="">Sin subcategoría</option>{catalogs.subcategories.filter(s => s.category_id === value.category_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
        <label className="block text-xs">Tipo económico<select aria-label="Tipo económico" className={control} value={value.economic_type} onChange={e => setValue({ ...value, economic_type: e.target.value })}>{genericEconomicTypes.map(type => <option key={type} value={type}>{type === 'UNCLASSIFIED' ? 'Selecciona tipo económico' : economicLabels[type]}</option>)}</select></label>
        <div className="flex flex-wrap gap-2 text-xs"><button className="bg-emerald-700 text-white rounded-lg px-2 py-2" onClick={save}>{busy ? 'Guardando…' : value.economic_type === 'UNCLASSIFIED' ? 'Guardar pendiente' : 'Confirmar'}</button><button onClick={() => { setEditing(false); setValue(interpretationDraft(a)); }}>Cancelar</button></div>
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      </fieldset> : <><p className="text-xs">{multiple ? 'Revisar por asignación' : economicLabels[a?.economic_type || 'UNCLASSIFIED']}</p>{a?.category && !multiple && <p className="text-xs text-gray-500">{a.category.name}{a.subcategory ? ' / ' + a.subcategory.name : ''}</p>}
        {!editReason && <button className="mt-1 text-emerald-800 underline text-xs" onClick={() => multiple ? onEdit(m) : setEditing(true)}>{multiple ? 'Editar líneas' : 'Clasificar en fila'}</button>}</>}
    </td>
    <td className="p-3 break-words text-xs">{editing ? <label>Proveedor / contraparte<select aria-label="Proveedor / contraparte" disabled={busy} className={control} value={value.counterparty_id || ''} onChange={e => setValue({ ...value, counterparty_id: e.target.value })}><option value="">Sin proveedor / contraparte</option>{catalogs.counterparties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label> : multiple ? 'Por asignación' : a?.counterparty?.name || '—'}</td>
    <td className="px-1 py-3"><div role="group" aria-label={'Acciones de ' + m.descripcion} className="flex flex-nowrap gap-1 w-28">
      <Action label="Editar clasificación" reason={busy ? 'Guardando clasificación' : editReason} onClick={() => onEdit(m)}><Pencil size={16} /></Action>
      <Action label="Crear regla desde ejemplo confirmado" reason={busy ? 'Guardando clasificación' : ruleReason} onClick={() => onRule(m)}><Settings size={16} /></Action>
      <Action label="Dividir en asignaciones" reason={busy ? 'Guardando clasificación' : splitReason} onClick={() => onSplit(m)}><Scissors size={16} /></Action>
    </div></td>
  </tr>;
}
