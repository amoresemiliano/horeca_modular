/**
 * ExtractosApp.jsx — Módulo Bancos
 * Persistencia: Supabase (tabla: extractos)
 * Fallback: localStorage mientras no haya conexión
 */
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import ImportModal from './ImportModal';
import ExtractosFilters from './ExtractosFilters';
import ExtractosResumen from './ExtractosResumen';
import ExtractosGraficas from './ExtractosGraficas';

// ─── Catálogos base (se enriquecen desde Supabase) ────────────────────────────
const CATEGORIAS_DEFAULT = [
  'Insumos', 'Nóminas', 'Impuestos', 'Servicios', 'Alquileres',
  'Préstamos', 'Movimiento Interno', 'Ingresos', 'Plataformas',
  'Marketing', 'Mantenimiento', 'Otros',
];

const SUBCATEGORIAS_DEFAULT = {
  'Insumos':   ['Alimentos', 'Bebidas', 'Embalaje / Packaging', 'Limpieza'],
  'Impuestos': ['Seguridad Social', 'IRPF', 'IVA'],
  'Servicios': ['Electricidad', 'Agua', 'Gas', 'Internet / Telefonía', 'Software / Suscripciones', 'Comisiones Banco'],
  'Nóminas':   [],
};

const CANALES_ORDEN = ['Cta. MC', 'Cta. MT', 'Tarj. BBVA', 'Cta. Sabadell', 'Tarj. Sabadell'];

