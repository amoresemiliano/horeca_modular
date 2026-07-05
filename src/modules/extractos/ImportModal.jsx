/**
 * ImportModal.jsx — Módulo Bancos / Extractos
 * Soporta los 5 formatos de CSV del sistema:
 *   - Cuenta MC (BBVA)      : Fecha, Concepto, Beneficiario, Observaciones, Importe
 *   - Cuenta MT (BBVA)      : Fecha, Concepto, Beneficiario, Observaciones, Importe
 *   - Tarjeta BBVA           : Fecha, Concepto, Importe
 *   - Cuenta Sabadell        : FECHA, CONCEPTO, MONTO
 *   - Tarjeta Sabadell       : FECHA, CONCEPTO, MONTO
 */
import React, { useRef, useState } from 'react';
import Papa from 'papaparse';

// ─── Canales disponibles ─────────────────────────────────────────────────────
export const CANALES = [
  { id: 'cta_mc',       label: 'Cuenta MC · BBVA',      banco: 'BBVA',     tipo: 'cuenta'  },
  { id: 'cta_mt',       label: 'Cuenta MT · BBVA',      banco: 'BBVA',     tipo: 'cuenta'  },
  { id: 'tarj_bbva',    label: 'Tarjeta · BBVA',        banco: 'BBVA',     tipo: 'tarjeta' },
  { id: 'cta_sabadell', label: 'Cuenta · Sabadell',     banco: 'Sabadell', tipo: 'cuenta'  },
  { id: 'tarj_sabadell',label: 'Tarjeta · Sabadell',    banco: 'Sabadell', tipo: 'tarjeta' },
];

// ─── Parsea un importe en texto español → número ──────────────────────────────
const parseImporte = (raw = '') => {
  if (!raw && raw !== 0) return null;
  // Eliminar €, espacios, y convertir formato ES (1.234,56 → 1234.56)
  const limpio = String(raw)
    .replace(/€/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')   // miles
    .replace(',', '.');   // decimal
  const num = parseFloat(limpio);
  return isNaN(num) ? null : num;
};

// ─── Parsea una fecha en varios formatos → ISO yyyy-mm-dd ─────────────────────
const parseFecha = (raw = '') => {
  if (!raw) return null;
  const s = String(raw).trim();
  // dd/mm/yyyy o dd/mm/yy
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m1) {
    const [, d, mo, y] = m1;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  // dd-mm-yyyy
  const m2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (m2) {
    const [, d, mo, y] = m2;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  return s; // devolver tal cual si no reconoce
};

// ─── Detecta qué columna de importe usar (BBVA: "Importe", Sabadell: "MONTO") ──
const getImporte = (row) => {
  const keys = Object.keys(row);
  for (const k of keys) {
    const kl = k.toLowerCase().trim();
    if (kl === 'importe' || kl === 'monto') return parseImporte(row[k]);
  }
  return null;
};

// ─── Detecta la columna de fecha ──────────────────────────────────────────────
const getFecha = (row) => {
  const keys = Object.keys(row);
  for (const k of keys) {
    if (k.toLowerCase().trim() === 'fecha') return parseFecha(row[k]);
  }
  return null;
};

// ─── Detecta la columna de concepto ───────────────────────────────────────────
const getConcepto = (row) => {
  const keys = Object.keys(row);
  // Combinar Concepto + Beneficiario + Observaciones si existen
  const partes = [];
  for (const k of keys) {
    const kl = k.toLowerCase().trim();
    if (['concepto', 'beneficiario', 'observaciones'].includes(kl) && row[k]?.trim()) {
      partes.push(row[k].trim());
    }
  }
  return partes.join(' · ') || '';
};

// ─── Transforma una fila CSV al formato interno ───────────────────────────────
const transformarFila = (row, canal) => {
  const importe = getImporte(row);
  const fecha   = getFecha(row);
  if (importe === null || !fecha) return null;
  return {
    fecha,
    importe,
    concepto:     getConcepto(row),
    canal:        canal.label,
    categoria:    '',
    subcategoria: '',
    proveedor:    '',
    notas:        '',
  };
};

// ─── COMPONENTE ───────────────────────────────────────────────────────────────
const ImportModal = ({ isOpen, onClose, onImport }) => {
  const fileRef    = useRef(null);
  const [canal,    setCanal]    = useState(CANALES[0]);
  const [preview,  setPreview]  = useState([]);
  const [fileName, setFileName] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  if (!isOpen) return null;

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    setError('');
    setPreview([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: ({ data }) => {
        const filas = data
          .map(row => transformarFila(row, canal))
          .filter(Boolean);

        if (filas.length === 0) {
          setError('No se detectaron filas válidas. Verificá que el CSV tenga las columnas correctas y el canal seleccionado.');
          return;
        }
        setPreview(filas);
      },
      error: (err) => setError(`Error al parsear: ${err.message}`),
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  };

  const handleConfirm = async () => {
    if (preview.length === 0) return;
    setLoading(true);
    await onImport(preview);
    setLoading(false);
    setPreview([]);
    setFileName('');
    onClose();
  };

  const handleCancel = () => {
    setPreview([]);
    setFileName('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">📥 Cargar Movimientos</h2>
            <p className="text-sm text-gray-500 mt-0.5">Importá el CSV descargado del banco</p>
          </div>
          <button onClick={handleCancel} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Selector de Canal */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              1. Seleccioná la fuente bancaria
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CANALES.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setCanal(c); setPreview([]); setFileName(''); }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all text-left ${
                    canal.id === c.id
                      ? 'border-red-500 bg-red-50 text-red-800'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <span className="text-lg">{c.banco === 'BBVA' ? '🟦' : '🟥'}</span>
                  <div>
                    <div className="font-semibold">{c.label}</div>
                    <div className="text-xs text-gray-400 capitalize">{c.tipo}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Drop Zone */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              2. Cargá el archivo CSV
            </label>
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-red-400 hover:bg-red-50 transition-all"
            >
              <div className="text-4xl mb-2">📂</div>
              {fileName
                ? <p className="text-sm font-semibold text-gray-700">{fileName}</p>
                : <p className="text-sm text-gray-500">Arrastrá el CSV aquí o hacé clic para seleccionar</p>
              }
              <p className="text-xs text-gray-400 mt-1">Solo archivos .csv · Formato {canal.banco}</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => handleFile(e.target.files[0])}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
              ⚠️ {error}
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                3. Vista previa · <span className="text-green-600">{preview.length} movimientos detectados</span>
              </p>
              <div className="overflow-x-auto rounded-xl border border-gray-200 max-h-52">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {['Fecha','Importe','Canal','Concepto'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.slice(0, 10).map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap">{item.fecha}</td>
                        <td className={`px-3 py-2 font-medium whitespace-nowrap ${item.importe < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {item.importe.toFixed(2)} €
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-500">{item.canal}</td>
                        <td className="px-3 py-2 max-w-[180px] truncate text-gray-500">{item.concepto}</td>
                      </tr>
                    ))}
                    {preview.length > 10 && (
                      <tr>
                        <td colSpan="4" className="px-3 py-2 text-center text-gray-400">
                          … y {preview.length - 10} movimientos más
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
          <button
            onClick={handleCancel}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={preview.length === 0 || loading}
            className="px-6 py-2.5 text-sm font-semibold text-white rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: preview.length > 0 && !loading ? '#006847' : undefined, background: preview.length === 0 || loading ? '#9CA3AF' : '#006847' }}
          >
            {loading ? '⏳ Guardando…' : `✅ Importar ${preview.length} movimientos`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;