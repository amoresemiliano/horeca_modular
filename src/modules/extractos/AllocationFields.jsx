import { useState } from 'react';
import { economicTypes, economicLabels } from '../../domains/finance/domain/economic';
import { createFinanceCatalogEntry, findOrCreateCounterparty, getExtractosCatalogs } from '../../lib/extractosService';

export const emptyInterpretation = () => ({ economic_type: 'UNCLASSIFIED', category_id: '', subcategory_id: '', counterparty_id: '', notes: '' });
export default function AllocationFields({ value, onChange, catalogs, orgId, quickCreate = false, showNotes = true, onBusyChange }) {
  const [local, setLocal] = useState(catalogs);
  const [quick, setQuick] = useState(''), [name, setName] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const operating = ['OPERATING_INCOME', 'OPERATING_EXPENSE'].includes(value.economic_type);
  const categoryType = value.economic_type === 'OPERATING_INCOME' ? 'INGRESO' : 'GASTO';
  const field = (key, next) => onChange({ ...value, [key]: next, ...(key === 'category_id' ? { subcategory_id: '' } : {}) });
  async function create() {
    setBusy(true); onBusyChange?.(true); setError('');
    try {
      if (!name.trim()) throw new Error('Escribe un nombre');
      const id = quick === 'counterparty' ? await findOrCreateCounterparty(name, 'PROVEEDOR', orgId)
        : (await createFinanceCatalogEntry(quick, { name: name.trim(), ...(quick === 'category' ? { type: categoryType } : { category_id: value.category_id }) }, orgId)).id;
      setLocal(await getExtractosCatalogs(orgId)); field(quick + '_id', id); setQuick(''); setName('');
    } catch (err) { setError(err.message); } finally { setBusy(false); onBusyChange?.(false); }
  }
  return <div className="space-y-3">
    <label className="block">Tipo económico<select className="block border rounded p-2 w-full" value={value.economic_type || 'UNCLASSIFIED'} onChange={e => onChange({ ...value, economic_type: e.target.value, category_id: '', subcategory_id: '' })}>{economicTypes.map(type => <option key={type} value={type}>{economicLabels[type]}</option>)}</select></label>
    <div className="grid sm:grid-cols-2 gap-3">
      <label>Categoría {operating ? '(opcional)' : '(no obligatoria)'}<select className="block border rounded p-2 w-full" value={value.category_id || ''} onChange={e => field('category_id', e.target.value)}><option value="">Sin categoría</option>{local.categories.filter(c => !operating || c.type === categoryType).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Subcategoría<select disabled={!value.category_id} className="block border rounded p-2 w-full" value={value.subcategory_id || ''} onChange={e => field('subcategory_id', e.target.value)}><option value="">Sin subcategoría</option>{local.subcategories.filter(s => s.category_id === value.category_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    </div>
    <label className="block">Contraparte<select className="block border rounded p-2 w-full" value={value.counterparty_id || ''} onChange={e => field('counterparty_id', e.target.value)}><option value="">Sin contraparte</option>{local.counterparties.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    {showNotes && <label className="block">Nota opcional<textarea maxLength={500} className="block border rounded p-2 w-full" value={value.notes || ''} onChange={e => field('notes', e.target.value)} /></label>}
    {quickCreate && <div className="flex gap-3 flex-wrap text-sm">
      <button type="button" onClick={() => setQuick('counterparty')}>+ Contraparte</button>
      {operating && <button type="button" onClick={() => setQuick('category')}>+ Categoría</button>}
      <button type="button" disabled={!value.category_id} onClick={() => setQuick('subcategory')}>+ Subcategoría</button>
    </div>}
    {quick && <div className="p-3 bg-emerald-50 rounded space-y-2"><label className="block">Nombre de {quick === 'counterparty' ? 'contraparte' : quick === 'category' ? 'categoría' : 'subcategoría'}<input className="block border p-2 w-full" maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label><button type="button" disabled={busy} onClick={create}>Crear y seleccionar</button><button type="button" className="ml-3" disabled={busy} onClick={() => setQuick('')}>Cancelar creación</button></div>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </div>;
}
