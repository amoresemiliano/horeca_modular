import { useState } from 'react';
import { findOrCreateCounterparty, updateAllocationClassification } from '../../lib/extractosService';

export default function ClassificationModal({ movement, catalogs, orgId, onClose, onSaved }) {
  const [index, setIndex] = useState(0);
  const initial = movement.allocations?.[0] || {};
  const [category, setCategory] = useState(initial.category_id || '');
  const [subcategory, setSubcategory] = useState(initial.subcategory_id || '');
  const [counterparty, setCounterparty] = useState(initial.counterparty?.name || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  function selectAllocation(value) {
    const a = movement.allocations[value]; setIndex(value);
    setCategory(a.category_id || ''); setSubcategory(a.subcategory_id || ''); setCounterparty(a.counterparty?.name || '');
  }
  async function save(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const counterpartyId = counterparty.trim() ? await findOrCreateCounterparty(counterparty, 'PROVEEDOR', orgId) : null;
      await updateAllocationClassification({ orgId, allocationId: movement.allocations[index].id, categoryId: category, subcategoryId: subcategory || null, counterpartyId });
      onSaved(); onClose();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  return <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <form onSubmit={save} className="bg-white rounded-xl p-6 space-y-4 w-full max-w-lg text-gray-900">
      <h2 className="font-bold text-lg">Clasificar movimiento</h2><p>{movement.descripcion}</p>
      {movement.allocations.length > 1 && <label className="block">Línea del split<select className="block border rounded p-2 w-full" value={index} onChange={e => selectAllocation(Number(e.target.value))}>{movement.allocations.map((a, i) => <option key={a.id} value={i}>Línea {i + 1}: {a.monto} {movement.currency}</option>)}</select></label>}
      <label className="block">Categoría de ingreso o gasto<select required className="block border rounded p-2 w-full" value={category} onChange={e => { setCategory(e.target.value); setSubcategory(''); }}><option value="">Seleccionar</option>{catalogs.categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}</select></label>
      <label className="block">Subcategoría<select className="block border rounded p-2 w-full" value={subcategory} onChange={e => setSubcategory(e.target.value)}><option value="">Sin subcategoría</option>{catalogs.subcategories.filter(s => s.category_id === category).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="block">Contraparte (opcional)<input maxLength={200} list="finance-counterparties" className="block border rounded p-2 w-full" value={counterparty} onChange={e => setCounterparty(e.target.value)} /><datalist id="finance-counterparties">{catalogs.counterparties.map(c => <option key={c.id} value={c.name} />)}</datalist></label>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="flex gap-3"><button disabled={saving || !initial.id} type="submit" className="bg-emerald-700 text-white px-4 py-2 rounded">{saving ? 'Guardando…' : 'Confirmar clasificación'}</button><button disabled={saving} type="button" onClick={onClose}>Cancelar</button></div>
    </form>
  </div>;
}
