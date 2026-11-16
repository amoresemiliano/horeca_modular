import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Attendance, AttendanceDetail } from '../personal/Attendance';
import { Empty, Field } from '../personal/ui';
import { normalizeSnapshot, personnelCommand, todayIn } from './adminClient';
import HrAdmin from './hr/HrAdmin';
import {hrEnabled,hrRequest} from './hr/client';
import LiveEditor from './LiveEditor';
import EmployeeDirectory from './employees/EmployeeDirectory';
import ScheduleView from './schedule/ScheduleView';
import ScheduleEditor from './schedule/ScheduleEditor';
import { addDays } from '../personal/domain';
import '../personal/personal.css';
import './density.css';
import Pagination, { usePagedList } from './Pagination';
import { usePersonnelUi } from './uiState';
import { getAppConfig } from '../../shared/config/env';
import { devScheduleDiagnostic } from './schedule/calendarPresentation';

function Session({ org, activeUnit, units, tab, can, onNavigate, onUnitChange }) {
  const [unitId, setUnitId] = useState(activeUnit?.id || ''), [state, setState] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(false), [modal, setModal] = useState(null), [row, setRow] = useState(null);
  const [hrRefreshKey,setHrRefreshKey]=useState(0);
  const [search,setSearch] = usePersonnelUi('employees:search','');
  const devices = usePagedList(state?.devices || [],'devices',(state?.devices || []).map(d=>d.id).join(','));
  const ruleSupport = state?.scheduleSupport?.rules, exceptionSupport = state?.scheduleSupport?.exceptions;
  const command = useCallback((action, payload) => {
    const diagnostic = devScheduleDiagnostic(action, {rules:ruleSupport, exceptions:exceptionSupport}, getAppConfig());
    if (diagnostic) return Promise.reject(new Error(diagnostic));
    return personnelCommand(org.id, unitId, action, payload);
  }, [org.id, unitId, ruleSupport, exceptionSupport]);
  const [from, setFrom] = usePersonnelUi(`range:${tab}:from`,addDays(todayIn(org.timezone || 'UTC'), tab==='Hoy'?-2:-31)), [to, setTo] = usePersonnelUi(`range:${tab}:to`,addDays(todayIn(org.timezone || 'UTC'),tab==='Hoy'?2:31));
  const requestVersion = useRef(null);
  const onRange = useCallback((start, end) => { setFrom(start); setTo(end); }, [setFrom,setTo]);
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
      const normalized = normalizeSnapshot(raw, todayIn(zone));
      if(hrEnabled) normalized.approvedLeave = await hrRequest(org.id,unitId,'leave.context',{from,to});
      if (version === requestVersion.current) setState(normalized);
    } catch (err) { if (version === requestVersion.current) { setState(null); setError(err.message); } } finally { if (version === requestVersion.current) setLoading(false); }
  }, [command, org.id, unitId, from, to]);
  useEffect(() => { refresh(); return () => { requestVersion.current = Symbol(); }; }, [refresh, tab]);
  useEffect(() => {
    setModal(null); setRow(null);
  }, [tab]);
  useEffect(() => { const timer = setInterval(() => { if (!document.hidden) refresh(); }, 60000); return () => clearInterval(timer); }, [refresh]);
  useEffect(() => {
    const resume = () => { if (!document.hidden) refresh(); };
    window.addEventListener('focus', resume);
    window.addEventListener('pageshow', resume);
    document.addEventListener('visibilitychange', resume);
    return () => { window.removeEventListener('focus', resume); window.removeEventListener('pageshow', resume); document.removeEventListener('visibilitychange', resume); };
  }, [refresh]);
  const unit = state?.units.find(u => u.id === unitId);
  const open = m => { if (m.kind === 'incident' && hrEnabled) { onNavigate?.('Incidencias'); return; } if (m.kind === 'correction' && !can('personnel.fichajes.audit')) { setError('La corrección requiere permiso de auditoría de fichajes.'); return; } setRow(null); setModal(m); };
  const employees = state?.employees.filter(e => e.unitIds.includes(unitId) && e.name.toLowerCase().includes(search.toLowerCase())) || [];
  async function revoke(deviceId) { try { await command('device.revoke', { deviceId }); await refresh(); } catch (err) { setError(err.message); } }
  return <section className="personnel personnel-dense"><nav className="per-tabs" aria-label="Personal persistente">{['Hoy', 'Asistencia', 'Horarios', 'Empleados', 'Fichaje', ...(hrEnabled ? ['Incidencias','Nóminas','Permisos'] : [])].map(name => <button key={name} aria-current={tab === name ? 'page' : undefined} onClick={() => onNavigate?.(name)}>{name}</button>)}</nav><div className="per-context">{!activeUnit && <Field label="Unidad operativa"><select value={unitId} onChange={e => { setState(null); setModal(null); setRow(null); setUnitId(e.target.value); onUnitChange?.(e.target.value || null); }}><option value="">Selecciona unidad</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>}<small>{state?.date || todayIn(org.timezone || 'UTC')}</small><button onClick={()=>{refresh();setHrRefreshKey(k=>k+1);}}>Actualizar</button></div>
    {error && <p role="alert" className="per-error">{error}</p>}{loading && <p role="status">Cargando personal…</p>}
    {!unitId && <Empty title="Selecciona una unidad operativa" description="Selecciona el local cuyo equipo quieres gestionar." />}
    {unitId && tab === 'Horarios' && <details className="per-range-details"><summary>Consultar otro periodo</summary><div className="per-toolbar"><Field label="Historial desde"><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field><Field label="Hasta"><input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></Field><small>Consulta hasta 93 días por periodo.</small></div></details>}{state && unit && <>
      {['Hoy', 'Asistencia'].includes(tab) && <Attendance {...{ state, unit, open }} now={new Date().toISOString()} today={tab === 'Hoy'} detail={setRow} onRange={onRange} live />}
      {hrEnabled && ['Incidencias','Nóminas','Permisos'].includes(tab) && <HrAdmin key={tab+unitId} orgId={org.id} unitId={unitId} employees={state.employees.filter(e=>e.unitIds.includes(unitId))} section={tab} refreshKey={hrRefreshKey} />}
      {tab === 'Empleados' && <><Field label="Buscar empleado"><input type="search" value={search} onChange={e => setSearch(e.target.value)} /></Field><EmployeeDirectory orgId={org.id} hrRefreshKey={hrRefreshKey} filterKey={search} {...{ employees, state, unit, open, command, refresh, onRange }} detail={setRow} onError={setError} /></>}
      {tab === 'Horarios' && <ScheduleView {...{ state, unit, open, command, refresh, onRange }} onError={setError} />}
      {tab === 'Fichaje' && <><div className="per-section-heading"><div><h2>Dispositivos de fichaje</h2><p>Un dispositivo, una unidad. Sin acceso al directorio ni administración.</p></div><button className="per-primary" onClick={() => open({ kind: 'activate' })}>Activar dispositivo</button></div><div className="per-device-list">{devices.items.map(d => <article className="per-record per-device-row" key={d.id}><strong>{d.label}</strong><span className="per-badge neutral">{d.revoked_at ? 'Revocado' : new Date(d.expires_at) < new Date() ? 'Caducado' : 'Activo'}</span>{!d.revoked_at && <button onClick={() => revoke(d.id)}>Revocar dispositivo</button>}</article>)}</div><Pagination list={devices} label="Dispositivos" />{!state.devices.length && <Empty title="No hay dispositivos activados" />}</>}
      {modal && (['rule','exception'].includes(modal.kind) ? <ScheduleEditor key={`${modal.kind}-${modal.record?.id || modal.employeeId || ''}`} {...{ modal, state, unit, command, refresh }} close={()=>setModal(null)} /> : <LiveEditor key={`${modal.kind}-${modal.record?.id || modal.employeeId || ''}`} {...{ modal, state, unit, command, refresh }} close={() => setModal(null)} />)}
      {row && <AttendanceDetail {...{ row, state, open }} zone={row.schedule.timeZone || unit.timeZone} close={() => setRow(null)} />}
    </>}

  </section>;
}
export default function ProductionPersonnelApp({ tabActiva = 'Hoy', onNavigate }) {
  const { activeOrganization, activeOperationalUnit, availableOperationalUnits, can, switchOperationalUnit } = useAuth();
  if (!activeOrganization || !can('personnel.employees.manage')) return <p role="alert">Acceso restringido a administración de Personal.</p>;
  return <Session key={`${activeOrganization.id}:${activeOperationalUnit?.id || ''}`} org={activeOrganization} activeUnit={activeOperationalUnit} units={availableOperationalUnits || []} tab={tabActiva} can={can} onNavigate={onNavigate} onUnitChange={switchOperationalUnit} />;
}
