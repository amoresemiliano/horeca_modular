import { useState } from 'react';
import { reviewSummary } from './workflow';
import { BankingCards, currencyAmount } from './ExtractosGraficas';
import { economicLabels } from '../../domains/finance/domain/economic';
export default function ExtractosResumen({ movements, onReview }) {
  const [currency, setCurrency] = useState('EUR');
  const { metrics: m, attention, confirmed, hasOperating } = reviewSummary(movements, currency), fmt = n => currencyAmount(n, currency);
  const nonOperating = ['INTERNAL_TRANSFER', 'FINANCING_INFLOW', 'FINANCING_OUTFLOW', 'CARD_SETTLEMENT', 'OTHER_NON_OPERATING'].filter(type => m.economic[type].count > 0);
  return <div className="p-4 lg:p-6 space-y-5">
    <header className="flex justify-between items-center gap-3"><div><h2 className="text-xl font-bold">Resumen bancario</h2><p className="text-sm text-gray-500">Flujo bancario y trabajo pendiente de interpretación.</p></div><label className="text-sm">Moneda<select aria-label="Moneda" className="ml-2 border border-gray-200 rounded-lg p-2" value={currency} onChange={e => setCurrency(e.target.value)}>{[...new Set(['EUR', ...movements.map(m => m.currency || 'EUR')])].map(c => <option key={c}>{c}</option>)}</select></label></header>
    <BankingCards flow={m.banking} currency={currency} />
    <section className={'rounded-xl p-5 border ' + (attention ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-100')} aria-label="Atención requerida">
      <h3 className="font-semibold text-lg">{attention ? `${attention} movimientos pendientes de interpretación económica` : m.banking.count ? 'Interpretación al día' : 'Todavía no hay movimientos'}</h3>
      <p className="mt-1 text-sm">{m.unclassifiedCount} asignaciones sin interpretación confirmada · {m.suggestedCount} sugeridas · {confirmed} confirmadas con tipo económico</p>
      <p className="text-sm mt-1">Importe pendiente de interpretación: <strong>{fmt(m.unclassifiedAmount)}</strong> en importe absoluto.</p>
      <button className="bg-emerald-700 text-white rounded-lg px-4 py-2 mt-3" onClick={() => onReview(currency)}>Revisar movimientos</button>
    </section>
    {hasOperating ? <section aria-label="Interpretación operativa" className="grid sm:grid-cols-3 gap-3">{[['Ingresos operativos', m.operatingIncome], ['Gastos operativos', m.operatingExpense], ['Resultado operativo', m.operatingIncome - m.operatingExpense]].map(([label, value]) => <div key={label} className="bg-white border border-gray-200 rounded-xl p-4"><p className="text-sm text-gray-500">{label}</p><strong className="text-lg">{fmt(value)}</strong></div>)}</section> : <p className="text-sm text-gray-500">Aún no hay interpretación operativa confirmada. Los signos bancarios no determinan ingresos o gastos operativos.</p>}
    {nonOperating.length > 0 && <section aria-label="Interpretación no operativa" className="bg-gray-50 rounded-xl p-4"><h3 className="text-sm font-semibold mb-2">Otros flujos confirmados</h3><dl className="grid sm:grid-cols-2 gap-2 text-sm">{nonOperating.map(type => <div key={type} className="flex justify-between gap-3"><dt>{economicLabels[type]}</dt><dd>{fmt(m.economic[type].inflows + m.economic[type].outflows)}</dd></div>)}</dl><p className="text-xs text-gray-500 mt-2">Importes absolutos. Las transferencias muestran ambos lados y no alteran el resultado operativo.</p></section>}
    <details className="border border-gray-200 rounded-xl p-4"><summary className="cursor-pointer text-sm font-medium">Análisis breve por cuenta y clasificación</summary><div className="grid sm:grid-cols-2 gap-4 mt-3">
      <section><h4 className="text-sm font-semibold">Flujo neto por cuenta</h4>{Object.entries(m.accounts).map(([name, flow]) => <p key={name} className="flex justify-between gap-2 py-1 text-sm"><span>{name}</span><strong>{fmt(flow.net)}</strong></p>)}</section>
      {[['Gastos por categoría', m.categories], ['Gastos por subcategoría', m.subcategories], ['Proveedores / contrapartes', m.counterparties]].map(([title, rows]) => <section key={title}><h4 className="text-sm font-semibold">{title}</h4>{Object.entries(rows).length ? Object.entries(rows).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, amount]) => <p key={name} className="flex justify-between gap-2 py-1 text-sm"><span>{name}</span><strong>{fmt(amount)}</strong></p>) : <p className="text-xs text-gray-500">Sin gastos operativos confirmados.</p>}</section>)}
    </div><p className="text-xs text-gray-500 mt-3">Consulta Gráficas para el análisis detallado.</p></details>
  </div>;
}
