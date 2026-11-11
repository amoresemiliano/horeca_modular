import { useState } from 'react';
import { Field, Modal, SaveBar } from '../personal/ui';
import { addDays, wallInstant } from '../personal/domain';

export default function LiveEditor({ modal, state, unit, command, refresh, close }) {
  const { kind, record, employeeId, row } = modal;
  const [value, setValue] = useState(() => record ? { ...record } : kind === 'employee' ? { firstName: '', lastName: '', preferredName: '', phone: '', email: '', status: 'ACTIVE', position: '', startDate: state.date, contractType: '', weeklyHours: '', unitIds: [unit.id] } : kind === 'schedule' ? { employeeId: employeeId || '', date: state.date, start: '10:00', end: '17:00', note: '' } : kind === 'correction' ? { start: '', end: '', reason: '' } : { label: '' });
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [secret, setSecret] = useState('');
  const set = (key, val) => setValue(v => ({ ...v, [key]: val }));
  const field = (key, label, type = 'text', required = false) => <Field label={label}><input required={required} type={type} value={value[key] || ''} min={type === 'number' ? 0 : undefined} onChange={e => set(key, e.target.value)} /></Field>;
  const employee = <Field label="Empleado"><select required value={value.employeeId || ''} onChange={e => set('employeeId', e.target.value)}><option value="">Selecciona un empleado</option>{state.employees.filter(e => e.status === 'ACTIVE' && e.unitIds.includes(unit.id)).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>;
  async function save(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (kind === 'pin') { const result = await command('pin.reset', { employeeId }); setSecret(result.pin); await refresh(); return; }
      if (kind === 'activate') { const result = await command('device.activate', { label: value.label }); setSecret(result.activationUrl); return; }
      if (kind === 'employee') await command('employee.save', value);
      if (kind === 'schedule') await command('schedule.save', value);
      if (kind === 'correction') await command('attendance.correct', { employeeId: row.employee.id, scheduleId: row.schedule.id, clockIn: wallInstant(row.schedule.date, value.start, row.schedule.timeZone || unit.timeZone), clockOut: value.end ? wallInstant(value.end <= value.start ? addDays(row.schedule.date, 1) : row.schedule.date, value.end, row.schedule.timeZone || unit.timeZone) : null, reason: value.reason });
      await refresh(); close();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <Modal title={({ employee: record ? 'Editar empleado' : 'Nuevo empleado', schedule: record ? 'Editar turno' : 'Programar turno', correction: 'Corregir asistencia', activate: 'Activar dispositivo', pin: 'Restablecer PIN' })[kind]} onClose={close}><form className="per-form" onSubmit={save}>
    {error && <p role="alert" className="per-error">{error}</p>}
    {kind === 'employee' && <><div className="per-form-grid">{field('firstName', 'Nombre', 'text', true)}{field('lastName', 'Apellidos', 'text', true)}{field('preferredName', 'Nombre preferido')}{field('position', 'Puesto', 'text', true)}{field('phone', 'Móvil', 'tel')}{field('email', 'Email', 'email')}{field('startDate', 'Inicio laboral', 'date', true)}{field('weeklyHours', 'Horas semanales', 'number')}{field('contractType', 'Tipo de contrato')}</div><Field label="Estado"><select value={value.status} onChange={e => set('status', e.target.value)}><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option><option value="ON_LEAVE">De permiso</option></select></Field><fieldset><legend>Unidades asignadas</legend>{state.units.map(u => <label className="per-check" key={u.id}><input type="checkbox" checked={value.unitIds.includes(u.id)} onChange={e => set('unitIds', e.target.checked ? [...value.unitIds, u.id] : value.unitIds.filter(id => id !== u.id))} />{u.name}</label>)}</fieldset><small>Desactivar conserva su historial. El empleado no necesita cuenta de HORECA.</small></>}
    {kind === 'schedule' && <>{employee}{field('date', 'Fecha', 'date', true)}<div className="per-form-grid">{field('start', 'Entrada prevista', 'time', true)}{field('end', 'Salida prevista', 'time', true)}</div>{field('note', 'Nota')}<small>Salida anterior a entrada: termina al día siguiente. No se modifican turnos históricos.</small></>}
    {kind === 'correction' && <><p>El fichaje original se conserva. Se registra tu identidad y el motivo.</p>{field('start', 'Entrada corregida', 'time', true)}{field('end', 'Salida corregida', 'time')}{field('reason', 'Motivo', 'text', true)}</>}
    {kind === 'activate' && <>{field('label', 'Nombre del dispositivo', 'text', true)}<p>El enlace caduca en diez minutos y solo puede usarse una vez. El dispositivo queda autorizado únicamente para fichajes en {unit.name}.</p>{secret && <div role="status"><p>Comparte este enlace una sola vez con el dispositivo:</p><textarea readOnly value={secret} aria-label="Enlace de activación" /><p>No es una sesión de administración.</p></div>}</>}
    {kind === 'pin' && <><p>Genera un nuevo PIN de cuatro dígitos. El anterior dejará de funcionar inmediatamente.</p>{secret && <div className="per-pin-reveal" role="status"><strong>{secret}</strong><p>Anótalo ahora. Al cerrar no se puede recuperar.</p></div>}</>}
    <fieldset disabled={busy || Boolean(secret)}><SaveBar onClose={close} label={busy ? 'Guardando…' : ['pin', 'activate'].includes(kind) ? 'Generar' : 'Guardar'} /></fieldset>{secret && <button type="button" onClick={close}>Cerrar y ocultar</button>}
  </form></Modal>;
}
