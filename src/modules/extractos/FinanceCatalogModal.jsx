import { useState } from 'react';
import { createFinanceCatalogEntry, updateFinanceAccount, renameFinanceCatalogEntry, getExtractosCatalogs } from '../../lib/extractosService';
import FinanceDialog from './FinanceDialog';
const sections = [['account', 'Cuentas', 'accounts'], ['category', 'Categorías', 'categories'], ['subcategory', 'Subcategorías', 'subcategories'], ['counterparty', 'Proveedores / contrapartes', 'counterparties']];
const blank = () => ({ name: '', institution: 'BBVA', product_type: 'BANK_ACCOUNT', masked_identifier: '', is_active: true, type: 'GASTO', category_id: '' });
export default function FinanceCatalogModal({ orgId, catalogs, onClose, onSaved, canAccounts = true, canClassify = true }) {
  const [local, setLocal] = useState(catalogs), [kind, setKind] = useState('account'), [editing, setEditing] = useState('');
  const [value, setValue] = useState(blank), [error, setError] = useState(''), [message, setMessage] = useState(''), [saving, setSaving] = useState(false);
  const field = (key, next) => setValue(v => ({ ...v, [key]: next }));
  const allowed = kind === 'account' ? canAccounts : canClassify;
  const rows = local[sections.find(s => s[0] === kind)[2]];
  function reset() { setEditing(''); setValue(blank()); setError(''); }
  async function save(e) {
    e.preventDefault(); if (!allowed) return; setSaving(true); setError(''); setMessage('');
    try {
      if (!value.name.trim()) throw new Error('Escribe un nombre');
      if (editing) {
        if (kind === 'account') await updateFinanceAccount(orgId, editing, { name: value.name.trim(), masked_identifier: value.masked_identifier, is_active: value.is_active });
        else await renameFinanceCatalogEntry(kind, editing, value.name, orgId);
      } else {
        const input = kind === 'account' ? { name: value.name.trim(), code: crypto.randomUUID(), institution: value.institution, product_type: value.product_type, masked_identifier: value.masked_identifier, currency: 'EUR' }
          : kind === 'category' ? { name: value.name.trim(), type: value.type } : kind === 'subcategory' ? { name: value.name.trim(), category_id: value.category_id } : { name: value.name.trim(), type: 'PROVEEDOR' };
        await createFinanceCatalogEntry(kind, input, orgId);
      }
      setLocal(await getExtractosCatalogs(orgId)); await onSaved();
      setMessage(editing ? 'Cambios guardados. El historial se conserva.' : 'Elemento creado. Puedes crear otro.'); reset();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  const control = 'block border border-gray-200 rounded-lg p-2 w-full bg-white disabled:bg-gray-100';
  return <FinanceDialog title="Cuentas y categorías" onClose={onClose} busy={saving}>
    <nav aria-label="Secciones del catálogo" className="flex gap-2 flex-wrap">{sections.map(([key, label]) => <button key={key} disabled={saving} aria-pressed={kind === key} className={'px-3 py-2 rounded-lg text-sm ' + (kind === key ? 'bg-emerald-700 text-white' : 'bg-gray-100')} onClick={() => { setKind(key); reset(); setMessage(''); }}>{label}</button>)}</nav>
    {message && <p role="status" className="p-3 bg-emerald-50 text-emerald-800 rounded-lg">{message}</p>}
    <div className="grid sm:grid-cols-2 gap-5">
      <section><h3 className="font-semibold mb-2">Elementos existentes ({rows.length})</h3><ul className="divide-y max-h-80 overflow-y-auto">{rows.map(row => <li key={row.id} className="py-3 flex justify-between gap-3 items-center text-sm"><div><strong>{row.name}</strong><p className="text-gray-500">{kind === 'account' ? `${row.institution} · ${row.masked_identifier} · ${row.is_active ? 'Activa' : 'Inactiva'}` : kind === 'subcategory' ? local.categories.find(c => c.id === row.category_id)?.name : kind === 'category' ? (row.type === 'GASTO' ? 'Gasto' : 'Ingreso') : ''}</p></div><button disabled={saving || !allowed} title={allowed ? 'Editar ' + row.name : 'Sin permiso para editar este catálogo'} className="text-emerald-800 underline disabled:opacity-40" onClick={() => { setEditing(row.id); setValue({ ...blank(), ...row }); setMessage(''); setError(''); }}>Editar</button></li>)}</ul>{!rows.length && <p className="text-sm text-gray-500">Todavía no hay elementos.</p>}</section>
      <form onSubmit={save} className="space-y-3"><fieldset disabled={saving || !allowed} className="space-y-3">
        <h3 className="font-semibold">{editing ? 'Editar elemento' : 'Crear elemento'}</h3>
        {!allowed && <p className="text-sm text-amber-800">Tu rol permite consultar este catálogo, pero no editarlo.</p>}
        <label className="block">Nombre<input aria-label="Nombre" required maxLength={kind === 'counterparty' ? 200 : 100} className={control} value={value.name} onChange={e => field('name', e.target.value)} /></label>
        {kind === 'account' && <><div className="grid grid-cols-2 gap-2"><label>Banco<select aria-label="Banco" disabled={!!editing} className={control} value={value.institution} onChange={e => field('institution', e.target.value)}><option>BBVA</option><option>SABADELL</option></select></label><label>Producto<select aria-label="Producto" disabled={!!editing} className={control} value={value.product_type} onChange={e => field('product_type', e.target.value)}><option value="BANK_ACCOUNT">Cuenta</option><option value="CARD">Tarjeta</option></select></label></div>
          <label className="block">Últimos cuatro dígitos<input aria-label="Últimos cuatro dígitos" required pattern="[0-9]{4}" maxLength={4} className={control} value={value.masked_identifier} onChange={e => field('masked_identifier', e.target.value)} /></label><p className="text-xs text-gray-500">Moneda EUR. No introduzcas el IBAN ni el número completo de tarjeta.</p>
          {editing && <label className="block text-sm"><input type="checkbox" checked={value.is_active} onChange={e => field('is_active', e.target.checked)} /> Activa para nuevas importaciones. Al desactivarla se conserva el historial.</label>}</>}
        {kind === 'category' && <label className="block">Grupo de categoría<select aria-label="Grupo de categoría" disabled={!!editing} className={control} value={value.type} onChange={e => field('type', e.target.value)}><option value="GASTO">Gasto</option><option value="INGRESO">Ingreso</option></select></label>}
        {kind === 'subcategory' && <label className="block">Categoría<select aria-label="Categoría" required disabled={!!editing} className={control} value={value.category_id} onChange={e => field('category_id', e.target.value)}><option value="">Seleccionar</option>{local.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
        {editing && kind !== 'account' && <p className="text-xs text-gray-500">Solo cambia el nombre. Las relaciones y el historial se conservan.</p>}
        <div className="flex gap-3"><button className="bg-emerald-700 text-white rounded-lg px-4 py-2">{saving ? 'Guardando…' : 'Guardar'}</button>{editing && <button type="button" onClick={reset}>Crear otro</button>}</div>
      </fieldset></form>
    </div>
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </FinanceDialog>;
}
