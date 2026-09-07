/**
 * ImportModal.jsx — Modal de Importación Multi-Formato Bancario (Track A)
 * Soporta archivos .xls y .xlsx de BBVA y Sabadell.
 * Detecta automáticamente origen, nivel A duplicados (SHA256), nivel C solapamientos económicos.
 */
import React, { useRef, useState } from 'react';
import { parseBankStatementFile, ACCOUNTS_CONFIG } from '../../lib/bankParsers';
import { checkFileDuplicate, importBankStatementData } from '../../lib/extractosService';

const ImportModal = ({ isOpen, onClose, onImportCompleted }) => {
  const fileRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [parseResult, setParseResult] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleFileSelect = async (file) => {
    if (!file) return;
    setSelectedFile(file);
    setError('');
    setDuplicateWarning(null);
    setParseResult(null);
    setLoading(true);

    try {
      const buffer = await file.arrayBuffer();
      const result = await parseBankStatementFile(buffer, file.name);

      if (result.movements.length === 0) {
        setError('No se pudieron extraer movimientos válidos del archivo. Verifica que el archivo contenga datos bancarios de BBVA o Sabadell.');
        setLoading(false);
        return;
      }

      // Level A — File Duplicate Check
      const fileDup = await checkFileDuplicate(result.file_hash);
      if (fileDup.isDuplicate) {
        setDuplicateWarning(`Este archivo exacto ya fue importado anteriormente (${new Date(fileDup.file.created_at).toLocaleDateString('es-ES')}). Re-importar solo registrará los movimientos sin duplicar datos.`);
      }

      setParseResult(result);
    } catch (err) {
      setError(`Error al leer archivo Excel: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = async () => {
    if (!parseResult) return;
    setLoading(true);
    setError('');
    try {
      const summary = await importBankStatementData(parseResult);
      onImportCompleted(summary);
      handleReset();
      onClose();
    } catch (err) {
      setError(`Error durante la importación: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setParseResult(null);
    setDuplicateWarning(null);
    setError('');
  };

  const handleCloseModal = () => {
    handleReset();
    onClose();
  };

  const totalAmount = parseResult ? parseResult.movements.reduce((acc, m) => acc + m.monto, 0) : 0;
  const incomeCount = parseResult ? parseResult.movements.filter(m => m.monto > 0).length : 0;
  const expenseCount = parseResult ? parseResult.movements.filter(m => m.monto < 0).length : 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">📥 Importar Extracto Bancario</h2>
            <p className="text-xs text-gray-500 mt-0.5">Soporta archivos .xls y .xlsx descargados de BBVA y Sabadell</p>
          </div>
          <button onClick={handleCloseModal} className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Drop Zone */}
          {!parseResult && (
            <div>
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-300 hover:border-green-600 hover:bg-green-50 rounded-2xl p-8 text-center cursor-pointer transition-all"
              >
                <div className="text-4xl mb-3">📄</div>
                <p className="text-sm font-semibold text-gray-800">
                  Arrastra aquí tu archivo bancario o haz clic para seleccionar
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  BBVA Cta MC/MT · BBVA Tarjeta · Sabadell Cta · Sabadell Tarjeta (.xls / .xlsx)
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xls,.xlsx"
                className="hidden"
                onChange={e => handleFileSelect(e.target.files[0])}
              />
            </div>
          )}

          {/* Spinner */}
          {loading && (
            <div className="py-8 text-center text-sm font-medium text-gray-500">
              ⏳ Analizando estructura y hashes del archivo...
            </div>
          )}

          {/* Warning File Duplicate (Nivel A) */}
          {duplicateWarning && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-xs flex items-start gap-2">
              <span className="text-lg">⚠️</span>
              <div>
                <p className="font-semibold mb-0.5">Archivo Re-importado Detectado</p>
                <p>{duplicateWarning}</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-xs">
              ⚠️ {error}
            </div>
          )}

          {/* Preview Analysis Summary */}
          {parseResult && (
            <div className="space-y-4">
              {/* Account Detected Banner */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Fuente Detectada</span>
                  <span className="text-base font-bold text-gray-800">{parseResult.account_meta.name}</span>
                  <span className="text-xs text-gray-500 block mt-0.5">Archivo: {parseResult.file_name}</span>
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline"
                >
                  Cambiar archivo
                </button>
              </div>

              {/* Stats Summary Grid */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white border rounded-xl p-3 shadow-sm">
                  <p className="text-xs text-gray-400 font-medium uppercase">Movimientos</p>
                  <p className="text-xl font-bold text-gray-800">{parseResult.movements.length}</p>
                </div>
                <div className="bg-white border rounded-xl p-3 shadow-sm">
                  <p className="text-xs text-gray-400 font-medium uppercase">Ingresos / Gastos</p>
                  <p className="text-sm font-semibold mt-1">
                    <span className="text-green-600">{incomeCount}</span> / <span className="text-red-600">{expenseCount}</span>
                  </p>
                </div>
                <div className="bg-white border rounded-xl p-3 shadow-sm">
                  <p className="text-xs text-gray-400 font-medium uppercase">Total Importe</p>
                  <p className={`text-sm font-bold mt-1 ${totalAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totalAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </p>
                </div>
              </div>

              {/* Preview Table */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Vista Previa (Primeros 6 registros)
                </p>
                <div className="border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="min-w-full text-xs text-left">
                    <thead className="bg-gray-50 text-gray-500 border-b">
                      <tr>
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2">Importe</th>
                        <th className="px-3 py-2">Concepto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {parseResult.movements.slice(0, 6).map((m, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono whitespace-nowrap">{m.fecha}</td>
                          <td className={`px-3 py-2 font-bold whitespace-nowrap ${m.monto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {m.monto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                          </td>
                          <td className="px-3 py-2 truncate max-w-[250px] text-gray-600" title={m.original_description}>
                            {m.original_description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button
            onClick={handleCloseModal}
            className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-900"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={!parseResult || loading}
            className="px-6 py-2 text-xs font-semibold text-white rounded-xl disabled:opacity-40"
            style={{ backgroundColor: '#006847' }}
          >
            {loading ? 'Importando...' : `Confirmar Importación (${parseResult?.movements?.length || 0})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;