// Pure projections. Schedules, punches and corrections remain separate canonical facts.
export const STATUS = {
  EXPECTED: ['Pendiente', 'neutral', '◷'], PRESENT: ['A tiempo', 'good', '✓'],
  LATE: ['Retraso', 'warning', '◷'], MISSING_CLOCK_IN: ['Falta entrada', 'danger', '!'],
  MISSING_CLOCK_OUT: ['Falta salida', 'warning', '!'], ABSENT: ['Ausente', 'neutral', '—'],
  COMPLETED: ['Finalizado', 'good', '✓'], INCIDENT: ['Incidencia', 'warning', '!'],
};
export function localDate(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(instant));
  const part = type => parts.find(p => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function time(instant, zone) {
  return instant ? new Intl.DateTimeFormat('es-ES', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instant)) : '—';
}
export function addDays(date, days) {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
// Resolve unit wall time without relying on the browser zone. Reject DST gaps.
export function wallInstant(date, clock, zone) {
  const target = Date.parse(`${date}T${clock}:00Z`);
  let value = target;
  for (let i = 0; i < 4; i++) {
    const formatted = new Intl.DateTimeFormat('sv-SE', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(value));
    const delta = target - Date.parse(formatted.replace(' ', 'T') + 'Z');
    if (!delta) return new Date(value).toISOString();
    value += delta;
  }
  throw new Error('Esta hora no existe en la zona de la unidad. Elige otra hora.');
}
export function scheduleInterval(schedule, zone) {
  if (schedule.expectedStartAt && schedule.expectedEndAt) return [schedule.expectedStartAt, schedule.expectedEndAt];
  return [wallInstant(schedule.date, schedule.start, zone), wallInstant(schedule.end <= schedule.start ? addDays(schedule.date, 1) : schedule.date, schedule.end, zone)];
}
export const minutes = (end, start) => end && start ? Math.round((Date.parse(end) - Date.parse(start)) / 60000) : null;
export const duration = value => value == null ? '—' : `${Math.floor(Math.abs(value) / 60)} h ${Math.abs(value) % 60} min`;
export const variance = value => value == null ? '—' : `${value > 0 ? '+' : ''}${value} min`;
export function attendanceProjection(state, employee, schedule, now, zone) {
  const events = state.punches.filter(p => p.employeeId === employee.id && p.scheduleId === schedule.id);
  let clockIn = events.find(p => p.kind === 'IN')?.at;
  let clockOut = events.find(p => p.kind === 'OUT')?.at;
  const correction = state.corrections.filter(c => c.scheduleId === schedule.id && c.employeeId === employee.id).at(-1);
  if (correction) {
    clockIn = correction.clockIn;
    const laterOut = events.filter(p => p.kind === 'OUT' && correction.at && Date.parse(p.at) > Date.parse(correction.at)).at(-1);
    clockOut = laterOut?.at || correction.clockOut;
  }
  const [expectedIn, expectedOut] = scheduleInterval(schedule, zone);
  const arrival = minutes(clockIn, expectedIn), departure = minutes(clockOut, expectedOut);
  const absence = state.absences.find(a => a.employeeId === employee.id && a.status === 'Aprobada' && a.start <= schedule.date && a.end >= schedule.date && !a.partial);
  let status = absence ? 'ABSENT' : clockOut ? 'COMPLETED' : clockIn ? (arrival > 0 ? 'LATE' : 'PRESENT') : Date.parse(now) > Date.parse(expectedIn) ? 'MISSING_CLOCK_IN' : 'EXPECTED';
  if (clockIn && !clockOut && Date.parse(now) > Date.parse(expectedOut)) status = 'MISSING_CLOCK_OUT';
  return { employee, schedule, clockIn, clockOut, arrival, departure, expectedMinutes: minutes(expectedOut, expectedIn), actualMinutes: minutes(clockOut, clockIn), status, corrected: Boolean(correction), incidents: state.incidents.filter(i => i.employeeId === employee.id && i.date === schedule.date && i.status !== 'Resuelta') };
}
