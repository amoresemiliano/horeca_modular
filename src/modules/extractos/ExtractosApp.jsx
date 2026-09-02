/**
 * ExtractosApp.jsx — Módulo de Extractos Bancarios & Finanzas (Track A)
 * Integrado con Supabase Staging multi-tenant, origen inmutable, asignación económica editable,
 * motor de reglas determinísticas, splits balanceados, reconciliación y PyG dinámico.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  getExtractosCatalogs,
  fetchConsolidatedMovements,
  updateAllocationClassification,
  createClassificationRule,
  splitMovementAllocations,
  reconcileMovements,
  softDeleteMovement,
  findOrCreateCounterparty
} from '../../lib/extractosService';
import ImportModal from './ImportModal';
import SplitModal from './SplitModal';
import RuleModal from './RuleModal';
import ExtractosResumen from './ExtractosResumen';
import ExtractosGraficas from './ExtractosGraficas';

const ExtractosApp = ({ tabActiva }) => {
  const [movements, setMovements] = useState([]);
  const [catalogs, setCatalogs] = useState({ accounts: [], categories: [], subcategories: [], counterparties: [], rules: [] });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [selectedMovementForSplit, setSelectedMovementForSplit] = useState(null);
  const [ruleInitialPattern, setRuleInitialPattern] = useState('');

  // Filters state
  const [filterConfig, setFilterConfig] = useState({
    searchTerm: '',
    accountCode: 'todos',
    categoryId: 'todas',
    status: 'todos',
  });
  const [sortConfig, setSortConfig] = useState({ key: 'fecha', direction: 'descending' });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Carga inicial desde Supabase
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [catsData, movsData] = await Promise.all([
        getExtractosCatalogs(),
        fetchConsolidatedMovements()
      ]);
      setCatalogs(catsData);
      setMovements(movsData);
    } catch (err) {
      showToast('Error al cargar datos de Supabase: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handler tras importación exitosa
  const handleImportCompleted = (summary) => {
    showToast(`✅ ${summary.imported} movimientos importados${summary.overlaps > 0 ? ` · ${summary.overlaps} posibles solapamientos detectados` : ''}`);
    loadData();
  };

  // Clasificación rápida inline
  const handleInlineClassification = async (allocationId, categoryId, subcategoryId, counterpartyName) => {
    try {
      let counterpartyId = undefined;
      if (counterpartyName) {
        counterpartyId = await findOrCreateCounterparty(counterpartyName);
      }

      await updateAllocationClassification({
        allocationId,
        categoryId,
        subcategoryId,
        counterpartyId,
        status: 'CONFIRMED',
      });
      showToast('Asignación económica confirmada');
      loadData();
    } catch (err) {
      showToast('Error al clasificar: ' + err.message, 'error');
    }
  };

  // Iniciar creación de regla a partir de movimiento
  const handleOpenRuleForMovement = (movement) => {
    const pattern = movement.descripcion?.split(' ')[0] || movement.descripcion || '';
    setRuleInitialPattern(pattern);
    setIsRuleModalOpen(true);
  };

  // Crear Regla
  const handleCreateRule = async (rulePayload) => {
    await createClassificationRule(rulePayload);
    showToast('Regla determinística creada correctamente');
    loadData();
  };

  // Iniciar Split
  const handleOpenSplit = (movement) => {
    setSelectedMovementForSplit(movement);
    setIsSplitModalOpen(true);
  };

  // Confirmar Split
  const handleConfirmSplit = async (movementId, origAmount, allocations) => {
    await splitMovementAllocations(movementId, origAmount, allocations);
    showToast('Split registrado e integrado correctamente');
    loadData();
  };

  // Reconciliación Transferencia / Tarjeta
  const handleToggleInternalTransfer = async (allocation) => {
    try {
      const newStatus = !allocation.is_internal_transfer;
      await reconcileMovements({
        allocationId: allocation.id,
        targetMovementId: null,
        reconciliationType: newStatus ? 'INTERNAL_TRANSFER' : null,
      });
      showToast(newStatus ? 'Marcado como Transferencia Interna (Excluido de PyG)' : 'Transferencia Interna desmarcada');
      loadData();
    } catch (err) {
      showToast('Error en reconciliación: ' + err.message, 'error');
    }
  };

  // Soft delete movimiento
  const handleDeleteMovement = async (movementId) => {
    if (!window.confirm('¿Seguro que deseas eliminar este movimiento bancario? (Soft delete)')) return;
    try {
      await softDeleteMovement(movementId);
      showToast('Movimiento eliminado correctamente');
      loadData();
    } catch (err) {
      showToast('Error al eliminar: ' + err.message, 'error');
    }
  };

  // Filtrado de movimientos
  const filteredMovements = movements.filter(m => {
    const term = filterConfig.searchTerm.toLowerCase();
    const primaryAlloc = m.allocations?.[0] || {};
    const catName = primaryAlloc.category?.name || '';
    const cpName = primaryAlloc.counterparty?.name || '';

    if (term) {
      const match =
        (m.descripcion || '').toLowerCase().includes(term) ||
        catName.toLowerCase().includes(term) ||
        cpName.toLowerCase().includes(term);
      if (!match) return false;
    }

    if (filterConfig.accountCode !== 'todos' && m.source_account?.code !== filterConfig.accountCode) return false;
    if (filterConfig.categoryId !== 'todas' && primaryAlloc.category_id !== filterConfig.categoryId) return false;
    if (filterConfig.status !== 'todos' && primaryAlloc.classification_status !== filterConfig.status) return false;

    return true;
  });

  // Ordenación
  const sortedMovements = [...filteredMovements].sort((a, b) => {
    const dir = sortConfig.direction === 'ascending' ? 1 : -1;
    if (sortConfig.key === 'fecha') return (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0) * dir;
    if (sortConfig.key === 'monto') return (a.monto - b.monto) * dir;
    return ((a.descripcion || '') < (b.descripcion || '') ? -1 : 1) * dir;
  });

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending',
    }));
  };

  // Balances globales
  const totalBalance = filteredMovements.reduce((acc, m) => acc + (m.monto || 0), 0);
  const totalIncome = filteredMovements.filter(m => m.monto > 0).reduce((acc, m) => acc + m.monto, 0);
  const totalExpense = filteredMovements.filter(m => m.monto < 0).reduce((acc, m) => acc + m.monto, 0);

  // ────────────────────────────────── TAB: CONSOLIDADO ────────────────────────
  if (tabActiva === 'Consolidado') {
    return (
      <div className="flex flex-col gap-6">

        {/* Toast Notification */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-xs font-bold text-white ${
            toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
          }`}>
            {toast.msg}
          </div>
        )}

        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <p className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold mb-1">Balance Consolidado</p>
            <p className={`text-2xl font-black ${totalBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {totalBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
            </p>
            <p className="text-xs text-gray-400 mt-1">{filteredMovements.length} movimientos activos</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <p className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold mb-1">Total Ingresos</p>
            <p className="text-2xl font-black text-emerald-600">
              {totalIncome.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
            </p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <p className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold mb-1">Total Gastos</p>
            <p className="text-2xl font-black text-rose-600">
              {totalExpense.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
            </p>
          </div>
        </div>

        {/* Toolbar & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              🟢 Supabase Staging Activo
            </span>
            {loading && <span className="text-xs text-gray-400">Cargando...</span>}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRuleModalOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition"
            >
              ⚙️ Reglas ({catalogs.rules.length})
            </button>

            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition"
              style={{ backgroundColor: '#006847' }}
            >
              📥 Cargar Extractos (.xls/.xlsx)
            </button>
          </div>
        </div>

        {/* Filtros Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200">
          <input
            type="text"
            placeholder="Buscar por concepto o contraparte..."
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs bg-white text-gray-800"
            value={filterConfig.searchTerm}
            onChange={e => setFilterConfig(prev => ({ ...prev, searchTerm: e.target.value }))}
          />

          <select
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs bg-white text-gray-800"
            value={filterConfig.accountCode}
            onChange={e => setFilterConfig(prev => ({ ...prev, accountCode: e.target.value }))}
          >
            <option value="todos">Todos los Canales Bancarios</option>
            {catalogs.accounts.map(a => (
              <option key={a.id} value={a.code}>{a.name}</option>
            ))}
          </select>

          <select
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs bg-white text-gray-800"
            value={filterConfig.categoryId}
            onChange={e => setFilterConfig(prev => ({ ...prev, categoryId: e.target.value }))}
          >
            <option value="todas">Todas las Categorías</option>
            {catalogs.categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs bg-white text-gray-800"
            value={filterConfig.status}
            onChange={e => setFilterConfig(prev => ({ ...prev, status: e.target.value }))}
          >
            <option value="todos">Todos los Estados</option>
            <option value="PENDING">Pendientes</option>
            <option value="SUGGESTED">Sugeridos</option>
            <option value="CONFIRMED">Confirmados</option>
          </select>
        </div>

        {/* Movements Table */}
        <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-gray-200">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('fecha')}>Fecha ↕</th>
                <th className="px-4 py-3">Canal</th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('monto')}>Importe ↕</th>
                <th className="px-4 py-3">Concepto Bancario (Inmutable)</th>
                <th className="px-4 py-3">Contraparte</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedMovements.map(m => {
                const primaryAlloc = m.allocations?.[0] || {};
                const isSplit = m.allocations && m.allocations.length > 1;
                const isOverlap = m.duplicate_status === 'POTENTIAL_OVERLAP';

                return (
                  <tr key={m.id} className={`hover:bg-gray-50 transition-colors ${isOverlap ? 'bg-amber-50/40' : ''}`}>
                    
                    {/* Fecha */}
                    <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{m.fecha}</td>

                    {/* Canal */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                        {m.source_account?.name || m.source_type}
                      </span>
                    </td>

                    {/* Importe */}
                    <td className={`px-4 py-3 font-extrabold whitespace-nowrap ${m.monto >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {m.monto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </td>

                    {/* Concepto Inmutable */}
                    <td className="px-4 py-3 max-w-[260px]" title={m.descripcion}>
                      <div className="truncate font-medium text-gray-900">{m.descripcion}</div>
                      {isOverlap && (
                        <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                          ⚠️ Posible Solapamiento
                        </span>
                      )}
                    </td>

                    {/* Contraparte editable */}
                    <td className="px-4 py-3 min-w-[140px]">
                      <span className="text-gray-800 font-medium">
                        {primaryAlloc.counterparty?.name || '—'}
                      </span>
                    </td>

                    {/* Categoría editable */}
                    <td className="px-4 py-3 min-w-[150px]">
                      {isSplit ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800">
                          ✂️ Split ({m.allocations.length} líneas)
                        </span>
                      ) : (
                        <select
                          className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white text-gray-800 focus:ring-1 focus:ring-green-500"
                          value={primaryAlloc.category_id || ''}
                          onChange={e => handleInlineClassification(primaryAlloc.id, e.target.value, primaryAlloc.subcategory_id, primaryAlloc.counterparty?.name)}
                        >
                          <option value="">— Sin categoría —</option>
                          {catalogs.categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      )}
                    </td>

                    {/* Estado Badges */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {primaryAlloc.is_internal_transfer ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          🔄 Traspaso Interno
                        </span>
                      ) : primaryAlloc.classification_status === 'CONFIRMED' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          ✓ Confirmado
                        </span>
                      ) : primaryAlloc.classification_status === 'SUGGESTED' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          ⚡ Sugerido ({primaryAlloc.classification_source})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">
                           Pendiente
                        </span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                      <button
                        onClick={() => handleOpenSplit(m)}
                        title="Dividir en N líneas (Split)"
                        className="px-2 py-1 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg"
                      >
                        ✂️ Split
                      </button>

                      <button
                        onClick={() => handleOpenRuleForMovement(m)}
                        title="Crear regla determinística para movimientos similares"
                        className="px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg"
                      >
                        ⚙️ Regla
                      </button>

                      <button
                        onClick={() => handleToggleInternalTransfer(primaryAlloc)}
                        title="Marcar/Desmarcar como transferencia interna entre cuentas propias"
                        className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                      >
                        🔄 Traspaso
                      </button>

                      <button
                        onClick={() => handleDeleteMovement(m.id)}
                        title="Eliminar movimiento (Soft Delete)"
                        className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded-lg"
                      >
                        🗑️
                      </button>
                    </td>

                  </tr>
                );
              })}

              {sortedMovements.length === 0 && !loading && (
                <tr>
                  <td colSpan="8" className="px-6 py-16 text-center">
                    <div className="text-4xl mb-3">🏦</div>
                    <p className="text-gray-500 font-medium">No hay movimientos bancarios cargados en esta vista.</p>
                    <button
                      onClick={() => setIsImportModalOpen(true)}
                      className="mt-4 px-5 py-2 text-xs font-bold text-white rounded-xl"
                      style={{ backgroundColor: '#006847' }}
                    >
                      📥 Cargar primer extracto
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modals */}
        <ImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImportCompleted={handleImportCompleted}
        />

        <SplitModal
          isOpen={isSplitModalOpen}
          onClose={() => setIsSplitModalOpen(false)}
          movement={selectedMovementForSplit}
          categories={catalogs.categories}
          subcategories={catalogs.subcategories}
          counterparties={catalogs.counterparties}
          onConfirmSplit={handleConfirmSplit}
        />

        <RuleModal
          isOpen={isRuleModalOpen}
          onClose={() => setIsRuleModalOpen(false)}
          initialPattern={ruleInitialPattern}
          categories={catalogs.categories}
          subcategories={catalogs.subcategories}
          counterparties={catalogs.counterparties}
          onCreateRule={handleCreateRule}
        />

      </div>
    );
  }

  // ────────────────────────────────── TAB: RESUMEN (PyG) ─────────────────────
  if (tabActiva === 'Resumen') {
    return (
      <ExtractosResumen
        movements={movements}
        categories={catalogs.categories}
        subcategories={catalogs.subcategories}
      />
    );
  }

  // ────────────────────────────────── TAB: GRÁFICAS ──────────────────────────
  if (tabActiva === 'Gráficas') {
    return <ExtractosGraficas db={movements} filterConfig={filterConfig} />;
  }

  return null;
};

export default ExtractosApp;