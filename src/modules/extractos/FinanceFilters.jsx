import { economicTypes, economicLabels } from '../../domains/finance/domain/economic';
export default function FinanceFilters({ value, onChange, catalogs, movements }) {
  const field = key => e => onChange({ ...value, [key]: e.target.value });
  const control = 'block border border-gray-200 rounded-lg p-2 w-full bg-white';
  return <section aria-label="Filtros de movimientos" className="space-y-3">
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
      <label>Buscar movimientos<input aria-label="Buscar movimientos" className={control} placeholder="Descripción, categoría o proveedor" value={value.query} onChange={field('query')} /></label>
      <label>Cuenta<select aria-label="Cuenta" className={control} value={value.account} onChange={field('account')}><option value="">Todas las cuentas</option>{catalogs.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <label>Estado<select aria-label="Estado" className={control} value={value.status} onChange={field('status')}><option value="">Todos los estados</option><option value="PENDING">Pendiente</option><option value="SUGGESTED">Sugerida · revisar</option><option value="CONFIRMED">Confirmada</option></select></label>
      <label>Mes<input aria-label="Mes" type="month" className={control} value={value.month} onChange={field('month')} /></label>
    </div>
    <details className="text-sm"><summary className="cursor-pointer text-gray-600">Más filtros{[value.economicType, value.category, value.counterparty, value.currency !== 'EUR' && value.currency].filter(Boolean).length ? ' · activos' : ''}</summary><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-3">
      <label>Tipo económico<select aria-label="Tipo económico" className={control} value={value.economicType} onChange={field('economicType')}><option value="">Todos los tipos</option>{economicTypes.map(t => <option key={t} value={t}>{economicLabels[t]}</option>)}</select></label>
      <label>Categoría<select aria-label="Categoría" className={control} value={value.category} onChange={field('category')}><option value="">Todas las categorías</option>{catalogs.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Proveedor / contraparte<select aria-label="Proveedor / contraparte" className={control} value={value.counterparty} onChange={field('counterparty')}><option value="">Todos</option>{catalogs.counterparties.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Moneda<select aria-label="Moneda" className={control} value={value.currency} onChange={field('currency')}>{[...new Set(['EUR', ...movements.map(m => m.currency || 'EUR')])].map(c => <option key={c}>{c}</option>)}</select></label>
    </div></details>
  </section>;
}
