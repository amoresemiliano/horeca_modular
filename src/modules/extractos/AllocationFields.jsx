import { useState } from 'react';
import { genericEconomicTypes, economicLabels } from '../../domains/finance/domain/economic';
import { createFinanceCatalogEntry, findOrCreateCounterparty, getExtractosCatalogs } from '../../lib/extractosService';
import { changeCategory } from './workflow';
export default function AllocationFields({ value, onChange, catalogs, orgId, quickCreate = false, showNotes = true, onBusyChange, allowedEconomicTypes = genericEconomicTypes }) {
  const [refreshed, setRefreshed] = useState(null), [quick, setQuick] = useState('');
  const [name, setName] = useState(''), [categoryType, setCategoryType] = useState('GASTO');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const local = refreshed || catalogs;
  const field = (key, next) => onChange(key === 'category_id' ? changeCategory(value, next) : { ...value, [key]: next });
  async function create() {
    setBusy(true); onBusyChange?.(true); setError('');
    try {
      if (!name.trim()) throw new Error('Escribe un nombre');
      const id = quick === 'counterparty' ? await findOrCreateCounterparty(name, 'PROVEEDOR', orgId)
        : (await createFinanceCatalogEntry(quick, { name: name.trim(), ...(quick === 'category' ? { type: categoryType } : { category_id: value.category_id }) }, orgId)).id;
      setRefreshed(await getExtractosCatalogs(orgId)); field(quick + '_id', id); setQuick(''); setName('');
    } catch (err) { setError(err.message); } finally { setBusy(false); onBusyChange?.(false); }
  }
  const inputClass = 'block border border-gray-200 rounded-lg px-2 py-1.5 w-full bg-white disabled:bg-gray-100';
  return <div className="space-y-2">
    <div className="grid sm:grid-cols-2 gap-2">
      <label>Categoría<select aria-label="Categoría" className={inputClass} value={value.category_id || ''} onChange={e => field('category_id', e.target.value)}><option value="">Sin categoría</option>{local.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Subcategoría<select aria-label="Subcategoría" disabled={!value.category_id} className={inputClass} value={value.subcategory_id || ''} onChange={e => field('subcategory_id', e.target.value)}><option value="">{value.category_id ? 'Sin subcategoría' : 'Selecciona primero una categoría'}</option>{local.subcategories.filter(s => s.category_id === value.category_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    </div>
    <label className="block">Proveedor / contraparte<select aria-label="Proveedor / contraparte" className={inputClass} value={value.counterparty_id || ''} onChange={e => field('counterparty_id', e.target.value)}><option value="">Sin proveedor / contraparte</option>{local.counterparties.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label className="block">Tipo económico<select aria-label="Tipo económico" className={inputClass} value={value.economic_type || 'UNCLASSIFIED'} onChange={e => field('economic_type', e.target.value)}>{allowedEconomicTypes.filter(type => type !== 'INTERNAL_TRANSFER').map(type => <option key={type} value={type}>{type === 'UNCLASSIFIED' ? 'Selecciona tipo económico · sin clasificar' : economicLabels[type]}</option>)}</select></label>
    {value.economic_type === 'UNCLASSIFIED' && <p className="text-xs text-amber-800">Elige el tipo explícitamente. Sin él, esta asignación sigue sin interpretación económica.</p>}
    {showNotes && <label className="block">Nota opcional<textarea rows={2} aria-label="Nota opcional" maxLength={500} className={inputClass} value={value.notes || ''} onChange={e => field('notes', e.target.value)} /></label>}
    {quickCreate && <div className="flex gap-2 flex-wrap text-sm" aria-label="Crear sin salir de la clasificación">{[['category', '+ Categoría'], ['subcategory', '+ Subcategoría'], ['counterparty', '+ Proveedor / contraparte']].map(([kind, label]) => <button key={kind} type="button" disabled={busy || (kind === 'subcategory' && !value.category_id)} title={kind === 'subcategory' && !value.category_id ? 'Selecciona primero una categoría' : label} className="border border-emerald-300 rounded-lg px-2 py-1.5 text-emerald-800 bg-emerald-50 disabled:opacity-50" onClick={() => { setQuick(kind); setError(''); setName(''); }}>{label}</button>)}</div>}
    {quick && <div className="p-3 bg-emerald-50 rounded-lg space-y-2"><label className="block">Nombre de {quick === 'counterparty' ? 'proveedor / contraparte' : quick === 'category' ? 'categoría' : 'subcategoría'}<input aria-label={'Nombre de ' + (quick === 'counterparty' ? 'proveedor / contraparte' : quick === 'category' ? 'categoría' : 'subcategoría')} className={inputClass} maxLength={100} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); create(); } }} /></label>
      {quick === 'category' && <label className="block">Grupo de categoría<select aria-label="Grupo de categoría" className={inputClass} value={categoryType} onChange={e => setCategoryType(e.target.value)}><option value="GASTO">Gasto</option><option value="INGRESO">Ingreso</option></select><span className="text-xs">No cambia el tipo económico del movimiento.</span></label>}
      <button type="button" disabled={busy} className="bg-emerald-700 text-white rounded px-2 py-1.5" onClick={create}>Crear y seleccionar</button><button type="button" className="ml-3" disabled={busy} onClick={() => setQuick('')}>Cancelar creación</button></div>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </div>;
}
