import { useState } from 'react';
import { EmployeeSelect, Field, Modal, SaveBar } from './ui';

const employeeDefaults = { firstName: '', lastName: '', preferredName: '', position: 'Sala', status: 'ACTIVE', weeklyHours: 40, contractType: 'Indefinido', startDate: '2026-11-06', phone: '', email: '', identity: '', address: '', emergency: '', hourlyCost: '', salary: '' };

export default function Editors({ modal, state, service, storage, notifications, unitId, refresh, close, notify }) {
  const { kind, record, employeeId } = modal;
  const [value, setValue] = useState(() => {
    if (record) return { ...record };
    const base = { employeeId: employeeId || '', unitId, date: state.date };
    if (kind === 'employee') return { ...employeeDefaults, unitIds: [unitId] };
    if (kind === 'schedule') return { ...base, start: '10:00', end: '17:00', note: '' };
    if (kind === 'incident') return { ...base, type: state.incidentTypes[0], description: '', status: 'Abierta', resolution: '', scheduleId: '' };
    if (kind === 'absence') return { ...base, typeId: state.absenceTypes.find(t => t.active)?.id || '', start: state.date, end: state.date, partial: false, note: '', status: 'Pendiente', document: '' };
    if (kind === 'document') return { ...base, type: 'Contrato', title: '', issued: state.date, expires: '', notes: '' };
    if (kind === 'payroll') return { ...base, month: '2026-10', gross: '', net: '', employerCost: '', contribution: '', deductions: '', notes: '' };
    if (kind === 'notification') return notifications.compose(employeeId, modal.message);
    if (kind === 'type') return { name: '', active: true, approval: true, document: false, paid: true };
    if (kind === 'correction') return { ...base, scheduleId: modal.row.schedule.id, employeeId: modal.row.employee.id, date: modal.row.schedule.date, start: '', end: '', reason: '' };
    return {};
  });
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [file, setFile] = useState(null), [pin, setPin] = useState('');
  const update = (key, val) => setValue(v => ({ ...v, [key]: val }));
  const text = (key, label, type = 'text', required = false) => <Field label={label}><input type={type} required={required} value={value[key] ?? ''} onChange={e => update(key, e.target.value)} {...(type === 'number' ? { min: 0, step: '0.01' } : {})} /></Field>;
  const select = (key, label, options) => <Field label={label}><select required value={value[key]} onChange={e => update(key, e.target.value)}>{options.map(item => <option key={item} value={item}>{({ ACTIVE: 'Activo', INACTIVE: 'Inactivo', ON_LEAVE: 'De permiso', WHATSAPP: 'WhatsApp', EMAIL: 'Email' })[item] || item}</option>)}</select></Field>;
  const checkbox = (key, label) => <label className="per-check"><input type="checkbox" checked={Boolean(value[key])} onChange={e => update(key, e.target.checked)} />{label}</label>;
  const attachment = <Field label="Adjunto simulado · el archivo no se sube"><input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e => { const next = e.target.files?.[0]; setFile(next || null); if (kind === 'absence') update('document', next?.name || ''); }} /></Field>;
  const titles = { employee: record ? 'Editar empleado' : 'Nuevo empleado', schedule: record ? 'Editar turno' : 'Programar turno', incident: record ? 'Revisar incidencia' : 'Nueva incidencia', absence: record ? 'Revisar ausencia' : 'Registrar ausencia', document: 'Añadir documento', payroll: 'Añadir nómina', notification: 'Notificar al empleado', type: record ? 'Editar tipo de ausencia' : 'Nuevo tipo de ausencia', correction: 'Corregir fichaje', pin: 'Restablecer PIN' };
  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (kind === 'employee') service.saveEmployee(value, record?.id);
      if (kind === 'schedule') service.saveSchedule(value, record?.id);
      if (kind === 'incident') service.saveIncident({ ...value, document: file?.name || value.document || '' }, record?.id);
      if (kind === 'absence') service.saveAbsence(value, record?.id);
      if (kind === 'correction') service.correct(value, 'Administración demo');
      if (kind === 'type') {
        if (!value.name.trim()) throw new Error('Escribe un nombre.');
        if (state.absenceTypes.some(t => t.id !== record?.id && t.name.toLowerCase() === value.name.trim().toLowerCase())) throw new Error('Ya existe un tipo con ese nombre.');
        const type = { ...value, id: record?.id || crypto.randomUUID() };
        service.state.absenceTypes = record ? service.state.absenceTypes.map(t => t.id === record.id ? type : t) : [...service.state.absenceTypes, type];
      }
      if (kind === 'document' || kind === 'payroll') {
        if (!file) throw new Error('Selecciona un archivo de ejemplo.');
        const ref = await storage.upload(file);
        const item = { ...value, ...ref, id: crypto.randomUUID(), uploadedBy: 'Administración demo', uploadedAt: new Date().toISOString() };
        service.state[kind === 'document' ? 'documents' : 'payroll'].push(item);
      }
      if (kind === 'notification') await notifications.simulate(value);
      if (kind === 'pin') { setPin(await service.resetPin(employeeId)); refresh(); setBusy(false); return; }
      refresh(); close(); notify(kind === 'notification' ? 'Notificación simulada. No se ha enviado ningún mensaje.' : 'Cambios guardados en esta sesión de demostración.');
    } catch (err) { setError(err.message); }
    setBusy(false);
  }
  return <Modal title={titles[kind]} onClose={close}><form onSubmit={submit} className="per-form">
    {error && <p className="per-error" role="alert">{error}</p>}
    {['schedule', 'incident', 'absence', 'document', 'payroll'].includes(kind) && <><Field label="Empleado"><EmployeeSelect state={state} value={value.employeeId} onChange={e => update('employeeId', e.target.value)} /></Field>{['schedule', 'incident', 'absence'].includes(kind) && <Field label="Unidad operativa"><select value={value.unitId} onChange={e => update('unitId', e.target.value)}>{state.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>}</>}
    {kind === 'employee' && <><div className="per-form-grid">{text('firstName', 'Nombre', 'text', true)}{text('lastName', 'Apellidos', 'text', true)}{text('preferredName', 'Nombre preferido')}{select('position', 'Puesto', ['Sala', 'Cocina', 'Producción', 'Responsable'])}{select('status', 'Estado', ['ACTIVE', 'INACTIVE', 'ON_LEAVE'])}{text('phone', 'Móvil', 'tel')}{text('email', 'Correo', 'email')}{text('identity', 'DNI / NIE / pasaporte')}{text('startDate', 'Fecha de alta', 'date', true)}{select('contractType', 'Contrato', ['Indefinido', 'Temporal', 'Fijo discontinuo', 'Formación'])}{text('weeklyHours', 'Horas semanales', 'number', true)}</div><fieldset><legend>Unidades asignadas</legend>{state.units.map(u => <label className="per-check" key={u.id}><input type="checkbox" checked={value.unitIds.includes(u.id)} onChange={e => update('unitIds', e.target.checked ? [...value.unitIds, u.id] : value.unitIds.filter(id => id !== u.id))} />{u.name}</label>)}</fieldset><details><summary>Datos personales y económicos restringidos</summary>{text('address', 'Dirección')}{text('emergency', 'Contacto de emergencia')}{text('hourlyCost', 'Coste hora informado (€)', 'number')}{text('salary', 'Salario informado (€)', 'number')}</details></>}
    {kind === 'schedule' && <>{text('date', 'Fecha', 'date', true)}<div className="per-form-grid">{text('start', 'Entrada prevista', 'time', true)}{text('end', 'Salida prevista', 'time', true)}</div><p className="per-muted">Si la salida es anterior a la entrada, termina al día siguiente.</p>{text('note', 'Nota opcional')}</>}
    {kind === 'incident' && <>{text('date', 'Fecha', 'date', true)}{select('type', 'Tipo', state.incidentTypes)}<button type="button" onClick={() => { const name = window.prompt('Nombre del nuevo tipo de incidencia'); if (name?.trim() && !service.state.incidentTypes.includes(name.trim())) { service.state.incidentTypes.push(name.trim()); update('type', name.trim()); refresh(); } }}>+ Nuevo tipo</button><Field label="Descripción"><textarea required value={value.description} onChange={e => update('description', e.target.value)} /></Field><Field label="Turno relacionado (opcional)"><select value={value.scheduleId || ''} onChange={e => update('scheduleId', e.target.value)}><option value="">Sin vincular</option>{state.schedules.filter(s => s.employeeId === value.employeeId && s.date === value.date).map(s => <option value={s.id} key={s.id}>{s.start}–{s.end}</option>)}</select></Field>{select('status', 'Estado', ['Abierta', 'Revisada', 'Resuelta'])}{text('resolution', 'Resolución / notas')}{attachment}</>}
    {kind === 'absence' && <><Field label="Tipo de ausencia"><select required value={value.typeId} onChange={e => update('typeId', e.target.value)}>{state.absenceTypes.filter(t => t.active || t.id === value.typeId).map(t => <option key={t.id} value={t.id}>{t.name}{t.document ? ' · justificante' : ''}</option>)}</select></Field><div className="per-form-grid">{text('start', 'Desde', 'date', true)}{text('end', 'Hasta', 'date', true)}</div>{checkbox('partial', 'Ausencia parcial')}{value.partial && <div className="per-form-grid">{text('fromTime', 'Hora de inicio', 'time', true)}{text('toTime', 'Hora final', 'time', true)}</div>}{select('status', 'Estado', ['Pendiente', 'Aprobada', 'Rechazada', 'Cancelada'])}{text('note', 'Nota opcional')}{attachment}{value.document && <p>Adjunto de ejemplo: {value.document}</p>}</>}
    {kind === 'type' && <>{text('name', 'Nombre', 'text', true)}{checkbox('active', 'Activo')}{checkbox('approval', 'Requiere aprobación')}{checkbox('document', 'Requiere justificante')}{checkbox('paid', 'Retribuido')}</>}
    {kind === 'document' && <>{select('type', 'Tipo', ['Contrato', 'Nómina', 'Certificado médico', 'Baja', 'Identidad', 'Formación', 'Permiso de trabajo', 'Otro'])}{text('title', 'Título', 'text', true)}<div className="per-form-grid">{text('issued', 'Fecha de emisión', 'date', true)}{text('expires', 'Caducidad', 'date')}</div>{text('notes', 'Notas')}{attachment}<p className="per-muted">Solo se conserva el nombre del archivo durante esta sesión.</p></>}
    {kind === 'payroll' && <>{text('month', 'Mes', 'month', true)}<div className="per-form-grid">{text('gross', 'Bruto (€)', 'number', true)}{text('net', 'Neto (€)', 'number', true)}{text('employerCost', 'Coste empresa (€)', 'number')}{text('contribution', 'Cotización empresa (€)', 'number')}{text('deductions', 'Deducciones (€)', 'number')}</div>{text('notes', 'Notas')}{attachment}<p className="per-muted">Importes informados. No se calculan nóminas oficiales.</p></>}
    {kind === 'notification' && <><p>{state.employees.find(e => e.id === employeeId)?.name}</p>{select('channel', 'Canal', ['WHATSAPP', 'EMAIL'])}{text('recipient', 'Destinatario de ejemplo')}<Field label="Mensaje"><textarea required rows={5} value={value.message} onChange={e => update('message', e.target.value)} /></Field><p className="per-muted">Demostración: no se abre WhatsApp ni se contacta al empleado.</p></>}
    {kind === 'correction' && <><p>Se conserva el fichaje original. Se añade una corrección con autor, fecha y motivo.</p><div className="per-form-grid">{text('start', 'Entrada corregida', 'time', true)}{text('end', 'Salida corregida (opcional)', 'time')}</div>{text('reason', 'Motivo', 'text', true)}</>}
    {kind === 'pin' && <><p>Se generará un PIN aleatorio de cuatro dígitos. El anterior dejará de funcionar.</p>{pin && <div className="per-pin-reveal" role="status"><strong>{pin}</strong><p>Anótalo ahora. No volverá a mostrarse. Válido solo en esta sesión y para una unidad asignada.</p></div>}<p className="per-muted">Verificación local de demostración. El terminal real requerirá un servicio seguro.</p></>}
    <fieldset disabled={busy}><SaveBar onClose={close} label={busy ? 'Guardando…' : kind === 'notification' ? 'Simular envío' : kind === 'pin' ? pin ? 'Generar otro PIN' : 'Generar PIN' : 'Guardar'} /></fieldset>
  </form></Modal>;
}
