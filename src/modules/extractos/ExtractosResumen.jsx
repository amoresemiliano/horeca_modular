import React from 'react';

const ExtractosResumen = ({ db, filterConfig, setFilterConfig }) => {
  // Usamos la misma lógica de filtrado por fechas (pero no texto para los totales generales si no queremos)
  // Para este widget, nos fijaremos en el dateRange actual
  const filteredData = db.filter((item) => {
    if (filterConfig.dateRange.from || filterConfig.dateRange.to) {
      const [d, m, y] = item.fecha.includes('/') ? item.fecha.split('/') : item.fecha.split('-');
      const itemDate = new Date(`${y}-${m}-${d}`);
      if (filterConfig.dateRange.from && itemDate < new Date(filterConfig.dateRange.from)) return false;
      if (filterConfig.dateRange.to && itemDate > new Date(filterConfig.dateRange.to)) return false;
    }
    return true;
  });

  // Solo Gastos (importe < 0) para estas tablas analíticas
  const gastos = filteredData.filter(i => i.importe < 0);
  const totalGastos = gastos.reduce((acc, curr) => acc + curr.importe, 0);

  // Funciones de agrupación genérica
  const groupBy = (key) => {
    const groups = {};
    gastos.forEach(g => {
      const k = g[key] || 'Sin asignar';
      if(!groups[k]) groups[k] = 0;
      groups[k] += g.importe;
    });
    return Object.entries(groups).sort((a,b) => a[1] - b[1]); // orden asc (como son negativos, los mayores gastos quedan primero)
  };

  const porProveedor = groupBy('proveedor');
  const porCategoria = groupBy('categoria');
  const porSubcat = groupBy('subcategoria');

  return (
    <div className="space-y-6">
      {/* Selector de periodo rápido y Widget de Gastos Totales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 md:col-span-2 bg-gradient-to-r from-red-600 to-red-800 rounded-2xl p-6 text-white shadow-lg flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
          </div>
          <p className="text-red-100 uppercase tracking-widest text-sm font-bold mb-1">Total Gastos (Período Seleccionado)</p>
          <h2 className="text-5xl font-black">{totalGastos.toFixed(2)} €</h2>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 flex flex-col justify-center">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Seleccionar Período de Análisis</label>
          <select 
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-600 outline-none text-gray-700 font-medium"
            value={filterConfig.quickDate}
            onChange={(e) => {
              const val = e.target.value;
              let from = '', to = '';
              const today = new Date();
              if (val === 'mes_actual') {
                from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                to = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
              } else if (val === 'mes_pasado') {
                from = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
                to = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
              } else if (val === 'ano_actual') {
                from = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
                to = new Date(today.getFullYear(), 11, 31).toISOString().split('T')[0];
              }
              setFilterConfig({ ...filterConfig, quickDate: val, dateRange: { from, to } });
            }}
          >
            <option value="todos">Histórico Completo</option>
            <option value="mes_actual">Mes en Curso</option>
            <option value="mes_pasado">Mes Pasado</option>
            <option value="ano_actual">Año Actual</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryTable title="Gastos por Categoría" data={porCategoria} />
        <SummaryTable title="Gastos por Subcategoría" data={porSubcat} />
        <SummaryTable title="Gastos por Proveedor" data={porProveedor} />
      </div>
    </div>
  );
};

const SummaryTable = ({ title, data }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 font-bold text-gray-700">
      {title}
    </div>
    <div className="max-h-64 overflow-y-auto">
      <table className="min-w-full text-sm text-left">
        <tbody className="divide-y divide-gray-100">
          {data.map(([name, val], i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-800 font-medium">{name}</td>
              <td className="px-4 py-3 text-red-600 text-right font-bold">{val.toFixed(2)} €</td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr><td colSpan="2" className="px-4 py-6 text-center text-gray-400">Sin datos</td></tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export default ExtractosResumen;