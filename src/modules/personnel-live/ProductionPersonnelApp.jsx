import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Attendance, AttendanceDetail } from '../personal/Attendance';
import { Empty, Field } from '../personal/ui';
import { normalizeSnapshot, personnelCommand, todayIn } from './adminClient';
import LiveEditor from './LiveEditor';
import EmployeeDirectory from './employees/EmployeeDirectory';
import ScheduleView from './schedule/ScheduleView';
import { addDays } from '../personal/domain';
import '../personal/personal.css';

function Session({ org, activeUnit, units, tab, can, onNavigate }) {
  const [unitId, setUnitId] = useState(activeUnit?.id || ''), [state, setState] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(false), [modal, setModal] = useState(null), [row, setRow] = useState(null), [search, setSearch] = useState('');
  const command = useCallback((action, payload) => personnelCommand(org.id, unitId, action, payload), [org.id, unitId]);
  const [from, setFrom] = useState(addDays(todayIn(org.timezone || 'UTC'), -31)), [to, setTo] = useState(addDays(todayIn(org.timezone || 'UTC'), 31));
  const requestVersion = useRef(null);
  const onRange = useCallback((start, end) => { setFrom(start); setTo(end); }, []);
  const refresh = useCallback(async () => {
    if (!unitId) return;
    if (!from || !to || to < from || (Date.parse(to) - Date.parse(from)) / 86400000 > 93) { setError('Selecciona un periodo válido de hasta 93 días.'); return; }
    const version = Symbol(); requestVersion.current = version;
    setLoading(true); setError('');
    try {
      // First fetch uses organization zone only as a bounded query anchor; server
      // returns the canonical unit timezone and validates authority itself.
      const raw = await command('snapshot', { from, to });
      const zone = raw.units.find(u => u.id === unitId)?.timeZone;
      if (!zone) throw new Error('La unidad ya no está disponible.');
      if (version === requestVersion.current) setState(normalizeSnapshot(raw, todayIn(zone)));
    } catch (err) { if (version === requestVersion.current) { setState(null); setError(err.message); } } finally { if (version === requestVersion.current) setLoading(false); }
  }, [command, unitId, from, to]);
  useEffect(() => { refresh(); return () => { requestVersion.current = Symbol(); }; }, [refresh]);
  useEffect(() => {
    setModal(null); setRow(null);
    const anchor = todayIn(org.timezone || 'UTC'), span = tab === 'Hoy' ? 2 : 31;
    setFrom(addDays(anchor, -span)); setTo(addDays(anchor, span));
  }, [tab, org.timezone]);
  useEffect(() => { const timer = setInterval(() => { if (!document.hidden) refresh(); }, 60000); return () => clearInterval(timer); }, [refresh]);
  const unit = state?.units.find(u => u.id === unitId);
  const open = m => { if (m.kind === 'incident') { setError('Las incidencias siguen pendientes de una entrega posterior.'); return; } if (m.kind === 'correction' && !can('personnel.fichajes.audit')) { setError('La corrección requiere permiso de auditoría de fichajes.'); return; } setRow(null); setModal(m); };
  const employees = state?.employees.filter(e => e.unitIds.includes(unitId) && e.name.toLowerCase().includes(search.toLowerCase())) || [];
  async function revoke(deviceId) { try { await command('device.revoke', { deviceId }); await refresh(); } catch (err) { setError(err.message); } }
  return <section className="personnel"><nav className="per-tabs" aria-label="Personal persistente">{['Hoy', 'Asistencia', 'Horarios', 'Empleados', 'Fichaje'].map(name => <button key={name} aria-current={tab === name ? 'page' : undefined} onClick={() => onNavigate?.(name)}>{name}</button>)}</nav><div className="per-context"><strong>{org.name} · Personal</strong><Field label="Unidad operativa"><select value={unitId} onChange={e => { setState(null); setModal(null); setRow(null); setUnitId(e.target.value); }}><option value="">Selecciona unidad</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field><button onClick={refresh}>Actualizar</button></div>
    {error && <p role="alert" className="per-error">{error}</p>}{loading && <p role="status">Cargando personal…</p>}
    {!unitId && <Empty title="Selecciona una unidad operativa" description="Selecciona el local cuyo equipo quieres gestionar." />}
    {unitId && tab === 'Horarios' && <div className="per-toolbar"><Field label="Historial desde"><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field><Field label="Hasta"><input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></Field><small>Consulta hasta 93 días por periodo.</small></div>}{state && unit && <><p className="per-muted">{state.date} · {unit.timeZone} · Horario local de la unidad</p>
      {['Hoy', 'Asistencia'].includes(tab) && <Attendance {...{ state, unit, open }} now={new Date().toISOString()} today={tab === 'Hoy'} detail={setRow} onRange={onRange} live />}
      {tab === 'Empleados' && <><Field label="Buscar empleado"><input type="search" value={search} onChange={e => setSearch(e.target.value)} /></Field><EmployeeDirectory {...{ employees, state, unit, open, command, refresh, onRange }} detail={setRow} onError={setError} /></>}
      {tab === 'Horarios' && <ScheduleView {...{ state, unit, open, command, refresh, onRange }} onError={setError} />}
      {tab === 'Fichaje' && <><div className="per-section-heading"><div><h2>Dispositivos de fichaje</h2><p>Un dispositivo, una unidad. Sin acceso al directorio ni administración.</p></div><button className="per-primary" onClick={() => open({ kind: 'activate' })}>Activar dispositivo</button></div>{state.devices.map(d => <article className="per-record" key={d.id}><strong>{d.label}</strong><p>{d.revoked_at ? 'Revocado' : new Date(d.expires_at) < new Date() ? 'Caducado' : 'Activo'}</p>{!d.revoked_at && <button onClick={() => revoke(d.id)}>Revocar dispositivo</button>}</article>)}{!state.devices.length && <Empty title="No hay dispositivos activados" />}</>}
      {modal && <LiveEditor key={`${modal.kind}-${modal.record?.id || modal.employeeId || ''}`} {...{ modal, state, unit, command, refresh }} close={() => setModal(null)} />}
      {row && <AttendanceDetail {...{ row, state, open }} zone={row.schedule.timeZone || unit.timeZone} close={() => setRow(null)} />}
    </>}
    <details className="per-info"><summary>Funciones futuras</summary><p>Incidencias, ausencias, documentos, nóminas y WhatsApp: próximamente. No guardan datos en esta versión.</p></details>
  </section>;
}
export default function ProductionPersonnelApp({ tabActiva = 'Hoy', onNavigate }) {
  const { activeOrganization, activeOperationalUnit, availableOperationalUnits, can } = useAuth();
  if (!activeOrganization || !can('personnel.employees.manage')) return <p role="alert">Acceso restringido a administración de Personal.</p>;
  return <Session key={`${activeOrganization.id}:${activeOperationalUnit?.id || ''}`} org={activeOrganization} activeUnit={activeOperationalUnit} units={availableOperationalUnits || []} tab={tabActiva} can={can} onNavigate={onNavigate} />;
}
