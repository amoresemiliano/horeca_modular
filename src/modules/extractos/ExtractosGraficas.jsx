import React from 'react';

const ExtractosGraficas = ({ db, filterConfig }) => {
  const filteredData = db.filter((item) => {
    if (filterConfig.dateRange.from || filterConfig.dateRange.to) {
      const [d, m, y] = item.fecha.includes('/') ? item.fecha.split('/') : item.fecha.split('-');
      const itemDate = new Date(`${y}-${m}-${d}`);
      if (filterConfig.dateRange.from && itemDate < new Date(filterConfig.dateRange.from)) return false;
      if (filterConfig.dateRange.to && itemDate > new Date(filterConfig.dateRange.to)) return false;
    }
    return true;
  });

  const gastos = filteredData.filter(i => i.importe < 0);
  const totalGastos = Math.abs(gastos.reduce((acc, curr) => acc + curr.importe, 0)) || 1; // evitar division por 0

  const groupBy = (key) => {
    const groups = {};
    gastos.forEach(g => {
      const k = g[key] || 'Sin asignar';
      if(!groups[k]) groups[k] = 0;
      groups[k] += Math.abs(g.importe);
    });
    return Object.entries(groups).sort((a,b) => b[1] - a[1]).slice(0, 5); // Top 5
  };

  const topCats = groupBy('categoria');
  const topProvs = groupBy('proveedor');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChart title="Distribución por Categoría" data={topCats} total={totalGastos} />
        <BarChart title="Distribución por Proveedor" data={topProvs} total={totalGastos} />
      </div>
    </div>
  );
};

const BarChart = ({ title, data, total }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
    <h3 className="text-lg font-bold text-gray-800 mb-6">{title} (Top 5)</h3>
    <div className="space-y-5">
      {data.map(([name, val], i) => {
        const pct = Math.min(100, Math.max(0, (val / total) * 100)).toFixed(1);
        return (
          <div key={i}>
            <div className="flex justify-between text-sm mb-1 font-medium">
              <span className="text-gray-700 truncate w-2/3">{name}</span>
              <span className="text-gray-900">{val.toFixed(2)} € ({pct}%)</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div className="bg-red-500 h-3 rounded-full" style={{ width: `${pct}%` }}></div>
            </div>
          </div>
        );
      })}
      {data.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No hay datos suficientes para graficar.</p>}
    </div>
  </div>
);

export default ExtractosGraficas;