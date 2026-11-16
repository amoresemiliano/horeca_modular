import HrAdmin from '../hr/HrAdmin';
import {hrEnabled} from '../hr/shared';
import { Attendance } from '../../personal/Attendance';
import { Avatar, Badge, Empty } from '../../personal/ui';
import ScheduleView from '../schedule/ScheduleView';
import Pagination, { usePagedList } from '../Pagination';
import { usePersonnelUi } from '../uiState';

export default function EmployeeDirectory({ orgId, hrRefreshKey, employees, state, unit, open, detail, command, refresh, onError, onRange, filterKey = '' }) {
  const [selected, setSelected] = usePersonnelUi('employees:selected',null), [tab, setTab] = usePersonnelUi('employees:tab','Resumen');
  const list = usePagedList(employees,'employees',filterKey);
  const employee = employees.find(e => e.id === selected);
  if (employee) return <>
    <button onClick={() => setSelected(null)}>← Volver al equipo</button>
    <div className="per-section-heading"><div className="per-person"><Avatar employee={employee} /><div><h2>{employee.name}</h2><p>{employee.position}</p></div><Badge status={employee.status} /></div><button onClick={() => open({ kind: 'employee', record: employee })}>Editar / desactivar</button></div>
    <nav className="per-tabs per-profile-tabs" aria-label="Ficha del empleado">{['Resumen', 'Asistencia', 'Horarios', ...(hrEnabled?['Incidencias','Nóminas','Permisos']:[])].map(name => <button key={name} aria-current={tab === name ? 'page' : undefined} onClick={() => setTab(name)}>{name}</button>)}</nav>
    {tab === 'Resumen' && <article className="per-record"><dl className="per-dl">{[['Inicio laboral', employee.startDate], ['Contrato', employee.contractType], ['Horas semanales', employee.weeklyHours], ['Móvil', employee.phone], ['Email', employee.email], ['Unidades', state.units.filter(u => employee.unitIds.includes(u.id)).map(u => u.name).join(', ')], ['PIN', employee.pinSet ? 'Configurado' : 'Pendiente']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl><button onClick={() => open({ kind: 'pin', employeeId: employee.id })}>{employee.pinSet ? 'Restablecer PIN' : 'Crear PIN'}</button></article>}
    {tab === 'Asistencia' && <Attendance {...{ state, unit, open, detail, onRange }} employeeId={employee.id} now={new Date().toISOString()} live />}
    {tab === 'Horarios' && <ScheduleView {...{ state, unit, open, command, refresh, onError, onRange }} employeeId={employee.id} refreshKey={hrRefreshKey} />}
    {hrEnabled && ['Incidencias','Nóminas','Permisos'].includes(tab) && <HrAdmin key={tab} orgId={orgId} unitId={unit.id} employees={state.employees} section={tab} employeeId={employee.id} />}
  </>;
  return <><div className="per-section-heading"><h2>Equipo</h2><button className="per-primary" onClick={() => open({ kind: 'employee' })}>+ Nuevo empleado</button></div><div className="per-employee-list">{list.items.map(e => <article className="per-record per-employee-row" key={e.id}><div className="per-person"><Avatar employee={e} /><div><button className="per-name-button" onClick={() => { setSelected(e.id); setTab('Resumen'); }}>{e.name}</button><small>{e.position} · {e.weeklyHours || '—'} h / semana</small></div><Badge status={e.status} /></div><div className="per-actions"><button onClick={() => open({ kind: 'employee', record: e })}>Editar / desactivar</button><button onClick={() => open({ kind: 'pin', employeeId: e.id })}>{e.pinSet ? 'Restablecer PIN' : 'Crear PIN'}</button><button onClick={() => open({ kind: 'rule', employeeId: e.id })}>Horario habitual</button></div></article>)}</div><Pagination list={list} label="Empleados" />{!employees.length && <Empty title="Todavía no hay empleados" />}</>;
}
