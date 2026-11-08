import { createFixtures } from './fixtures';
import { addDays, localDate, scheduleInterval, wallInstant } from './domain';

const id = () => crypto.randomUUID();
const hash = async (pin, salt) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`)))).map(b => b.toString(16).padStart(2, '0')).join('');

// In-memory ports only. No Supabase, filesystem, messaging provider or persistence.
// A production PIN verifier MUST move behind an authenticated device backend.
export class MockPersonnelService {
  constructor(context) { this.context = context; this.state = createFixtures(context); this.credentials = new Map(); this.attempts = 0; this.blockUntil = 0; this.lastPunch = new Map(); }
  snapshot() { return structuredClone(this.state); }
  employee(employeeId) {
    const employee = this.state.employees.find(e => e.id === employeeId && e.organizationId === this.context.organizationId);
    if (!employee) throw new Error('No se encuentra el empleado en esta organización.');
    return employee;
  }
  saveEmployee(value, employeeId) {
    if (!value.firstName.trim() || !value.lastName.trim() || !value.unitIds.length) throw new Error('Completa nombre, apellidos y unidad.');
    const record = { ...value, id: employeeId || id(), organizationId: this.context.organizationId, name: `${value.firstName.trim()} ${value.lastName.trim()}` };
    if (employeeId) this.employee(employeeId);
    this.state.employees = employeeId ? this.state.employees.map(e => e.id === employeeId ? record : e) : [...this.state.employees, record];
  }
  saveSchedule(value, scheduleId) {
    this.employee(value.employeeId);
    const unit = this.state.units.find(u => u.id === value.unitId);
    if (!unit || !this.employee(value.employeeId).unitIds.includes(unit.id)) throw new Error('El empleado no está asignado a esa unidad.');
    const record = { ...value, id: scheduleId || id(), organizationId: this.context.organizationId };
    const [start, end] = scheduleInterval(record, unit.timeZone);
    if (Date.parse(end) - Date.parse(start) > 16 * 3600000) throw new Error('Revisa el turno: supera las 16 horas.');
    const overlaps = this.state.schedules.some(s => s.employeeId === value.employeeId && s.id !== scheduleId && (() => { const zone = this.state.units.find(u => u.id === s.unitId).timeZone; const [a, b] = scheduleInterval(s, zone); return start < b && end > a; })());
    if (overlaps) throw new Error('Este turno se solapa con otro del empleado.');
    this.state.schedules = scheduleId ? this.state.schedules.map(s => s.id === scheduleId ? record : s) : [...this.state.schedules, record];
  }
  copyWeek(start, unitId) {
    const from = addDays(start, -7), end = addDays(start, -1);
    const source = this.state.schedules.filter(s => s.unitId === unitId && s.date >= from && s.date <= end);
    if (!source.length) throw new Error('No hay turnos en la semana anterior.');
    let count = 0;
    const before = this.snapshot();
    try { source.forEach(s => { const date = addDays(s.date, 7); if (!this.state.schedules.some(t => t.employeeId === s.employeeId && t.date === date)) { this.saveSchedule({ ...s, date }); count++; } }); }
    catch (error) { this.state = before; throw error; }
    return count;
  }
  correct(value, actor) {
    this.employee(value.employeeId);
    if (!value.reason?.trim()) throw new Error('Indica el motivo de la corrección.');
    const unit = this.state.units.find(u => u.id === value.unitId);
    const clockIn = wallInstant(value.date, value.start, unit.timeZone);
    const clockOut = value.end ? wallInstant(value.end <= value.start ? addDays(value.date, 1) : value.date, value.end, unit.timeZone) : undefined;
    this.state.corrections.push({ ...value, id: id(), clockIn, clockOut, actor, at: new Date().toISOString() });
  }
  saveIncident(value, incidentId) {
    this.employee(value.employeeId);
    if (!value.description?.trim()) throw new Error('Añade una descripción breve.');
    const original = this.state.incidents.find(i => i.id === incidentId);
    const record = { ...original, ...value, id: incidentId || id(), createdBy: original?.createdBy || 'Administración demo', createdAt: original?.createdAt || new Date().toISOString() };
    if (record.status === 'Resuelta' && !record.resolution?.trim()) throw new Error('Indica cómo se ha resuelto.');
    this.state.incidents = incidentId ? this.state.incidents.map(i => i.id === incidentId ? record : i) : [...this.state.incidents, record];
  }
  saveAbsence(value, absenceId) {
    this.employee(value.employeeId);
    if (value.end < value.start) throw new Error('La fecha final debe ser igual o posterior al inicio.');
    const type = this.state.absenceTypes.find(t => t.id === value.typeId);
    if (!type) throw new Error('Selecciona un tipo de ausencia.');
    if (value.status === 'Aprobada' && type.document && !value.document) throw new Error('Este tipo requiere un justificante simulado antes de aprobar.');
    const record = { ...value, id: absenceId || id() };
    this.state.absences = absenceId ? this.state.absences.map(a => a.id === absenceId ? record : a) : [...this.state.absences, record];
  }
  async resetPin(employeeId) {
    this.employee(employeeId);
    // Unique within this prototype; no plaintext credential is retained.
    let pin, digest; const salt = id();
    do {
      const bytes = new Uint32Array(1); crypto.getRandomValues(bytes); pin = String(bytes[0] % 10000).padStart(4, '0');
      digest = await hash(pin, salt);
    } while (await this.matchesCredential(pin));
    this.credentials.set(employeeId, { salt, digest });
    return pin;
  }
  async matchesCredential(pin) {
    for (const [employeeId, credential] of this.credentials) if (await hash(pin, credential.salt) === credential.digest) return employeeId;
    return null;
  }
  async punch(pin, unitId, now = new Date().toISOString()) {
    if (Date.now() < this.blockUntil) throw new Error('Demasiados intentos. Espera un minuto.');
    const employeeId = /^\d{4}$/.test(pin) ? await this.matchesCredential(pin) : null;
    const employee = this.state.employees.find(e => e.id === employeeId && e.status === 'ACTIVE' && e.unitIds.includes(unitId));
    if (!employee) { if (++this.attempts >= 5) { this.blockUntil = Date.now() + 60000; this.attempts = 0; } throw new Error('No se ha podido validar el PIN. Inténtalo de nuevo.'); }
    this.attempts = 0;
    if (Date.now() - (this.lastPunch.get(employeeId) || 0) < 5000) throw new Error('Tu fichaje ya se ha registrado. Espera unos segundos.');
    const unit = this.state.units.find(u => u.id === unitId);
    const events = this.state.punches.filter(p => p.employeeId === employeeId && p.unitId === unitId).sort((a, b) => a.at.localeCompare(b.at));
    const last = events.at(-1);
    const kind = last?.kind === 'IN' ? 'OUT' : 'IN';
    const date = localDate(now, unit.timeZone);
    const schedule = kind === 'OUT' ? this.state.schedules.find(s => s.id === last.scheduleId) : this.state.schedules.find(s => s.employeeId === employeeId && s.unitId === unitId && s.date === date);
    const event = { id: id(), employeeId, unitId, scheduleId: schedule?.id || null, kind, at: now };
    this.state.punches.push(event); this.lastPunch.set(employeeId, Date.now());
    return { event, firstName: employee.preferredName || employee.firstName };
  }
  observe(eventId, note) { if (note.trim()) this.state.observations.push({ id: id(), eventId, note: note.trim(), at: new Date().toISOString() }); }
}

// Future application ports: backend implementations must enforce Core authority,
// tenant/unit scope and sensitive-data permissions on EVERY read and mutation.
export class PersonnelNotificationService {
  constructor(personnel) { this.personnel = personnel; }
  compose(employeeId, message, channel = 'WHATSAPP') { const employee = this.personnel.employee(employeeId); return { employeeId, channel, recipient: channel === 'WHATSAPP' ? employee.phone : employee.email, message, status: 'Borrador' }; }
  async simulate(record) {
    if (!record.message.trim()) throw new Error('Escribe el mensaje.');
    const notification = { ...record, id: id(), status: 'Simulada', at: new Date().toISOString() };
    this.personnel.state.notifications.push(notification); return notification;
  }
}
export class PersonnelDocumentStoragePort {
  async upload() { throw new Error('Implementar carga autorizada en backend.'); }
  async download() { throw new Error('Implementar descarga autorizada en backend.'); }
}
export class MockPersonnelDocumentStorage extends PersonnelDocumentStoragePort {
  async upload(file) { return { fileName: file.name, storageReference: `mock:${id()}` }; }
  async download(record) { return new Blob([`Documento de demostración\n${record.title || record.fileName}\nSin contenido personal ni archivo real.`], { type: 'text/plain' }); }
}
