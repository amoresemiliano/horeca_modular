/**
 * ExtractosResumen.jsx — Resumen PyG y Estadísticas Económicas (Track A)
 * Genera el informe de Pérdidas y Ganancias (PyG) dinámico
 * Excluye correctamente:
 *  - Transferencias internas (Movimientos entre cuentas propias)
 *  - Liquidaciones de tarjeta reconciliadas (Evitando doble contabilización del gasto)
 *  - Registros eliminados lógicamente (Soft deleted)
 */
import React, { useState } from 'react';

const ExtractosResumen = ({ movements = [], categories = [], subcategories = [] }) => {
  const [selectedMonth, setSelectedMonth] = useState('todos');

  // Helper map category ID -> object
  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]));

  // Flatten active allocations from non-deleted movements
  const allAllocations = movements.flatMap(m => {
    return (m.allocations || []).map(alloc => ({
      ...alloc,
      movement_fecha: m.fecha,
      source_account: m.source_account,
      original_description: m.descripcion,
      duplicate_status: m.duplicate_status,
    }));
  });

  // Filter out internal transfers and card settlements from PyG calculation
  const pygAllocations = allAllocations.filter(a => {
    if (a.is_internal_transfer) return false;
    if (a.is_card_settlement) return false;
    if (a.reconciliation_status === 'CONFIRMED' && (a.reconciliation_type === 'INTERNAL_TRANSFER' || a.reconciliation_type === 'CARD_SETTLEMENT')) return false;

    if (selectedMonth !== 'todos') {
      const monthStr = a.movement_fecha?.substring(0, 7);
      if (monthStr !== selectedMonth) return false;
    }
    return true;
  });

  // Extract available months for selector
  const availableMonths = [...new Set(movements.map(m => m.fecha?.substring(0, 7)).filter(Boolean))].sort().reverse();

  // Aggregate PyG data by Category
  const incomeAllocations = pygAllocations.filter(a => a.monto > 0);
  const expenseAllocations = pygAllocations.filter(a => a.monto < 0);

  const totalIncome = incomeAllocations.reduce((acc, a) => acc + a.monto, 0);
  const totalExpense = Math.abs(expenseAllocations.reduce((acc, a) => acc + a.monto, 0));
  const netMargin = totalIncome - totalExpense;

  // Breakdown by Category
  const expenseByCategory = {};
  expenseAllocations.forEach(a => {
    const catName = categoryMap[a.category_id]?.name || 'Sin Categorizar';
    if (!expenseByCategory[catName]) {
      expenseByCategory[catName] = { total: 0, count: 0, categoryId: a.category_id };
    }
    expenseByCategory[catName].total += Math.abs(a.monto);
    expenseByCategory[catName].count += 1;
  });

  const sortedExpenses = Object.entries(expenseByCategory).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="flex flex-col gap-6">

      {/* Header & Month Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">📊 Cuenta de Pérdidas y Ganancias (PyG)</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Cálculo dinámico basado en asignaciones económicas confirmadas (Excluye transferencias internas y liquidaciones)
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="font-semibold text-gray-700">Período:</label>
          <select
            className="border border-gray-300 rounded-xl px-3 py-1.5 font-semibold text-gray-800 bg-white"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
          >
            <option value="todos">Todos los meses</option>
            {availableMonths.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Ingresos Operativos</p>
          <p className="text-2xl font-black text-emerald-600">
            {totalIncome.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </p>
          <p className="text-xs text-gray-400 mt-1">{incomeAllocations.length} movimientos de ingreso</p>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Gastos Operativos</p>
          <p className="text-2xl font-black text-rose-600">
            {totalExpense.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </p>
          <p className="text-xs text-gray-400 mt-1">{expenseAllocations.length} movimientos de gasto</p>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Resultado Neto</p>
          <p className={`text-2xl font-black ${netMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {netMargin.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </p>
          <p className="text-xs text-gray-400 mt-1">Margen Neto Operativo</p>
        </div>
      </div>

      {/* Category Expense Breakdown Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Desglose de Gastos por Categoría Económica</h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Categoría</th>
                <th className="px-4 py-3 font-semibold">Nº Asignaciones</th>
                <th className="px-4 py-3 font-semibold text-right">Importe Total (€)</th>
                <th className="px-4 py-3 font-semibold text-right">% sobre Total Gastos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedExpenses.map(([catName, data]) => {
                const pct = totalExpense > 0 ? (data.total / totalExpense) * 100 : 0;
                return (
                  <tr key={catName} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-800">{catName}</td>
                    <td className="px-4 py-3 text-gray-500">{data.count}</td>
                    <td className="px-4 py-3 font-bold text-rose-600 text-right">
                      {data.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-semibold text-gray-700">{pct.toFixed(1)}%</span>
                        <div className="w-16 bg-gray-200 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-rose-500 h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {sortedExpenses.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-4 py-8 text-center text-gray-400">
                    No hay gastos clasificados en el período seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default ExtractosResumen;