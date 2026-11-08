import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Attendance, AttendanceDetail, Schedule } from './Attendance';
import Editors from './Editors';
import EmployeeProfile from './EmployeeProfile';
import Kiosk from './Kiosk';
import { EmployeeDirectory, Records } from './Records';
import { MockPersonnelDocumentStorage, MockPersonnelService, PersonnelNotificationService } from './services';
import { Empty, Field, Modal } from './ui';
import './personal.css';

// Explicit opt-in for a production bundle. No Core registry or grant changes.
export const PERSONNEL_PROTOTYPE = import.meta.env.DEV || import.meta.env.VITE_PERSONNEL_PROTOTYPE === 'true';

function PersonnelSession({ tabActiva, onNavigate, organization, operationalUnit, can, logout }) {
  const service = useMemo(() => new MockPersonnelService({ organizationId: organization.id }), [organization.id]);
  const storage = useMemo(() => new MockPersonnelDocumentStorage(), []);
  const notifications = useMemo(() => new PersonnelNotificationService(service), [service]);
  const [state, setState] = useState(() => service.snapshot()), [modal, setModal] = useState(null), [selected, setSelected] = useState(null), [row, setRow] = useState(null), [unitId, setUnitId] = useState(state.units[0].id), [mode, setMode] = useState('ready'), [toast, setToast] = useState(''), [kiosk, setKiosk] = useState(false), [screen, setScreen] = useState(tabActiva);
  const admin = can('personnel.employees.manage'), clockAllowed = can('personnel.fichajes.write');
  const unit = state.units.find(u => u.id === unitId), employee = state.employees.find(e => e.id === selected);
  const refresh = () => setState(service.snapshot());
  const open = value => { setRow(null); setModal(value); };
  useEffect(() => { setScreen(tabActiva); setSelected(null); setRow(null); setModal(null); }, [tabActiva]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 5000); return () => clearTimeout(timer); }, [toast]);
  // Fixture clock is explicit and stable; kiosk uses real instants in the unit zone.
  const now = '2026-11-06T11:00:00Z';
  if (!admin && !clockAllowed) return <div role="alert">No tienes acceso a Personal en este contexto.</div>;
  return <section className="personnel"><div className="per-prototype"><span>PROTOTIPO INTERACTIVO</span> Datos sintéticos · cambios solo en esta sesión</div><div className="per-context"><div><strong>{organization.name || 'Organización activa'}</strong><small>{operationalUnit?.name ? `Contexto Core: ${operationalUnit.name} · ` : ''}Administración de personal · Demostración</small></div><Field label="Unidad de demostración"><select value={unitId} onChange={e => { setUnitId(e.target.value); setSelected(null); }}>{state.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field></div>
    {admin && <><nav className="per-tabs" aria-label="Personal">{['Hoy', 'Asistencia', 'Incidencias', 'Ausencias', 'Empleados'].map(s => <button key={s} aria-current={screen === s ? 'page' : undefined} onClick={() => { setScreen(s); onNavigate?.(s); setSelected(null); }}>{s}</button>)}</nav><div className="per-toolbar per-utilities"><span>Viernes, 6 noviembre 2026 · {unit.timeZone}</span><button onClick={() => { setScreen('Horarios'); setSelected(null); }}>Horarios</button>{clockAllowed && <button onClick={() => open({ kind: 'terminal' })}>Abrir terminal de fichaje ↗</button>}<details><summary>Estados de demostración</summary><select aria-label="Estado de pantalla" value={mode} onChange={e => setMode(e.target.value)}><option value="ready">Normal</option><option value="loading">Cargando</option><option value="empty">Vacío</option><option value="error">Error</option></select></details></div></>}
    {!admin ? <Empty title="Terminal de fichaje" description="Esta capacidad no concede acceso a la administración de Personal." action={<button className="per-primary" onClick={() => setKiosk(true)}>Iniciar terminal</button>} /> : mode === 'loading' ? <div className="per-skeleton" role="status" aria-busy="true"><p>Cargando el equipo…</p>{[0, 1, 2].map(i => <div key={i} />)}<button onClick={() => setMode('ready')}>Mostrar datos</button></div> : mode === 'error' ? <div className="per-empty" role="alert"><h3>No hemos podido cargar el equipo</h3><p>Vuelve a intentarlo dentro de unos segundos.</p><button onClick={() => setMode('ready')}>Reintentar</button></div> : mode === 'empty' ? <Empty title={`Todavía no hay datos en ${screen.toLowerCase()}`} description="Cuando registres actividad, la encontrarás aquí." action={<button onClick={() => setMode('ready')}>Volver a los datos de ejemplo</button>} /> : employee ? <EmployeeProfile {...{ employee, state, unit, service, storage, open, now, refresh }} detail={setRow} notify={setToast} back={() => setSelected(null)} /> : <>
      {['Hoy', 'Asistencia'].includes(screen) && <Attendance {...{ state, unit, open, now }} today={screen === 'Hoy'} detail={setRow} />}
      {screen === 'Horarios' && <Schedule {...{ state, unit, open, service, refresh }} notify={setToast} />}
      {['Incidencias', 'Ausencias'].includes(screen) && <Records kind={screen === 'Incidencias' ? 'incident' : 'absence'} {...{ state, unit, open }} />}
      {screen === 'Empleados' && <EmployeeDirectory {...{ state, unit, open }} select={setSelected} />}
    </>}
    {row && admin && <AttendanceDetail {...{ row, state }} zone={unit.timeZone} close={() => setRow(null)} open={open} />}
    {modal?.kind === 'terminal' && <Modal title="Preparar terminal" onClose={() => setModal(null)}><div className="per-form"><p>Unidad de demostración: <strong>{unit.name}</strong></p><p>Crea un PIN desde Empleados → ficha → Crear PIN y anótalo antes de entrar.</p><p>El terminal solo mostrará el teclado. Para abandonarlo se cerrará la sesión de la aplicación.</p><p className="per-muted">La autorización de dispositivos sin cuenta de empleado corresponde al futuro backend. Este prototipo requiere una sesión autorizada.</p><button className="per-primary" onClick={() => { setModal(null); setKiosk(true); }}>Iniciar terminal</button></div></Modal>}
    {modal?.kind === 'types' && admin && <Modal title="Tipos de ausencia" onClose={() => setModal(null)}><div className="per-form">{state.absenceTypes.map(t => <button key={t.id} className="per-type-row" onClick={() => open({ kind: 'type', record: t })}><strong>{t.name}</strong><span>{t.active ? 'Activo' : 'Inactivo'}{t.document ? ' · Justificante' : ''} · {t.paid ? 'Retribuido' : 'No retribuido'}</span></button>)}<button className="per-primary" onClick={() => open({ kind: 'type' })}>+ Nuevo tipo</button></div></Modal>}
    {modal && !['types', 'terminal'].includes(modal.kind) && admin && <Editors key={`${modal.kind}-${modal.record?.id || modal.employeeId || ''}`} {...{ modal, state, service, storage, notifications, unitId, refresh }} close={() => setModal(null)} notify={setToast} />}
    {kiosk && clockAllowed && <Kiosk {...{ service, unit, refresh }} onLock={async () => { await logout(); setKiosk(false); }} />}
    {toast && <div className="per-toast" role="status">✓ {toast}<button aria-label="Cerrar aviso" onClick={() => setToast('')}>✕</button></div>}
  </section>;
}

export default function PersonnelApp({ tabActiva = 'Hoy', onNavigate }) {
  const { activeOrganization, activeOperationalUnit, can, logout } = useAuth();
  if (!activeOrganization) return <p>Selecciona una organización para abrir Personal.</p>;
  // Reset all ephemeral state on context change, including open profiles and credentials.
  return <PersonnelSession key={`${activeOrganization.id}:${activeOperationalUnit?.id || 'organization'}`} organization={activeOrganization} operationalUnit={activeOperationalUnit} {...{ tabActiva, onNavigate, can, logout }} />;
}
