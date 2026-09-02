/**
 * SplitModal.jsx — Modal de División / Split Económico (Track A)
 * Permite dividir un movimiento bancario en N asignaciones económicas
 * Garantiza integridad matemática: la suma de las divisiones debe ser igual al importe original.
 */
import React, { useState, useEffect } from 'react';

const SplitModal = ({ isOpen, onClose, movement, categories, subcategories, counterparties, onConfirmSplit }) => {
  const [allocations, setAllocations] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (movement) {
      const origAmount = movement.monto || 0;
      const initialSplits = (movement.allocations && movement.allocations.length > 0)
        ? movement.allocations.map(a => ({
            id: a.id,
            monto: a.monto,
            category_id: a.category_id || '',
            subcategory_id: a.subcategory_id || '',
            counterparty_id: a.counterparty_id || '',
            notes: a.notes || ''
          }))
        : [
            { monto: (origAmount * 0.8).toFixed(2), category_id: '', subcategory_id: '', counterparty_id: '', notes: 'Línea 1' },
            { monto: (origAmount * 0.2).toFixed(2), category_id: '', subcategory_id: '', counterparty_id: '', notes: 'Línea 2' },
          ];
      setAllocations(initialSplits);
      setError('');
    }
  }, [movement]);

  if (!isOpen || !movement) return null;

  const originalAmount = movement.monto || 0;
  const currentSum = allocations.reduce((acc, a) => acc + (parseFloat(a.monto) || 0), 0);
  const diff = originalAmount - currentSum;
  const isBalanced = Math.abs(diff) < 0.01;

  const handleAddLine = () => {
    setAllocations(prev => [
      ...prev,
      { monto: diff.toFixed(2), category_id: '', subcategory_id: '', counterparty_id: '', notes: `Línea ${prev.length + 1}` }
    ]);
  };

  const handleRemoveLine = (index) => {
    if (allocations.length <= 1) return;
    setAllocations(prev => prev.filter((_, i) => i !== index));
  };

  const handleChange = (index, field, value) => {
    setAllocations(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSubmit = async () => {
    if (!isBalanced) {
      setError(`La suma (${currentSum.toFixed(2)} €) no coincide con el importe del movimiento (${originalAmount.toFixed(2)} €). Diferencia: ${diff.toFixed(2)} €`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onConfirmSplit(movement.id, originalAmount, allocations);
      onClose();
    } catch (err) {
      setError(err.message || 'Error al guardar el split');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">✂️ Dividir Movimiento (Split)</h2>
            <p className="text-xs text-gray-500 mt-1">
              Movimiento original: <strong className="font-mono text-gray-800">{movement.descripcion}</strong> ({movement.fecha})
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
            ✕
          </button>
        </div>

        {/* Balance Status Banner */}
        <div className={`px-6 py-3 border-b flex items-center justify-between text-sm ${
          isBalanced ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          <div>
            <span>Original: <strong>{originalAmount.toFixed(2)} €</strong></span>
            <span className="mx-2">|</span>
            <span>Suma Split: <strong>{currentSum.toFixed(2)} €</strong></span>
          </div>
          <div className="font-semibold">
            {isBalanced ? (
              <span className="text-green-700">✓ Balanceado</span>
            ) : (
              <span className="text-red-600">Diferencia: {diff.toFixed(2)} €</span>
            )}
          </div>
        </div>

        {/* Allocations Form Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {allocations.map((alloc, idx) => {
            const availSubcats = subcategories.filter(s => s.category_id === alloc.category_id);
            return (
              <div key={idx} className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-gray-500">Línea #{idx + 1}</span>
                  {allocations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      className="text-xs text-red-500 hover:text-red-700 font-semibold"
                    >
                      Eliminar línea
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {/* Importe */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Importe (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-900"
                      value={alloc.monto}
                      onChange={e => handleChange(idx, 'monto', e.target.value)}
                    />
                  </div>

                  {/* Categoría */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Categoría</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-800"
                      value={alloc.category_id}
                      onChange={e => handleChange(idx, 'category_id', e.target.value)}
                    >
                      <option value="">— Seleccionar —</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Subcategoría */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Subcategoría</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-800"
                      value={alloc.subcategory_id}
                      onChange={e => handleChange(idx, 'subcategory_id', e.target.value)}
                    >
                      <option value="">— Seleccionar —</option>
                      {availSubcats.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Contraparte */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Contraparte</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-800"
                      value={alloc.counterparty_id}
                      onChange={e => handleChange(idx, 'counterparty_id', e.target.value)}
                    >
                      <option value="">— Seleccionar —</option>
                      {counterparties.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Notas */}
                <div>
                  <input
                    type="text"
                    placeholder="Notas auxiliares para esta línea..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-1 text-xs text-gray-600 bg-white"
                    value={alloc.notes}
                    onChange={e => handleChange(idx, 'notes', e.target.value)}
                  />
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={handleAddLine}
            className="w-full py-2 border-2 border-dashed border-gray-300 hover:border-gray-400 rounded-xl text-xs font-semibold text-gray-600 bg-white hover:bg-gray-50 transition"
          >
            + Añadir otra línea de split
          </button>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-900"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isBalanced || loading}
            className="px-6 py-2 text-xs font-semibold text-white rounded-xl disabled:opacity-40"
            style={{ backgroundColor: '#006847' }}
          >
            {loading ? 'Guardando...' : 'Confirmar Split'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SplitModal;
