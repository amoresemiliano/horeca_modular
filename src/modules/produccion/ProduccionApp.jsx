/**
 * ProduccionApp.jsx — Módulo Producción
 * Registro diario de producción de la cocina.
 * Vinculable con Escandallos e Inventario (futuras fases).
 */
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const hoy = () => new Date().toISOString().split('T')[0];

const UNIDADES = ['kg', 'g', 'L', 'ml', 'porciones', 'unidades', 'bandejas', 'litros'];
const TURNOS   = ['Mañana', 'Tarde', 'Noche'];

const CATEGORIAS_PROD = [
  'Bases y Salsas', 'Carnes', 'Mariscos', 'Verduras', 'Tortillas',
  'Bebidas', 'Postres', 'Guarniciones', 'Otros',
];

const ProduccionApp = ({ tabActiva }) => {
  const [registros,  setRegistros]  = useState([]);
  const [empleados,  setEmpleados]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [toast,      setToast]      = useState(null);
  const [showForm,   setShowForm]   = useState(false);
  const [filtroFecha, setFiltroFecha] = useState(hoy());

  const [form, setForm] = useState({
    fecha:           hoy(),
    nombre_producto: '',
    categoria:       'Bases y Salsas',
    cantidad:        '',
    unidad:          'kg',
    merma:           '0',
    turno:           'Mañana',
    responsable:     '',
    responsable_id:  '',
    notas:           '',
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Carga inicial ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [{ data: reg }, { data: emp }] = await Promise.all([
        supabase
          .from('produccion_registros')
          .select('*, empleados(nombre, apellidos)')
          .order('fecha', { ascending: false })
          .limit(500),
        supabase.from('empleados').select('id, nombre, apellidos').eq('activo', true).order('nombre'),
      ]);
      setRegistros(reg || []);
      setEmpleados(emp || []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // ─── Guardar registro ──────────────────────────────────────────────────────
  const guardarRegistro = async () => {
    if (!form.nombre_producto || !form.cantidad) {
      showToast('Nombre del producto y cantidad son requeridos', 'error');
      return;
    }

    const payload = {
      fecha:           form.fecha,
      nombre_producto: form.nombre_producto,
      cantidad:        parseFloat(form.cantidad),
      unidad:          form.unidad,
      merma:           parseFloat(form.merma) || 0,
      turno:           form.turno,
      responsable:     form.responsable,
      responsable_id:  form.responsable_id || null,
      notas:           form.notas,
    };

    const { data, error } = await supabase
      .from('produccion_registros')
      .insert(payload)
      .select('*, empleados(nombre, apellidos)')
      .single();

    if (error) { showToast('Error al guardar', 'error'); return; }
    setRegistros(prev => [data, ...prev]);
    setShowForm(false);
    setForm(f => ({ ...f, nombre_producto: '', cantidad: '', merma: '0', notas: '' }));
    showToast(`✅ Producción registrada: ${data.nombre_producto}`);
  };

  const inputCls  = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 w-full';
  const labelCls  = 'block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide';

  // ─── Filtrar registros por fecha ───────────────────────────────────────────
  const registrosFiltrados = registros.filter(r =>
    filtroFecha ? r.fecha === filtroFecha : true
  );

  // ─────────────────────────────── TAB: REGISTRO ────────────────────────────
  if (tabActiva === 'Registro') {
    // KPIs del día filtrado
    const totalKg = registrosFiltrados
      .filter(r => r.unidad === 'kg')
      .reduce((a, b) => a + parseFloat(b.cantidad || 0), 0);

    const totalItems = registrosFiltrados.length;
    const totalMerma = registrosFiltrados.reduce((a, b) => a + parseFloat(b.merma || 0), 0);

    return (
      <div className="space-y-6">
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold text-white ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {toast.msg}
          </div>
        )}

        {/* Selector de fecha + KPIs */}
        <div className="flex flex-wrap items-start gap-4">
          <div>
            <label className={labelCls}>Fecha de producción</label>
            <input
              type="date"
              value={filtroFecha}
              onChange={e => setFiltroFecha(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </div>
          <div className="flex gap-4 flex-1">
            {[
              { icon: '🍳', label: 'Lotes producidos', value: totalItems },
              { icon: '⚖️',  label: 'Total (kg)',        value: `${totalKg.toFixed(2)} kg` },
              { icon: '🗑️', label: 'Merma total',       value: `${totalMerma.toFixed(2)} kg` },
            ].map(({ icon, label, value }) => (
              <div key={label} className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex-1 text-center">
                <div className="text-xl mb-1">{icon}</div>
                <div className="text-xl font-bold text-gray-900">{value}</div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Botón + formulario */}
        <div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl"
            style={{ backgroundColor: '#E2231A' }}
          >
            + Registrar Producción
          </button>

          {showForm && (
            <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-5 space-y-4">
              <h4 className="font-bold text-gray-800 text-sm">Nuevo registro de producción</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

                {/* Nombre del producto */}
                <div className="col-span-2">
                  <label className={labelCls}>Producto / Preparación *</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="Ej: Salsa Roja, Carne de Taco, Guacamole…"
                    value={form.nombre_producto}
                    onChange={e => setForm(f => ({ ...f, nombre_producto: e.target.value }))}
                  />
                </div>

                {/* Categoría */}
                <div>
                  <label className={labelCls}>Categoría</label>
                  <select className={inputCls} value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                    {CATEGORIAS_PROD.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Turno */}
                <div>
                  <label className={labelCls}>Turno</label>
                  <select className={inputCls} value={form.turno} onChange={e => setForm(f => ({ ...f, turno: e.target.value }))}>
                    {TURNOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Cantidad */}
                <div>
                  <label className={labelCls}>Cantidad producida *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    className={inputCls}
                    placeholder="0.000"
                    value={form.cantidad}
                    onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))}
                  />
                </div>

                {/* Unidad */}
                <div>
                  <label className={labelCls}>Unidad</label>
                  <select className={inputCls} value={form.unidad} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))}>
                    {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>

                {/* Merma */}
                <div>
                  <label className={labelCls}>Merma</label>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    className={inputCls}
                    placeholder="0.000"
                    value={form.merma}
                    onChange={e => setForm(f => ({ ...f, merma: e.target.value }))}
                  />
                </div>

                {/* Responsable */}
                <div>
                  <label className={labelCls}>Responsable</label>
                  <select
                    className={inputCls}
                    value={form.responsable_id}
                    onChange={e => {
                      const emp = empleados.find(x => x.id === e.target.value);
                      setForm(f => ({
                        ...f,
                        responsable_id: e.target.value,
                        responsable:    emp ? `${emp.nombre} ${emp.apellidos}` : '',
                      }));
                    }}
                  >
                    <option value="">— Sin asignar —</option>
                    {empleados.map(e => (
                      <option key={e.id} value={e.id}>{e.nombre} {e.apellidos}</option>
                    ))}
                  </select>
                </div>

                {/* Fecha */}
                <div>
                  <label className={labelCls}>Fecha</label>
                  <input type="date" className={inputCls} value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                </div>

                {/* Notas */}
                <div className="col-span-2 md:col-span-4">
                  <label className={labelCls}>Notas (opcional)</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="Observaciones de la producción, calidad, lote…"
                    value={form.notas}
                    onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={guardarRegistro}
                  className="px-5 py-2 text-sm font-semibold text-white rounded-xl"
                  style={{ backgroundColor: '#E2231A' }}
                >
                  Guardar
                </button>
                <button onClick={() => setShowForm(false)} className="px-5 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tabla del día */}
        <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                {['Producto', 'Cantidad', 'Unidad', 'Merma', 'Turno', 'Responsable', 'Notas'].map(h => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="7" className="py-10 text-center text-gray-400">Cargando…</td></tr>
              ) : registrosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-16 text-center">
                    <div className="text-4xl mb-3">🍳</div>
                    <p className="text-gray-400">No hay producción registrada para esta fecha.</p>
                  </td>
                </tr>
              ) : registrosFiltrados.map(r => (
                <tr key={r.id} className="hover:bg-orange-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-gray-900">{r.nombre_producto}</td>
                  <td className="px-4 py-3 font-bold text-green-700">{parseFloat(r.cantidad).toFixed(3)}</td>
                  <td className="px-4 py-3 text-gray-500">{r.unidad}</td>
                  <td className="px-4 py-3 text-red-500">{parseFloat(r.merma || 0).toFixed(3)}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700">
                      {r.turno}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.empleados ? `${r.empleados.nombre} ${r.empleados.apellidos}` : r.responsable || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{r.notas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ─────────────────────────────── TAB: HISTORIAL ───────────────────────────
  if (tabActiva === 'Historial') {
    // Agrupar por fecha
    const porFecha = registros.reduce((acc, r) => {
      const fecha = r.fecha || 'Sin fecha';
      if (!acc[fecha]) acc[fecha] = [];
      acc[fecha].push(r);
      return acc;
    }, {});

    return (
      <div className="space-y-4">
        {Object.entries(porFecha).slice(0, 30).map(([fecha, items]) => (
          <div key={fecha} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <span className="font-bold text-gray-800">
                {new Date(fecha + 'T12:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
              <span className="text-sm text-gray-500">{items.length} lotes</span>
            </div>
            <div className="divide-y divide-gray-100">
              {items.map(r => (
                <div key={r.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                  <div>
                    <span className="font-medium text-gray-900">{r.nombre_producto}</span>
                    <span className="ml-2 text-xs text-gray-400">· {r.turno}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-green-700">{parseFloat(r.cantidad).toFixed(3)} {r.unidad}</span>
                    {r.merma > 0 && <span className="text-xs text-red-400 ml-2">Merma: {parseFloat(r.merma).toFixed(3)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {registros.length === 0 && !loading && (
          <div className="py-16 text-center text-gray-400">
            <div className="text-4xl mb-3">📋</div>
            <p>No hay registros de producción aún.</p>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────── TAB: RESUMEN ─────────────────────────────
  if (tabActiva === 'Resumen') {
    // Top productos por volumen
    const porProducto = registros.reduce((acc, r) => {
      const key = r.nombre_producto;
      if (!acc[key]) acc[key] = { nombre: key, cantidad: 0, lotes: 0, merma: 0, unidad: r.unidad };
      acc[key].cantidad += parseFloat(r.cantidad || 0);
      acc[key].merma    += parseFloat(r.merma || 0);
      acc[key].lotes    += 1;
      return acc;
    }, {});

    const ranking = Object.values(porProducto).sort((a, b) => b.cantidad - a.cantidad);

    return (
      <div className="space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          📊 <strong>Resumen acumulado de producción</strong> · Todos los registros históricos
        </div>

        <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                {['#', 'Producto', 'Lotes', 'Cantidad total', 'Merma total', '% Merma'].map(h => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ranking.map((r, i) => (
                <tr key={r.nombre} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{r.nombre}</td>
                  <td className="px-4 py-3">{r.lotes}</td>
                  <td className="px-4 py-3 font-bold text-green-700">{r.cantidad.toFixed(3)} {r.unidad}</td>
                  <td className="px-4 py-3 text-red-500">{r.merma.toFixed(3)} {r.unidad}</td>
                  <td className="px-4 py-3">
                    {r.cantidad > 0
                      ? <span className={`font-medium ${(r.merma / r.cantidad) > 0.1 ? 'text-red-600' : 'text-gray-700'}`}>
                          {((r.merma / r.cantidad) * 100).toFixed(1)}%
                        </span>
                      : '—'
                    }
                  </td>
                </tr>
              ))}
              {ranking.length === 0 && !loading && (
                <tr><td colSpan="6" className="py-10 text-center text-gray-400">Sin datos de producción.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return null;
};

export default ProduccionApp;
