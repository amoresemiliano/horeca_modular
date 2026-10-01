import { useState } from 'react';
import { financeMetrics, economicLabels } from '../../domains/finance/domain/economic';

export const currencyAmount = (cents, currency = 'EUR') => (cents / 100).toLocaleString('es-ES', { style: 'currency', currency });
export function BankingCards({ flow, currency = 'EUR' }) {
  return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[['Entradas bancarias brutas', currencyAmount(flow.inflows, currency)], ['Salidas bancarias brutas', currencyAmount(flow.outflows, currency)], ['Flujo bancario neto', currencyAmount(flow.net, currency)], ['Movimientos', flow.count]].map(([label, value]) => <div key={label} className="bg-white border border-gray-200 rounded-xl p-4"><p className="text-xs text-gray-500">{label}</p><strong className="block mt-1 text-lg">{value}</strong></div>)}</div>;
}
export default function ExtractosGraficas({ movements = [] }) {
  const [month, setMonth] = useState(''), [currency, setCurrency] = useState('EUR');
  const filtered = movements.filter(m => !month || m.fecha.startsWith(month));
  const data = financeMetrics(filtered, currency), fmt = n => currencyAmount(n, currency);
  function flowTable(title, rows) {
    return <section className="bg-white border border-gray-200 rounded-xl p-4"><h3 className="font-semibold mb-3">{title}</h3><div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th className="text-left">Periodo / cuenta</th><th>Entradas</th><th>Salidas</th><th>Neto</th></tr></thead><tbody>{Object.entries(rows).sort(([a], [b]) => a.localeCompare(b)).map(([name, f]) => <tr key={name} className="border-t"><th className="text-left font-normal py-2">{name}</th><td className="text-right">{fmt(f.inflows)}</td><td className="text-right">{fmt(f.outflows)}</td><td className="text-right">{fmt(f.net)}</td></tr>)}</tbody></table></div></section>;
  }
  function breakdown(title, rows) {
    const sorted = Object.entries(rows).sort(([, a], [, b]) => b - a);
    return <section className="bg-white border border-gray-200 rounded-xl p-4"><h3 className="font-semibold mb-3">{title}</h3>{sorted.length ? sorted.slice(0, 15).map(([name, amount]) => <div key={name} className="flex justify-between gap-3 border-t py-2 text-sm"><span>{name}</span><strong>{fmt(amount)}</strong></div>) : <p className="text-sm text-gray-500">Sin gastos operativos confirmados</p>}</section>;
  }
  return <div className="p-4 lg:p-6 space-y-5 text-gray-900">
    <header className="flex flex-wrap gap-4 items-center"><h2 className="text-xl font-bold">Flujo bancario e interpretación económica</h2><label>Mes<select className="border border-gray-200 rounded p-2 ml-2" value={month} onChange={e => setMonth(e.target.value)}><option value="">Todos</option>{[...new Set(movements.map(m => m.fecha.slice(0, 7)))].sort().map(m => <option key={m}>{m}</option>)}</select></label><label>Moneda<select className="border border-gray-200 rounded p-2 ml-2" value={currency} onChange={e => setCurrency(e.target.value)}>{[...new Set(['EUR', ...movements.map(m => m.currency || 'EUR')])].map(c => <option key={c}>{c}</option>)}</select></label></header>
    <h3 className="font-semibold">Flujo bancario · incluye todas las entradas y salidas</h3><BankingCards flow={data.banking} currency={currency} />
    <div className="grid xl:grid-cols-2 gap-4">{flowTable('Por cuenta bancaria', data.accounts)}{flowTable('Flujo mensual', data.months)}</div>
    <h3 className="font-semibold">Interpretación económica · solo asignaciones confirmadas</h3>
    <div className="grid sm:grid-cols-3 gap-3">{[['Ingresos operativos', data.operatingIncome], ['Gastos operativos', data.operatingExpense], ['Resultado operativo', data.operatingIncome - data.operatingExpense]].map(([label, amount]) => <div key={label} className="bg-emerald-50 p-4 rounded-xl"><p>{label}</p><strong>{fmt(amount)}</strong></div>)}</div>
    <section className="bg-amber-50 rounded-xl p-4"><strong>Sin clasificación confirmada: {data.unclassifiedCount} asignaciones · {fmt(data.unclassifiedAmount)} en importe absoluto</strong><p className="text-sm">Pendientes: {data.pendingCount} · Sugeridas: {data.suggestedCount}. No se infiere ingreso o gasto a partir del signo.</p></section>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{['INTERNAL_TRANSFER', 'FINANCING_INFLOW', 'FINANCING_OUTFLOW', 'CARD_SETTLEMENT', 'OTHER_NON_OPERATING'].map(type => <section key={type} className="bg-white border p-4 rounded-xl"><h4>{economicLabels[type]}</h4><strong>{fmt(data.economic[type].inflows + data.economic[type].outflows)}</strong><p className="text-xs text-gray-500">Importe absoluto de {data.economic[type].count} asignaciones · neto {fmt(data.economic[type].net)}</p></section>)}</div>
    <p className="text-xs text-gray-500">Las transferencias muestran ambos lados bancarios; no son ingresos ni gastos operativos. Cada split se suma por sus asignaciones, sin sumar otra vez el movimiento original.</p>
    <div className="grid lg:grid-cols-3 gap-4">{breakdown('Gasto por categoría', data.categories)}{breakdown('Gasto por subcategoría', data.subcategories)}{breakdown('Principales proveedores / contrapartes', data.counterparties)}</div>
  </div>;
}
