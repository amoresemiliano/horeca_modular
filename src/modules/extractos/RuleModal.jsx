/**
 * RuleModal.jsx — Modal de Gestión de Reglas Determinísticas (Track A)
 * Permite crear y administrar reglas de auto-clasificación por patrón de texto,
 * asignando automáticamente contraparte, categoría y subcategoría.
 */
import React, { useState } from 'react';

const RuleModal = ({ isOpen, onClose, initialPattern = '', categories = [], subcategories = [], counterparties = [], onCreateRule }) => {
  const [pattern, setPattern] = useState(initialPattern);
  const [matchSign, setMatchSign] = useState('ALL'); // ALL, POSITIVE, NEGATIVE
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [counterpartyId, setCounterpartyId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const availSubcats = subcategories.filter(s => s.category_id === categoryId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pattern.trim()) {
      setError('Por favor ingresa un patrón de texto para coincidencia.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onCreateRule({
        pattern,
        matchSign,
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        counterpartyId: counterpartyId || null,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Error al guardar la regla.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">⚙️ Crear Regla de Clasificación</h2>
            <p className="text-xs text-gray-500 mt-0.5">Asigna automáticamente clasificaciones a movimientos futuros similares</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Patrón de Texto */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Patrón de Texto (Buscar en concepto)
            </label>
            <input
              type="text"
              placeholder="Ej: MAKRO, UBER, TGSS, NÓMINA..."
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold text-gray-900"
              value={pattern}
              onChange={e => setPattern(e.target.value)}
              required
            />
            <p className="text-[11px] text-gray-400 mt-1">Coincidencia insensible a mayúsculas/minúsculas</p>
          </div>

          {/* Signo del Movimiento */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Aplica a
            </label>
            <select
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800"
              value={matchSign}
              onChange={e => setMatchSign(e.target.value)}
            >
              <option value="ALL">Todos los movimientos (Ingresos y Gastos)</option>
              <option value="NEGATIVE">Solo Gastos (-)</option>
              <option value="POSITIVE">Solo Ingresos (+)</option>
            </select>
          </div>

          {/* Contraparte a Asignar */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Asignar Contraparte
            </label>
            <select
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800"
              value={counterpartyId}
              onChange={e => setCounterpartyId(e.target.value)}
            >
              <option value="">— Ninguna —</option>
              {counterparties.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
              ))}
            </select>
          </div>

          {/* Categoría a Asignar */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Asignar Categoría Económica
            </label>
            <select
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800"
              value={categoryId}
              onChange={e => {
                setCategoryId(e.target.value);
                setSubcategoryId('');
              }}
            >
              <option value="">— Ninguna —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Subcategoría a Asignar */}
          {categoryId && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Asignar Subcategoría
              </label>
              <select
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800"
                value={subcategoryId}
                onChange={e => setSubcategoryId(e.target.value)}
              >
                <option value="">— Ninguna —</option>
                {availSubcats.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs">
              ⚠️ {error}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 text-xs font-semibold text-white rounded-xl disabled:opacity-40"
              style={{ backgroundColor: '#006847' }}
            >
              {loading ? 'Guardando...' : 'Crear Regla'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default RuleModal;
