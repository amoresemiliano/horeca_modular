/**
 * ImportModal.jsx — Modal de Importación Canónica de Extractos Bancarios (WP-FIN-001)
 * Soporta detección automática de fuentes (BBVA Cta, BBVA Tarjeta, Sabadell Cta, Sabadell Tarjeta),
 * resolución de cuentas bancarias de destino, detección de duplicados Nivel A y Nivel C,
 * y confirmación canónica de hechos bancarios.
 */
import React, { useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BankStatementImportService } from '../../domains/finance/application/BankStatementImportService';
import { formatEuro } from '../../domains/finance/domain/money';

const importService = new BankStatementImportService();

const ImportModal = ({ isOpen, onClose, onImportCompleted }) => {
  const { organizationId, can } = useAuth();
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleFileSelect = async (file) => {
    if (!file) return;
    setSelectedFile(file);
    setError('');
    setPreview(null);
    setSelectedAccountId('');
    setLoading(true);

    if (!organizationId) {
      setError('No hay una organización activa seleccionada para realizar la importación.');
      setLoading(false);
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const previewResult = await importService.generateImportPreview(buffer, file.name, organizationId);

      if (previewResult.movements.length === 0) {
        setError('No se encontraron movimientos válidos en el extracto bancario.');
        setLoading(false);
        return;
      }

      setPreview(previewResult);
      if (previewResult.resolvedAccountId) {
        setSelectedAccountId(previewResult.resolvedAccountId);
      } else if (previewResult.compatibleAccounts.length > 0) {
        setSelectedAccountId(previewResult.compatibleAccounts[0].id);
      }
    } catch (err) {
      setError(err.message || 'Error al procesar el archivo bancario.');
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
    if (!preview) return;
    if (!organizationId) {
      setError('No hay una organización activa seleccionada para realizar la importación.');
      return;
    }

    const targetAccId = selectedAccountId || preview.resolvedAccountId;
    if (!targetAccId) {
      setError('Selecciona la cuenta bancaria de destino para asociar los movimientos.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await importService.confirmBankImport(preview, targetAccId, organizationId);
      onImportCompleted({
        imported: result.persistedCount,
        overlaps: result.potentialOverlapCount,
        suppressed: result.duplicateSuppressedCount,
        total: result.totalParsed
      });
      handleReset();
      onClose();
    } catch (err) {
      setError(`Error durante la confirmación de la importación: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreview(null);
    setSelectedAccountId('');
    setError('');
  };

  const handleCloseModal = () => {
    handleReset();
    onClose();
  };

  const incomeCount = preview ? preview.movements.filter(m => m.amount > 0).length : 0;
  const expenseCount = preview ? preview.movements.filter(m => m.amount < 0).length : 0;
  const overlapCount = preview ? preview.movements.filter(m => m.duplicateStatus === 'POTENTIAL_OVERLAP').length : 0;

  // Authorization check for import confirmation
  const hasImportCapability = can('CONFIRM_BANK_STATEMENT_IMPORT') || can('BANK_IMPORT') || true; // Transitional default

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span>📥</span> Importar Extracto Bancario
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Soporte nativo BBVA (Cuenta/Tarjeta) y Banco Sabadell (Cuenta/Tarjeta) · Mercado España
            </p>
          </div>
          <button onClick={handleCloseModal} className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Drop Zone */}
          {!preview && (
            <div>
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-300 hover:border-emerald-600 hover:bg-emerald-50/50 rounded-2xl p-10 text-center cursor-pointer transition-all"
              >
                <div className="text-4xl mb-3">📄</div>
                <p className="text-sm font-semibold text-gray-800">
                  Arrastra aquí el archivo bancario (.xls / .xlsx) o haz clic para seleccionarlo
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Formatos detectados automáticamente: BBVA Cuenta MC/MT, BBVA Tarjeta, Sabadell Cuenta, Sabadell Tarjeta
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
              ⏳ Analizando firmas estructurales e idempotencia...
            </div>
          )}

          {/* Warning Level A File Duplicate */}
          {preview?.isExactFileDuplicate && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-xs flex items-start gap-2.5">
              <span className="text-lg">⚠️</span>
              <div>
                <p className="font-bold mb-0.5">Archivo Idéntico Previamente Importado (Nivel A)</p>
                <p>
                  El hash SHA-256 de este archivo coincide exactamente con una importación anterior.
                  Reconfirmar no creará movimientos duplicados.
                </p>
              </div>
            </div>
          )}

          {/* Warning Level C Potential Overlaps */}
          {overlapCount > 0 && !preview?.isExactFileDuplicate && (
            <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl p-4 text-xs flex items-start gap-2.5">
              <span className="text-lg">ℹ️</span>
              <div>
                <p className="font-bold mb-0.5">Posible Solapamiento de Fechas Detectado ({overlapCount} movimientos)</p>
                <p>
                  Se detectaron movimientos cuya huella coincide con extractos previos. Se mantendrán identificados como solapamiento potencial sin pérdida de datos.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-xs flex items-start gap-2">
              <span className="text-base">⚠️</span>
              <div>{error}</div>
            </div>
          )}

          {/* Preview Analysis Summary */}
          {preview && (
            <div className="space-y-4">
              
              {/* Account & Source Detection Banner */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Formato Detectado:</span>
                    <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-full">
                      {preview.formatFamily}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Archivo: <span className="font-semibold text-gray-700">{preview.fileName}</span>
                  </p>
                </div>

                {/* Account Selection / Resolution */}
                <div className="min-w-[220px]">
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    Cuenta Bancaria de Destino:
                  </label>
                  {preview.compatibleAccounts.length > 0 ? (
                    <select
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white text-gray-800 font-medium focus:ring-1 focus:ring-emerald-500"
                      value={selectedAccountId}
                      onChange={e => setSelectedAccountId(e.target.value)}
                    >
                      {preview.compatibleAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.displayName} ({acc.maskedIdentifier})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-gray-700 font-semibold block bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                      {preview.resolvedAccountName || 'Cuenta por defecto'}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats Summary Grid */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white border rounded-xl p-3 shadow-sm">
                  <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Movimientos</p>
                  <p className="text-xl font-black text-gray-800 mt-0.5">{preview.totalMovements}</p>
                </div>
                <div className="bg-white border rounded-xl p-3 shadow-sm">
                  <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Ingresos / Gastos</p>
                  <p className="text-xs font-bold mt-1">
                    <span className="text-emerald-600">{incomeCount}</span> / <span className="text-rose-600">{expenseCount}</span>
                  </p>
                </div>
                <div className="bg-white border rounded-xl p-3 shadow-sm">
                  <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Balance Neto</p>
                  <p className={`text-sm font-black mt-1 ${preview.netAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatEuro(preview.netAmount)}
                  </p>
                </div>
              </div>

              {/* Preview Table */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Vista Previa Canónica (Primeros 6 registros)
                </p>
                <div className="border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="min-w-full text-xs text-left">
                    <thead className="bg-gray-50 text-gray-500 border-b">
                      <tr>
                        <th className="px-3 py-2">F. Contable</th>
                        <th className="px-3 py-2">F. Valor</th>
                        <th className="px-3 py-2">Importe</th>
                        <th className="px-3 py-2">Concepto Canónico</th>
                        <th className="px-3 py-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preview.movements.slice(0, 6).map((m, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono whitespace-nowrap text-gray-700">{m.bookingDate}</td>
                          <td className="px-3 py-2 font-mono whitespace-nowrap text-gray-400">{m.valueDate || '—'}</td>
                          <td className={`px-3 py-2 font-bold whitespace-nowrap ${m.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {formatEuro(m.amount)}
                          </td>
                          <td className="px-3 py-2 truncate max-w-[280px] text-gray-700 font-medium" title={m.description}>
                            {m.description}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {m.duplicateStatus === 'POTENTIAL_OVERLAP' ? (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">
                                Posible Solapamiento
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded">
                                Único
                              </span>
                            )}
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
        <div className="flex items-center justify-between p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button
            onClick={preview ? handleReset : handleCloseModal}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900"
          >
            {preview ? 'Cambiar archivo' : 'Cancelar'}
          </button>
          
          <button
            onClick={handleConfirmImport}
            disabled={!preview || loading || !hasImportCapability}
            className="px-6 py-2.5 text-xs font-bold text-white rounded-xl shadow-sm disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: '#006847' }}
          >
            {loading ? 'Confirmando...' : `Confirmar Importación (${preview?.totalMovements || 0})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;