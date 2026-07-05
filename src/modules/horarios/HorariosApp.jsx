/**
 * HorariosApp.jsx — Módulo Personal
 * Control de fichajes, incidencias y empleados.
 * Cumplimiento: RD-ley 8/2019 (obligatoriedad registro horario España)
 */
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

// ─── Tipos de incidencia ──────────────────────────────────────────────────────
const TIPOS_INCIDENCIA = [
  'Baja médica', 'Vacaciones', 'Permiso retribuido', 'Ausencia injustificada',
  'Llegada tarde', 'Salida anticipada', 'Hora extra', 'Guardia',
];

const TURNOS = ['Mañana', 'Tarde', 'Noche', 'Partido'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const hoy = () => new Date().toISOString().split('T')[0];
const horaAhora = () => new Date().toTimeString().slice(0, 5);

const calcHoras = (entrada, salida, pausaMin = 0) => {
  if (!entrada || !salida) return null;
  const [h1, m1] = entrada.split(':').map(Number);
  const [h2, m2] = salida.split(':').map(Number);
  const totalMin = (h2 * 60 + m2) - (h1 * 60 + m1) - pausaMin;
  return (totalMin / 60).toFixed(2);
};

// ─── Sub-componente: badge de tipo de jornada ─────────────────────────────────
const TipoBadge = ({ tipo }) => {
  const colores = {
    ordinario:  'bg-blue-50 text-blue-700',
    festivo:    'bg-orange-50 text-orange-700',
    nocturno:   'bg-indigo-50 text-indigo-700',
    guardia:    'bg-purple-50 text-purple-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colores[tipo] || 'bg-gray-100 text-gray-600'}`}>
      {tipo}
    </span>
  );
};

// ─── Componente principal ──────────────────────────────────────────────────────
const HorariosApp = ({ tabActiva }) => {
  const [empleados,    setEmpleados]   = useState([]);
  const [fichajes,     setFichajes]    = useState([]);
  const [incidencias,  setIncidencias] = useState([]);
  const [loading,      setLoading]     = useState(true);
  const [toast,        setToast]       = useState(null);

  // Form fichaje nuevo
  const [formFichaje, setFormFichaje] = useState({
    empleado_id: '',
    fecha:       hoy(),
    hora_entrada: horaAhora(),
    hora_salida:  '',
    minutos_pausa: 30,
    tipo:         'ordinario',
    notas:        '',
  });

  // Form incidencia nueva
  const [formIncidencia, setFormIncidencia] = useState({
    empleado_id:  '',
    fecha_inicio: hoy(),
    fecha_fin:    '',
    tipo:         'Baja médica',
    descripcion:  '',
  });

  // Form empleado nuevo
  const [formEmpleado, setFormEmpleado] = useState({
    nombre: '', apellidos: '', nif: '', email: '', cargo: '', fecha_alta: hoy(),
  });

  const [showFormFichaje,    setShowFormFichaje]    = useState(false);
  const [showFormIncidencia, setShowFormIncidencia] = useState(false);
  const [showFormEmpleado,   setShowFormEmpleado]   = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Carga de datos ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [{ data: emp }, { data: fich }, { data: inc }] = await Promise.all([
        supabase.from('empleados').select('*').eq('activo', true).order('nombre'),
        supabase.from('fichajes').select('*, empleados(nombre, apellidos)').order('fecha', { ascending: false }).limit(200),
        supabase.from('incidencias').select('*, empleados(nombre, apellidos)').order('fecha_inicio', { ascending: false }).limit(100),
      ]);
      setEmpleados(emp || []);
      setFichajes(fich || []);
      setIncidencias(inc || []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // ─── Guardar fichaje ────────────────────────────────────────────────────────
  const guardarFichaje = async () => {
    if (!formFichaje.empleado_id || !formFichaje.hora_entrada) {
      showToast('Seleccioná un empleado y la hora de entrada', 'error');
      return;
    }
    const horasTrabajadas = calcHoras(formFichaje.hora_entrada, formFichaje.hora_salida, formFichaje.minutos_pausa);
    const payload = { ...formFichaje, horas_trabajadas: horasTrabajadas };

    const { data, error } = await supabase.from('fichajes').insert(payload).select('*, empleados(nombre, apellidos)').single();
    if (error) { showToast('Error al guardar el fichaje', 'error'); return; }
    setFichajes(prev => [data, ...prev]);
    setShowFormFichaje(false);
    setFormFichaje(f => ({ ...f, hora_entrada: horaAhora(), hora_salida: '', notas: '' }));
    showToast(`✅ Fichaje guardado para ${data.empleados?.nombre}`);
  };

  // ─── Registrar incidencia ───────────────────────────────────────────────────
  const guardarIncidencia = async () => {
    if (!formIncidencia.empleado_id || !formIncidencia.tipo) {
      showToast('Completá los campos requeridos', 'error');
      return;
    }
    const { data, error } = await supabase.from('incidencias').insert(formIncidencia).select('*, empleados(nombre, apellidos)').single();
    if (error) { showToast('Error al guardar incidencia', 'error'); return; }
    setIncidencias(prev => [data, ...prev]);
    setShowFormIncidencia(false);
    showToast(`✅ Incidencia registrada`);
  };

  // ─── Agregar empleado ───────────────────────────────────────────────────────
  const guardarEmpleado = async () => {
    if (!formEmpleado.nombre) { showToast('El nombre es requerido', 'error'); return; }
    const { data, error } = await supabase.from('empleados').insert({ ...formEmpleado, activo: true }).select().single();
    if (error) { showToast('Error al guardar empleado', 'error'); return; }
    setEmpleados(prev => [...prev, data]);
    setShowFormEmpleado(false);
    setFormEmpleado({ nombre: '', apellidos: '', nif: '', email: '', cargo: '', fecha_alta: hoy() });
    showToast(`✅ Empleado ${data.nombre} agregado`);
  };

  const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 w-full';
  const labelCls = 'block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide';

  // ─────────────────────────────── TAB: FICHAJES ────────────────────────────
  if (tabActiva === 'Fichajes') {
    const hoyFichajes = fichajes.filter(f => f.fecha === hoy());
    const totalHorasHoy = hoyFichajes.reduce((a, b) => a + parseFloat(b.horas_trabajadas || 0), 0);

    return (
      <div className="space-y-6">
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold text-white ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {toast.msg}
          </div>
        )}

        {/* KPIs del día */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: '👥', label: 'Empleados activos', value: empleados.length },
            { icon: '🕐', label: 'Fichajes hoy',      value: hoyFichajes.length },
            { icon: '⏱️', label: 'Horas totales hoy', value: `${totalHorasHoy.toFixed(1)}h` },
          ].map(({ icon, label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-center">
              <div className="text-2xl mb-1">{icon}</div>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Botón + Form nuevo fichaje */}
        <div>
          <button
            onClick={() => setShowFormFichaje(!showFormFichaje)}
            className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl shadow-sm transition"
            style={{ backgroundColor: '#006847' }}
          >
            + Registrar Fichaje
          </button>

          {showFormFichaje && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-5 space-y-4">
              <h4 className="font-bold text-gray-800 text-sm">Nuevo Fichaje</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className={labelCls}>Empleado *</label>
                  <select className={inputCls} value={formFichaje.empleado_id} onChange={e => setFormFichaje(f => ({ ...f, empleado_id: e.target.value }))}>
                    <option value="">— Seleccionar —</option>
                    {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre} {e.apellidos}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Fecha</label>
                  <input type="date" className={inputCls} value={formFichaje.fecha} onChange={e => setFormFichaje(f => ({ ...f, fecha: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Tipo</label>
                  <select className={inputCls} value={formFichaje.tipo} onChange={e => setFormFichaje(f => ({ ...f, tipo: e.target.value }))}>
                    {['ordinario', 'festivo', 'nocturno', 'guardia'].map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Hora entrada *</label>
                  <input type="time" className={inputCls} value={formFichaje.hora_entrada} onChange={e => setFormFichaje(f => ({ ...f, hora_entrada: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Hora salida</label>
                  <input type="time" className={inputCls} value={formFichaje.hora_salida} onChange={e => setFormFichaje(f => ({ ...f, hora_salida: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Pausa (min)</label>
                  <input type="number" min="0" max="120" className={inputCls} value={formFichaje.minutos_pausa} onChange={e => setFormFichaje(f => ({ ...f, minutos_pausa: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="col-span-2 md:col-span-3">
                  <label className={labelCls}>Notas (opcional)</label>
                  <input type="text" className={inputCls} placeholder="Ej: Turno de apertura" value={formFichaje.notas} onChange={e => setFormFichaje(f => ({ ...f, notas: e.target.value }))} />
                </div>
              </div>
              {formFichaje.hora_entrada && formFichaje.hora_salida && (
                <p className="text-sm text-green-700 font-semibold">
                  ⏱️ Horas netas: {calcHoras(formFichaje.hora_entrada, formFichaje.hora_salida, formFichaje.minutos_pausa)}h
                </p>
              )}
              <div className="flex gap-3">
                <button onClick={guardarFichaje} className="px-5 py-2 text-sm font-semibold text-white rounded-xl" style={{ backgroundColor: '#006847' }}>Guardar</button>
                <button onClick={() => setShowFormFichaje(false)} className="px-5 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancelar</button>
              </div>
            </div>
          )}
        </div>

        {/* Tabla de fichajes */}
        <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                {['Empleado', 'Fecha', 'Entrada', 'Salida', 'Pausa', 'Horas', 'Tipo', 'Notas'].map(h => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="8" className="py-10 text-center text-gray-400">Cargando…</td></tr>
              ) : fichajes.length === 0 ? (
                <tr><td colSpan="8" className="py-10 text-center text-gray-400">No hay fichajes registrados aún.</td></tr>
              ) : fichajes.map(f => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium whitespace-nowrap">
                    {f.empleados?.nombre} {f.empleados?.apellidos}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                    {new Date(f.fecha + 'T12:00').toLocaleDateString('es-ES')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-mono">{f.hora_entrada || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap font-mono">{f.hora_salida || <span className="text-amber-500">En turno</span>}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{f.minutos_pausa}′</td>
                  <td className="px-4 py-3 whitespace-nowrap font-bold">{f.horas_trabajadas ? `${f.horas_trabajadas}h` : '—'}</td>
                  <td className="px-4 py-3"><TipoBadge tipo={f.tipo} /></td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{f.notas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ─────────────────────────────── TAB: INCIDENCIAS ─────────────────────────
  if (tabActiva === 'Incidencias') {
    return (
      <div className="space-y-6">
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold text-white ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {toast.msg}
          </div>
        )}
        <button
          onClick={() => setShowFormIncidencia(!showFormIncidencia)}
          className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl"
          style={{ backgroundColor: '#E2231A' }}
        >
          + Registrar Incidencia
        </button>

        {showFormIncidencia && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-4">
            <h4 className="font-bold text-gray-800 text-sm">Nueva Incidencia</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className={labelCls}>Empleado *</label>
                <select className={inputCls} value={formIncidencia.empleado_id} onChange={e => setFormIncidencia(f => ({ ...f, empleado_id: e.target.value }))}>
                  <option value="">— Seleccionar —</option>
                  {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre} {e.apellidos}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Tipo *</label>
                <select className={inputCls} value={formIncidencia.tipo} onChange={e => setFormIncidencia(f => ({ ...f, tipo: e.target.value }))}>
                  {TIPOS_INCIDENCIA.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Fecha inicio</label>
                <input type="date" className={inputCls} value={formIncidencia.fecha_inicio} onChange={e => setFormIncidencia(f => ({ ...f, fecha_inicio: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Fecha fin (si aplica)</label>
                <input type="date" className={inputCls} value={formIncidencia.fecha_fin} onChange={e => setFormIncidencia(f => ({ ...f, fecha_fin: e.target.value }))} />
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className={labelCls}>Descripción</label>
                <input type="text" className={inputCls} placeholder="Detalle de la incidencia…" value={formIncidencia.descripcion} onChange={e => setFormIncidencia(f => ({ ...f, descripcion: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={guardarIncidencia} className="px-5 py-2 text-sm font-semibold text-white rounded-xl" style={{ backgroundColor: '#E2231A' }}>Guardar</button>
              <button onClick={() => setShowFormIncidencia(false)} className="px-5 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancelar</button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                {['Empleado', 'Tipo', 'Desde', 'Hasta', 'Descripción', 'Estado'].map(h => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="6" className="py-10 text-center text-gray-400">Cargando…</td></tr>
              ) : incidencias.length === 0 ? (
                <tr><td colSpan="6" className="py-10 text-center text-gray-400">Sin incidencias registradas.</td></tr>
              ) : incidencias.map(i => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{i.empleados?.nombre} {i.empleados?.apellidos}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">{i.tipo}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{new Date(i.fecha_inicio + 'T12:00').toLocaleDateString('es-ES')}</td>
                  <td className="px-4 py-3 font-mono text-xs">{i.fecha_fin ? new Date(i.fecha_fin + 'T12:00').toLocaleDateString('es-ES') : '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{i.descripcion}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${i.resuelto ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                      {i.resuelto ? 'Resuelto' : 'Pendiente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ─────────────────────────────── TAB: EMPLEADOS ───────────────────────────
  if (tabActiva === 'Empleados') {
    return (
      <div className="space-y-6">
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold text-white ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {toast.msg}
          </div>
        )}
        <button
          onClick={() => setShowFormEmpleado(!showFormEmpleado)}
          className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl"
          style={{ backgroundColor: '#006847' }}
        >
          + Agregar Empleado
        </button>

        {showFormEmpleado && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-4">
            <h4 className="font-bold text-gray-800 text-sm">Nuevo Empleado</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { key: 'nombre',    label: 'Nombre *',    type: 'text' },
                { key: 'apellidos', label: 'Apellidos',   type: 'text' },
                { key: 'nif',       label: 'NIF / NIE',   type: 'text' },
                { key: 'email',     label: 'Email',       type: 'email' },
                { key: 'cargo',     label: 'Cargo',       type: 'text' },
                { key: 'fecha_alta',label: 'Fecha alta',  type: 'date' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className={labelCls}>{label}</label>
                  <input
                    type={type}
                    className={inputCls}
                    value={formEmpleado[key]}
                    onChange={e => setFormEmpleado(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={guardarEmpleado} className="px-5 py-2 text-sm font-semibold text-white rounded-xl" style={{ backgroundColor: '#006847' }}>Guardar</button>
              <button onClick={() => setShowFormEmpleado(false)} className="px-5 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancelar</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {empleados.map(e => (
            <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-lg">
                  {(e.nombre || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{e.nombre} {e.apellidos}</p>
                  <p className="text-xs text-gray-400">{e.cargo || 'Sin cargo definido'}</p>
                </div>
              </div>
              {e.nif   && <p className="text-xs text-gray-500">🪪 {e.nif}</p>}
              {e.email && <p className="text-xs text-gray-500">✉️ {e.email}</p>}
              {e.fecha_alta && <p className="text-xs text-gray-400 mt-2">Alta: {new Date(e.fecha_alta + 'T12:00').toLocaleDateString('es-ES')}</p>}
            </div>
          ))}
          {empleados.length === 0 && !loading && (
            <div className="col-span-3 py-10 text-center text-gray-400">
              No hay empleados dados de alta. Agregá el primero.
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────── TAB: INFORMES ────────────────────────────
  if (tabActiva === 'Informes') {
    // Resumen de horas por empleado este mes
    const mesActual = new Date().toISOString().slice(0, 7);
    const fichajesMes = fichajes.filter(f => f.fecha?.startsWith(mesActual));
    const horasPorEmpleado = empleados.map(e => {
      const horas = fichajesMes
        .filter(f => f.empleado_id === e.id)
        .reduce((a, b) => a + parseFloat(b.horas_trabajadas || 0), 0);
      const dias = fichajesMes.filter(f => f.empleado_id === e.id).length;
      return { ...e, horas: horas.toFixed(1), dias };
    });

    return (
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          📋 <strong>Informe del mes actual</strong> · {new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
        </div>
        <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                {['Empleado', 'Cargo', 'Días trabajados', 'Horas totales', 'Incidencias'].map(h => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {horasPorEmpleado.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{e.nombre} {e.apellidos}</td>
                  <td className="px-4 py-3 text-gray-500">{e.cargo}</td>
                  <td className="px-4 py-3">{e.dias}</td>
                  <td className="px-4 py-3 font-bold">{e.horas}h</td>
                  <td className="px-4 py-3">
                    {incidencias.filter(i => i.empleado_id === e.id && i.fecha_inicio?.startsWith(mesActual)).length || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return null;
};

export default HorariosApp;
