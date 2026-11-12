import { useState } from 'react';
import { Attendance } from '../../personal/Attendance';
import { Avatar, Badge, Empty } from '../../personal/ui';
import ScheduleView from '../schedule/ScheduleView';

export default function EmployeeDirectory({ employees, state, unit, open, detail, command, refresh, onError, onRange }) {
  const [selected, setSelected] = useState(null), [tab, setTab] = useState('Resumen');
  const employee = employees.find(e => e.id === selected);
  if (employee) return <>
    <button onClick={() => setSelected(null)}>← Volver al equipo</button>
    <div className="per-section-heading"><div className="per-person"><Avatar employee={employee} /><div><h2>{employee.name}</h2><p>{employee.position}</p></div><Badge status={employee.status} /></div><button onClick={() => open({ kind: 'employee', record: employee })}>Editar / desactivar</button></div>
    <nav className="per-tabs" aria-label="Ficha del empleado">{['Resumen', 'Asistencia', 'Horarios'].map(name => <button key={name} aria-current={tab === name ? 'page' : undefined} onClick={() => setTab(name)}>{name}</button>)}</nav>
    {tab === 'Resumen' && <article className="per-record"><dl className="per-dl">{[['Inicio laboral', employee.startDate], ['Contrato', employee.contractType], ['Horas semanales', employee.weeklyHours], ['Móvil', employee.phone], ['Email', employee.email], ['Unidades', state.units.filter(u => employee.unitIds.includes(u.id)).map(u => u.name).join(', ')], ['PIN', employee.pinSet ? 'Configurado' : 'Pendiente']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl><button onClick={() => open({ kind: 'pin', employeeId: employee.id })}>{employee.pinSet ? 'Restablecer PIN' : 'Crear PIN'}</button></article>}
    {tab === 'Asistencia' && <Attendance {...{ state, unit, open, detail, onRange }} employeeId={employee.id} now={new Date().toISOString()} live />}
    {tab === 'Horarios' && <ScheduleView {...{ state, unit, open, command, refresh, onError, onRange }} employeeId={employee.id} />}
    <p className="per-info">Ausencias · Incidencias · Nóminas · Documentos · WhatsApp: próximamente.</p>
  </>;
  return <><div className="per-section-heading"><h2>Equipo</h2><button className="per-primary" onClick={() => open({ kind: 'employee' })}>+ Nuevo empleado</button></div><div className="per-record-grid">{employees.map(e => <article className="per-record" key={e.id}><div className="per-person"><Avatar employee={e} /><div><button onClick={() => { setSelected(e.id); setTab('Resumen'); }}>{e.name}</button><small>{e.position}</small></div><Badge status={e.status} /></div><p>{e.weeklyHours || '—'} h / semana</p><div className="per-actions"><button onClick={() => open({ kind: 'employee', record: e })}>Editar / desactivar</button><button onClick={() => open({ kind: 'pin', employeeId: e.id })}>{e.pinSet ? 'Restablecer PIN' : 'Crear PIN'}</button><button onClick={() => open({ kind: 'schedule', employeeId: e.id })}>Programar turno</button></div></article>)}</div>{!employees.length && <Empty title="Todavía no hay empleados" />}</>;
}
