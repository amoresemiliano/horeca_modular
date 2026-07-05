import React from 'react';

const ExtractosFilters = ({ filterConfig, setFilterConfig, categorias = [], canales = [] }) => {
  const set = (key, value) => setFilterConfig(prev => ({ ...prev, [key]: value }));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex flex-wrap gap-3 items-end">

        {/* Búsqueda libre */}
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Buscar</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Proveedor, categoría, concepto…"
              value={filterConfig.searchTerm}
              onChange={e => set('searchTerm', e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300"
            />
          </div>
        </div>

        {/* Canal */}
        {canales.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Canal</label>
            <select
              value={filterConfig.canal || 'todos'}
              onChange={e => set('canal', e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
            >
              <option value="todos">Todos los canales</option>
              {canales.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* Categoría */}
        {categorias.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Categoría</label>
            <select
              value={filterConfig.categoria || 'todas'}
              onChange={e => set('categoria', e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
            >
              <option value="todas">Todas las categorías</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* Rango de fechas */}
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Desde</label>
            <input
              type="date"
              value={filterConfig.dateRange?.from || ''}
              onChange={e => set('dateRange', { ...filterConfig.dateRange, from: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Hasta</label>
            <input
              type="date"
              value={filterConfig.dateRange?.to || ''}
              onChange={e => set('dateRange', { ...filterConfig.dateRange, to: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </div>
        </div>

        {/* Reset */}
        <button
          onClick={() => setFilterConfig({ searchTerm: '', canal: 'todos', categoria: 'todas', quickDate: 'todos', dateRange: { from: '', to: '' } })}
          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
          title="Limpiar filtros"
        >
          ✕ Limpiar
        </button>
      </div>
    </div>
  );
};

export default ExtractosFilters;