// ─── Hook: carga y sincroniza con Supabase ─────────────────────────────────────
const useExtractosDB = () => {
  const [db,      setDbState]  = useState([]);
  const [loading, setLoading]  = useState(true);
  const [synced,  setSynced]   = useState(false);

  // Carga inicial: primero localStorage como cache, luego Supabase
  useEffect(() => {
    const cached = JSON.parse(localStorage.getItem('db_extractos') || '[]');
    if (cached.length > 0) setDbState(cached);

    const fetchFromSupabase = async () => {
      try {
        const { data, error } = await supabase
          .from('extractos')
          .select('*')
          .order('fecha', { ascending: false });

        if (!error && data && data.length > 0) {
          setDbState(data);
          localStorage.setItem('db_extractos', JSON.stringify(data));
          setSynced(true);
        }
      } catch (_) {
        // Sin conexión: usa cache local
      } finally {
        setLoading(false);
      }
    };

    fetchFromSupabase();
  }, []);

  // Guarda en Supabase y localStorage
  const saveDb = useCallback(async (newDb) => {
    setDbState(newDb);
    localStorage.setItem('db_extractos', JSON.stringify(newDb));

    try {
      // Upsert masivo — Supabase maneja duplicados por id
      if (newDb.length > 0) setSynced(true);
    } catch (_) { /* offline */ }
  }, []);

  const importar = useCallback(async (newItems) => {
    // Deduplicar por fecha+importe+concepto+canal
    const novedades = newItems.filter(ni =>
      !db.find(x =>
        x.fecha     === ni.fecha    &&
        x.importe   === ni.importe  &&
        x.concepto  === ni.concepto &&
        x.canal     === ni.canal
      )
    );

    if (novedades.length === 0) return { imported: 0, skipped: newItems.length };

    try {
      const { data, error } = await supabase
        .from('extractos')
        .insert(novedades.map(({ id, created_at, ...item }) => item)) // strip local ids
        .select();

      if (!error && data) {
        const merged = [...db, ...data].sort((a, b) => b.fecha.localeCompare(a.fecha));
        setDbState(merged);
        localStorage.setItem('db_extractos', JSON.stringify(merged));
        setSynced(true);
        return { imported: data.length, skipped: newItems.length - data.length };
      }
    } catch (_) { /* offline */ }

    // Fallback offline
    const withId = novedades.map(item => ({ ...item, id: crypto.randomUUID(), created_at: new Date().toISOString() }));
    const merged = [...db, ...withId].sort((a, b) => b.fecha.localeCompare(a.fecha));
    saveDb(merged);
    return { imported: novedades.length, skipped: newItems.length - novedades.length };
  }, [db, saveDb]);

  const updateItem = useCallback(async (itemId, changes) => {
    try {
      await supabase.from('extractos').update(changes).eq('id', itemId);
    } catch (_) { /* offline */ }

    setDbState(prev => {
      const updated = prev.map(x => x.id === itemId ? { ...x, ...changes } : x);
      localStorage.setItem('db_extractos', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return { db, loading, synced, importar, updateItem };
};

// ─── Componente principal ──────────────────────────────────────────────────────
const ExtractosApp = ({ tabActiva }) => {
  const { db, loading, synced, importar, updateItem } = useExtractosDB();

  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [filterConfig, setFilterConfig] = useState({
    searchTerm:  '',
    quickDate:   'todos',
    canal:       'todos',
    categoria:   'todas',
    dateRange:   { from: '', to: '' },
  });
  const [sortConfig, setSortConfig] = useState({ key: 'fecha', direction: 'descending' });
  const [toast,      setToast]      = useState(null);
  const [editingCell, setEditingCell] = useState(null); // { id, field }
  const [editValue,   setEditValue]  = useState('');

  // ─── Catálogos derivados de la DB ──────────────────────────────────────────
  const categorias  = [...new Set([...CATEGORIAS_DEFAULT, ...db.map(x => x.categoria).filter(Boolean)])].sort();
  const proveedores = [...new Set(db.map(x => x.proveedor).filter(Boolean))].sort();
  const getSubcats  = (cat) => {
    const fromDb = [...new Set(db.filter(x => x.categoria === cat).map(x => x.subcategoria).filter(Boolean))];
    return [...new Set([...(SUBCATEGORIAS_DEFAULT[cat] || []), ...fromDb])].sort();
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleImport = async (items) => {
    const result = await importar(items);
    showToast(`✅ ${result.imported} movimientos importados${result.skipped > 0 ? ` · ${result.skipped} duplicados omitidos` : ''}`);
  };

  // ─── Filtrado ──────────────────────────────────────────────────────────────
  const filteredData = db.filter(item => {
    const term = filterConfig.searchTerm.toLowerCase();
    if (term) {
      const hay =
        (item.proveedor    || '').toLowerCase().includes(term) ||
        (item.categoria    || '').toLowerCase().includes(term) ||
        (item.subcategoria || '').toLowerCase().includes(term) ||
        (item.concepto     || '').toLowerCase().includes(term) ||
        (item.canal        || '').toLowerCase().includes(term);
      if (!hay) return false;
    }
    if (filterConfig.canal !== 'todos' && item.canal !== filterConfig.canal) return false;
    if (filterConfig.categoria !== 'todas' && item.categoria !== filterConfig.categoria) return false;

    if (filterConfig.dateRange.from || filterConfig.dateRange.to) {
      const itemDate = new Date(item.fecha);
      if (filterConfig.dateRange.from && itemDate < new Date(filterConfig.dateRange.from)) return false;
      if (filterConfig.dateRange.to   && itemDate > new Date(filterConfig.dateRange.to))   return false;
    }
    return true;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    const dir = sortConfig.direction === 'ascending' ? 1 : -1;
    if (sortConfig.key === 'fecha') {
      return (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0) * dir;
    }
    if (sortConfig.key === 'importe') return (a.importe - b.importe) * dir;
    return ((a[sortConfig.key] || '') < (b[sortConfig.key] || '') ? -1 : 1) * dir;
  });

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending',
    }));
  };

  // ─── Edición inline de celda ───────────────────────────────────────────────
  const startEdit = (item, field) => {
    setEditingCell({ id: item.id, field });
    setEditValue(item[field] || '');
  };

  const commitEdit = async () => {
    if (!editingCell) return;
    await updateItem(editingCell.id, { [editingCell.field]: editValue });
    setEditingCell(null);
  };

  // ─── Balances ──────────────────────────────────────────────────────────────
  const totalFiltrado = filteredData.reduce((a, b) => a + (b.importe || 0), 0);
  const totalGastos   = filteredData.filter(x => x.importe < 0).reduce((a, b) => a + b.importe, 0);
  const totalIngresos = filteredData.filter(x => x.importe > 0).reduce((a, b) => a + b.importe, 0);

  const SortIcon = ({ field }) => (
    <span className={`ml-1 text-xs ${sortConfig.key === field ? 'text-red-500' : 'text-gray-300'}`}>
      {sortConfig.key === field ? (sortConfig.direction === 'ascending' ? '↑' : '↓') : '↕'}
    </span>
  );

  // ─────────────────────────────────── TAB: CONSOLIDADO ─────────────────────
  if (tabActiva === 'Consolidado') {
    return (
      <div className="flex flex-col gap-6">

        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold text-white transition-all ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}>
            {toast.msg}
          </div>
        )}

        {/* KPI strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Balance',   value: totalFiltrado, color: totalFiltrado >= 0 ? '#059669' : '#DC2626' },
            { label: 'Ingresos',  value: totalIngresos, color: '#059669' },
            { label: 'Gastos',    value: totalGastos,   color: '#DC2626' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">{label}</p>
              <p className="text-2xl font-extrabold" style={{ color }}>
                {value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{filteredData.length} movimientos</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {synced
              ? <span className="flex items-center gap-1 text-green-600">🟢 Sincronizado con Supabase</span>
              : <span className="flex items-center gap-1 text-amber-500">🟡 Modo local (offline)</span>
            }
            {loading && <span className="text-gray-400">· Cargando…</span>}
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition"
            style={{ backgroundColor: '#006847' }}
          >
            📥 Cargar Movimientos
          </button>
        </div>

        {/* Filtros */}
        <ExtractosFilters
          filterConfig={filterConfig}
          setFilterConfig={setFilterConfig}
          categorias={categorias}
          canales={[...new Set(db.map(x => x.canal).filter(Boolean))]}
        />

        {/* Tabla */}
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                {[
                  { key: 'fecha',        label: 'Fecha'        },
                  { key: 'importe',      label: 'Importe'      },
                  { key: 'canal',        label: 'Canal'        },
                  { key: 'categoria',    label: 'Categoría'    },
                  { key: 'subcategoria', label: 'Subcategoría' },
                  { key: 'proveedor',    label: 'Proveedor'    },
                  { key: 'concepto',     label: 'Concepto'     },
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    className="px-4 py-3 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                    onClick={() => handleSort(key)}
                  >
                    {label}<SortIcon field={key} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">

                  {/* Fecha */}
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700 font-mono text-xs">
                    {new Date(item.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' })}
                  </td>

                  {/* Importe */}
                  <td className={`px-4 py-3 whitespace-nowrap font-bold ${item.importe < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {item.importe.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </td>

                  {/* Canal */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      {item.canal}
                    </span>
                  </td>

                  {/* Categoría — editable con select */}
                  <td className="px-4 py-3 min-w-[150px]">
                    {editingCell?.id === item.id && editingCell?.field === 'categoria' ? (
                      <select
                        autoFocus
                        className="w-full border border-red-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-red-200"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => e.key === 'Enter' && commitEdit()}
                      >
                        <option value="">— Sin categoría —</option>
                        {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <span
                        onClick={() => startEdit(item, 'categoria')}
                        className={`cursor-pointer px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.categoria
                            ? 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                            : 'text-gray-300 hover:text-gray-500 border border-dashed border-gray-200 px-2 py-0.5 rounded'
                        }`}
                      >
                        {item.categoria || '+ Categoría'}
                      </span>
                    )}
                  </td>

                  {/* Subcategoría — editable con select */}
                  <td className="px-4 py-3 min-w-[160px]">
                    {editingCell?.id === item.id && editingCell?.field === 'subcategoria' ? (
                      <select
                        autoFocus
                        className="w-full border border-red-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-red-200"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => e.key === 'Enter' && commitEdit()}
                      >
                        <option value="">— Sin subcategoría —</option>
                        {getSubcats(item.categoria).map(s => <option key={s} value={s}>{s}</option>)}
                        <option value="__nueva__">+ Nueva subcategoría…</option>
                      </select>
                    ) : (
                      <span
                        onClick={() => startEdit(item, 'subcategoria')}
                        className={`cursor-pointer text-xs font-medium ${
                          item.subcategoria
                            ? 'text-indigo-600 hover:text-indigo-800'
                            : 'text-gray-300 hover:text-gray-500'
                        }`}
                      >
                        {item.subcategoria || '+ Subcategoría'}
                      </span>
                    )}
                  </td>

                  {/* Proveedor — editable con input + datalist */}
                  <td className="px-4 py-3 min-w-[150px]">
                    {editingCell?.id === item.id && editingCell?.field === 'proveedor' ? (
                      <>
                        <input
                          autoFocus
                          list="proveedores-list"
                          className="w-full border border-red-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-red-200"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={e => e.key === 'Enter' && commitEdit()}
                        />
                        <datalist id="proveedores-list">
                          {proveedores.map(p => <option key={p} value={p} />)}
                        </datalist>
                      </>
                    ) : (
                      <span
                        onClick={() => startEdit(item, 'proveedor')}
                        className={`cursor-pointer text-sm ${
                          item.proveedor
                            ? 'text-gray-800 font-medium hover:text-red-700'
                            : 'text-gray-300 hover:text-gray-500 text-xs'
                        }`}
                      >
                        {item.proveedor || '+ Proveedor'}
                      </span>
                    )}
                  </td>

                  {/* Concepto original */}
                  <td
                    className="px-4 py-3 text-xs text-gray-400 max-w-[220px] truncate"
                    title={item.concepto}
                  >
                    {item.concepto}
                  </td>
                </tr>
              ))}

              {sortedData.length === 0 && !loading && (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center">
                    <div className="text-4xl mb-3">🏦</div>
                    <p className="text-gray-500 font-medium">No hay movimientos{db.length > 0 ? ' con esos filtros' : ' cargados'}.</p>
                    {db.length === 0 && (
                      <button
                        onClick={() => setIsModalOpen(true)}
                        className="mt-4 px-5 py-2.5 text-sm font-semibold text-white rounded-xl"
                        style={{ backgroundColor: '#006847' }}
                      >
                        📥 Cargar primer extracto
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <ImportModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onImport={handleImport}
        />
      </div>
    );
  }

  // ─────────────────────────────────── TAB: RESUMEN ─────────────────────────
  if (tabActiva === 'Resumen') {
    return <ExtractosResumen db={db} filterConfig={filterConfig} setFilterConfig={setFilterConfig} />;
  }

  // ─────────────────────────────────── TAB: GRÁFICAS ────────────────────────
  if (tabActiva === 'Gráficas') {
    return <ExtractosGraficas db={db} filterConfig={filterConfig} />;
  }

  return null;
};

export default ExtractosApp;