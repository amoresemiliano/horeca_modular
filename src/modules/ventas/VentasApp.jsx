import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { defaultSalesContainer } from '../../infrastructure/sales/salesServiceContainer';

export const VentasApp = ({ tabActiva }) => {
  const { user, activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id || user?.organizationId || null;

  const [loading, setLoading] = useState(false);
  const [infraError, setInfraError] = useState(null);
  const [overview, setOverview] = useState({
    totalTickets: 0,
    totalRevenue: 0,
    channelBreakdown: {},
    tickets: [],
  });
  const [products, setProducts] = useState([]);
  const [imports, setImports] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketDetails, setTicketDetails] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState(null);

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setInfraError(null);
    try {
      const [ov, prods, imps] = await Promise.all([
        defaultSalesContainer.getSalesOverview.execute({ organizationId, limit: 100 }),
        defaultSalesContainer.getProductSalesSummary.execute({ organizationId }),
        defaultSalesContainer.getSalesImports.execute({ organizationId, limit: 10 }),
      ]);
      setOverview(ov);
      setProducts(prods);
      setImports(imps);
    } catch (err) {
      console.error('Error loading sales data from persistent repository:', err);
      setInfraError(err.message || 'Error de conexión con la persistencia de ventas.');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !organizationId) return;

    setLoading(true);
    setImportResult(null);
    setImportError(null);

    try {
      const text = await file.text();
      const res = await defaultSalesContainer.ingestSalesCsv.execute({
        organizationId,
        csvContent: text,
        filename: file.name,
      });

      setImportResult(res);
      await loadData();
    } catch (err) {
      setImportError(err.message || 'Error al procesar la ingesta del archivo CSV de ventas.');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleViewTicketDetails = async (saleId) => {
    if (!organizationId) return;
    try {
      const details = await defaultSalesContainer.getSaleDetails.execute({
        organizationId,
        saleId,
      });
      setTicketDetails(details);
      setSelectedTicket(saleId);
    } catch (err) {
      console.error('Error loading ticket details:', err);
    }
  };

  // Helper currency formatter
  const formatEuro = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '0,00 €';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(num);
  };

  // 1. Enforce explicit organization context: fail closed if no active organization
  if (!organizationId) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center flex flex-col items-center max-w-md mx-auto my-12 shadow-sm font-sans">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-3xl mb-4">
          🏢
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Organización no seleccionada</h3>
        <p className="text-sm text-gray-500 leading-relaxed">
          Debes seleccionar una organización activa en la barra superior para consultar o ingestar datos de ventas de forma segura y canónica.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* ── ERROR DE INFRAESTRUCTURA / PERSISTENCIA ── */}
      {infraError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex justify-between items-center">
          <div>
            <strong>Error de Persistencia:</strong> {infraError}
          </div>
          <button onClick={() => setInfraError(null)} className="text-red-600 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* ── BARRA SUPERIOR DE ACCIONES Y MÉTRICAS RÁPIDAS ── */}
      <div className="flex flex-wrap justify-between items-center bg-white p-5 rounded-2xl border border-gray-200 shadow-sm gap-4">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Facturación</span>
            <div className="text-2xl font-black text-gray-900">{formatEuro(overview.totalRevenue)}</div>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Tickets Canónicos</span>
            <div className="text-2xl font-black text-blue-600">{overview.totalTickets}</div>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Ticket Medio</span>
            <div className="text-2xl font-black text-emerald-600">
              {formatEuro(overview.totalTickets > 0 ? overview.totalRevenue / overview.totalTickets : 0)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="file"
            id="ventas-csv-upload"
            hidden
            accept=".csv"
            onChange={handleFileUpload}
            disabled={loading}
          />
          <label
            htmlFor="ventas-csv-upload"
            className={`px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-sm transition-all flex items-center gap-2 cursor-pointer ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <span>📥</span>
            <span>{loading ? 'Procesando Ingesta...' : 'Ingestar CSV Last.app'}</span>
          </label>
        </div>
      </div>

      {/* ── NOTIFICACIÓN DE RESULTADO DE INGESTA / DIAGNÓSTICOS ── */}
      {importResult && (
        <div
          className={`p-4 rounded-xl border ${
            importResult.status === 'COMPLETED'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : importResult.status === 'REJECTED'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2 font-bold text-sm">
              <span>{importResult.status === 'COMPLETED' ? '✅ Ingesta Canónica Exitosa' : '⚠️ Ingesta Procesada con Advertencias'}</span>
              <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-current">
                {importResult.filename}
              </span>
            </div>
            <button
              onClick={() => setImportResult(null)}
              className="text-gray-400 hover:text-gray-600 text-xs font-bold"
            >
              ✕ Cerrar
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3 text-xs">
            <div><strong>Total Filas:</strong> {importResult.rowsAttempted}</div>
            <div><strong>Aceptados:</strong> {importResult.rowsAccepted}</div>
            <div><strong>Duplicados:</strong> {importResult.rowsDuplicate}</div>
            <div><strong>Rechazados:</strong> {importResult.rowsRejected}</div>
            <div><strong>Importe Facturado:</strong> {formatEuro(importResult.totalRevenue)}</div>
          </div>

          {importResult.diagnostics && importResult.diagnostics.length > 0 && (
            <div className="mt-3 text-xs bg-white/70 p-3 rounded-lg border border-current/20 max-h-32 overflow-y-auto">
              <strong className="block mb-1">Diagnósticos del Motor:</strong>
              <ul className="list-disc list-inside space-y-0.5">
                {importResult.diagnostics.map((d, i) => (
                  <li key={i} className={d.level === 'ERROR' ? 'text-red-700 font-medium' : ''}>
                    {d.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {importError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex justify-between items-center">
          <div>
            <strong>Error de Ingesta:</strong> {importError}
          </div>
          <button onClick={() => setImportError(null)} className="text-red-600 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* ── TAB: TICKETS ── */}
      {tabActiva === 'Tickets' && (
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-gray-200">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 uppercase tracking-wider border-b border-gray-200 text-gray-500 text-xs font-bold">
                <tr>
                  <th className="px-6 py-4">Ticket</th>
                  <th className="px-6 py-4">Factura Nº</th>
                  <th className="px-6 py-4">Fecha / Hora</th>
                  <th className="px-6 py-4">Canal</th>
                  <th className="px-6 py-4">Método de Pago</th>
                  <th className="px-6 py-4 text-right">Total Canónico</th>
                  <th className="px-6 py-4 text-center">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {overview.tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-gray-900">{t.code}</td>
                    <td className="px-6 py-4 text-gray-600 font-mono text-xs">{t.invoiceNumber || '—'}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(t.occurredAt).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                        {t.channel}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 capitalize">{t.paymentMethod}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600">
                      {formatEuro(t.total)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleViewTicketDetails(t.id)}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition"
                      >
                        Ver Líneas
                      </button>
                    </td>
                  </tr>
                ))}
                {overview.tickets.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-6 py-16 text-center text-gray-400">
                      No hay ventas registradas en esta organización. Sube un archivo CSV de Last.app para comenzar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: PRODUCTOS ── */}
      {tabActiva === 'Productos' && (
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-gray-200">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 uppercase tracking-wider border-b border-gray-200 text-gray-500 text-xs font-bold">
                <tr>
                  <th className="px-6 py-4">Descripción / Producto</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4 text-right">Cantidad Total</th>
                  <th className="px-6 py-4 text-right">Tickets Incluidos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4 font-semibold text-gray-900">{p.displayText}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          p.itemType === 'MODIFIER'
                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
                            : 'bg-purple-50 text-purple-700 border border-purple-100'
                        }`}
                      >
                        {p.itemType === 'MODIFIER' ? 'Modificador' : 'Producto Principal'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-gray-800">
                      {p.totalQuantity}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-500">{p.occurrences}</td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-6 py-16 text-center text-gray-400">
                      No hay productos registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: GRÁFICOS ── */}
      {tabActiva === 'Gráficos' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 mb-4">Desglose por Canal de Venta</h3>
            <div className="space-y-4">
              {Object.entries(overview.channelBreakdown).map(([ch, data]) => {
                const pct = overview.totalRevenue > 0 ? (data.revenue / overview.totalRevenue) * 100 : 0;
                return (
                  <div key={ch} className="flex flex-col gap-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-gray-800">{ch} ({data.count} tickets)</span>
                      <span className="font-bold text-gray-900">{formatEuro(data.revenue)} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {Object.keys(overview.channelBreakdown).length === 0 && (
                <p className="text-gray-400 text-sm py-8 text-center">No hay datos de canales disponibles.</p>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-2">Historial de Ingestas Canónicas</h3>
              <p className="text-xs text-gray-500 mb-4">Registro de archivos CSV procesados e idempotencia.</p>
              <div className="space-y-2">
                {imports.map((imp) => (
                  <div key={imp.id} className="flex justify-between items-center p-3 rounded-xl bg-gray-50 border border-gray-200/80 text-xs">
                    <div>
                      <div className="font-semibold text-gray-900">{imp.filename}</div>
                      <div className="text-gray-400">{new Date(imp.createdAt).toLocaleString('es-ES')}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-600">{formatEuro(imp.totalRevenue)}</div>
                      <span className="text-[10px] uppercase font-bold text-gray-500">
                        {imp.rowsAccepted} / {imp.rowsAttempted} filas
                      </span>
                    </div>
                  </div>
                ))}
                {imports.length === 0 && (
                  <p className="text-gray-400 text-xs py-6 text-center">No hay importaciones registradas.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: MESAS (HONEST UNSUPPORTED STATE) ── */}
      {tabActiva === 'Mesas' && (
        <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center flex flex-col items-center max-w-2xl mx-auto my-8">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-3xl mb-4">
            🪑
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Desglose de Mesas no disponible en la exportación de Last.app</h3>
          <p className="text-sm text-gray-500 leading-relaxed max-w-lg mb-6">
            Los extractos estándar de tickets individuales de Last.app no incluyen asignación de mesas o planos de sala.
            Por política de fidelidad canónica, HORECA Modular no sintetiza ni inventa asignaciones de mesa ficticias.
          </p>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-600 font-mono">
            Estado de Integración: Esperando conector API Last.app para telemetría de mesas en tiempo real.
          </div>
        </div>
      )}

      {/* ── MODAL DETALLE DE TICKET CON LÍNEAS Y MODIFICADORES ── */}
      {selectedTicket && ticketDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-lg w-full p-6 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-4">
              <div>
                <h3 className="font-black text-lg text-gray-900">
                  Ticket {ticketDetails.code}
                </h3>
                <p className="text-xs text-gray-500 font-mono">
                  Factura: {ticketDetails.invoiceNumber || 'Sin factura asignada'}
                </p>
              </div>
              <button
                onClick={() => { setSelectedTicket(null); setTicketDetails(null); }}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Líneas de Ticket</h4>
              {ticketDetails.lines.map((l) => (
                <div
                  key={l.id}
                  style={{ marginLeft: `${l.depth * 1.25}rem` }}
                  className={`p-2.5 rounded-lg text-xs flex justify-between items-center ${
                    l.depth > 0
                      ? 'bg-amber-50/60 border-l-2 border-amber-400 text-amber-900'
                      : 'bg-gray-50 font-semibold text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {l.depth > 0 && <span className="text-amber-500">↳</span>}
                    <span>{l.displayText}</span>
                  </div>
                  <div className="font-mono text-gray-600 font-bold">x{l.quantity}</div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-4 mt-4 flex justify-between items-center">
              <span className="text-sm font-bold text-gray-600">Total Canónico:</span>
              <span className="text-xl font-black text-emerald-600">{formatEuro(ticketDetails.total)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VentasApp;