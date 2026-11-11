import { supabase } from '../../lib/supabase';
import { localDate } from '../personal/domain';

export async function personnelCommand(organizationId, unitId, action, payload = {}) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error('La sesión ha caducado. Vuelve a entrar.');
  let response;
  try { response = await fetch('/api/personnel', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ organizationId, unitId, action, payload }) }); }
  catch { throw new Error('No hay conexión. No se han guardado los cambios.'); }
  const result = await response.json();
  if (!response.ok || result.error) {
    const messages = { ACCESS_DENIED: 'No tienes autorización para esta operación.', DENIED: 'Vuelve a iniciar sesión.', STALE_REVISION: 'Otro administrador ha cambiado el registro. Recarga y revisa.', OVERLAPPING_SCHEDULE: 'El turno se solapa con otro horario del empleado.', HISTORICAL_SCHEDULE: 'Este turno ya es histórico. Conserva el horario y añade una corrección de asistencia.', SERVER_NOT_CONFIGURED: 'Personal todavía no está habilitado por Master.', INVALID_INPUT: 'Revisa los datos, fechas y horarios.' };
    throw new Error(messages[result.error] || 'No se pudo completar la operación. Inténtalo de nuevo.');
  }
  return result;
}
export function normalizeSnapshot(raw, date) {
  const employees = raw.employees.map(e => {
    const employment = raw.employment.find(a => a.employee_id === e.id && !a.end_date) || {};
    return { id: e.id, revision: e.revision, firstName: e.first_name, lastName: e.last_name, preferredName: e.preferred_name || '', name: `${e.first_name} ${e.last_name}`, phone: e.phone || '', email: e.email || '', status: e.employment_status, position: employment.position || '', startDate: employment.start_date, weeklyHours: employment.weekly_hours || '', contractType: employment.contract_type || '', pinSet: e.pinSet, unitIds: raw.assignments.filter(a => a.employee_id === e.id && !a.valid_to).map(a => a.operational_unit_id) };
  });
  return { date, units: raw.units, employees, devices: raw.devices, schedules: raw.schedules.map(s => ({ id: s.id, employeeId: s.employee_id, unitId: s.operational_unit_id, date: s.local_date, start: s.expected_start_time.slice(0, 5), end: s.expected_end_time.slice(0, 5), expectedStartAt: s.expected_start_at, expectedEndAt: s.expected_end_at, timeZone: s.timezone, revision: s.revision, note: s.note || '' })), punches: raw.punches.map(p => ({ id: p.id, employeeId: p.employee_id, unitId: p.operational_unit_id, scheduleId: p.schedule_id, sessionId: p.session_id, kind: p.kind, at: p.occurred_at })), corrections: raw.corrections.map(c => ({ ...c, scheduleId: c.schedule_id, employeeId: c.employee_id, clockIn: c.clock_in, clockOut: c.clock_out, actor: c.actor, at: c.created_at })), observations: raw.observations.map(o => ({ id: o.id, eventId: o.punch_id, note: o.observation })), incidents: [], absences: [] };
}
export const todayIn = zone => localDate(new Date(), zone);
