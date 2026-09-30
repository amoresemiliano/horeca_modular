import { useState } from 'react';
import { createFinanceCatalogEntry } from '../../lib/extractosService';

export default function FinanceCatalogModal({ orgId, categories, onClose, onSaved }) {
  const [kind, setKind] = useState('account');
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('BBVA');
  const [product, setProduct] = useState('BANK_ACCOUNT');
  const [lastFour, setLastFour] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState('GASTO');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function save(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const input = kind === 'account'
        ? { name: name.trim(), code: crypto.randomUUID(), institution, product_type: product, masked_identifier: lastFour, currency: 'EUR' }
        : kind === 'category' ? { name: name.trim(), type } : { name: name.trim(), category_id: category };
      await createFinanceCatalogEntry(kind, input, orgId);
      onSaved(); onClose();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  return <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <form onSubmit={save} className="bg-white rounded-xl p-6 space-y-4 w-full max-w-md text-gray-900">
      <h2 className="font-bold text-lg">Cuentas y categorías</h2>
      <label className="block">Crear<select className="block border rounded p-2 w-full" value={kind} onChange={e => setKind(e.target.value)}>
        <option value="account">Cuenta o tarjeta bancaria</option><option value="category">Categoría</option><option value="subcategory">Subcategoría</option>
      </select></label>
      <label className="block">Nombre<input required maxLength={100} className="block border rounded p-2 w-full" value={name} onChange={e => setName(e.target.value)} /></label>
      {kind === 'account' && <>
        <label className="block">Banco<select className="block border rounded p-2 w-full" value={institution} onChange={e => setInstitution(e.target.value)}><option>BBVA</option><option>SABADELL</option></select></label>
        <label className="block">Producto<select className="block border rounded p-2 w-full" value={product} onChange={e => setProduct(e.target.value)}><option value="BANK_ACCOUNT">Cuenta</option><option value="CARD">Tarjeta</option></select></label>
        <label className="block">Últimos cuatro dígitos<input required pattern="[0-9]{4}" maxLength={4} className="block border rounded p-2 w-full" value={lastFour} onChange={e => setLastFour(e.target.value)} /></label>
        <p className="text-sm">Moneda EUR. Usa un nombre distinto para cada cuenta. No introduzcas el IBAN ni el número completo de tarjeta.</p>
      </>}
      {kind === 'category' && <label className="block">Tipo<select className="block border rounded p-2 w-full" value={type} onChange={e => setType(e.target.value)}><option value="GASTO">Gasto</option><option value="INGRESO">Ingreso</option></select></label>}
      {kind === 'subcategory' && <label className="block">Categoría<select required className="block border rounded p-2 w-full" value={category} onChange={e => setCategory(e.target.value)}><option value="">Seleccionar</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="flex gap-3"><button disabled={saving} type="submit" className="bg-emerald-700 text-white px-4 py-2 rounded">{saving ? 'Guardando…' : 'Guardar'}</button><button disabled={saving} type="button" onClick={onClose}>Cancelar</button></div>
    </form>
  </div>;
}
