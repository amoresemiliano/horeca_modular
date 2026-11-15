import { addDays } from '../../personal/domain';

export function calendarRange(view, date) {
  if (view === 'day') return [date, date];
  if (view === 'month') {
    const first = date.slice(0, 7) + '-01';
    const next = new Date(`${first}T12:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    return [first, addDays(next.toISOString().slice(0, 10), -1)];
  }
  return [date, addDays(date, 6)];
}

export function adjacentDate(view, date, direction) {
  if (view !== 'month') return addDays(date, direction * (view === 'day' ? 1 : 7));
  const next = new Date(`${date.slice(0, 7)}-01T12:00Z`);
  next.setUTCMonth(next.getUTCMonth() + direction);
  const first = next.toISOString().slice(0, 10);
  return `${first.slice(0, 7)}-${String(Math.min(Number(date.slice(8)), Number(calendarRange('month', first)[1].slice(8)))).padStart(2, '0')}`;
}

// Snapshot keys distinguish the installed foundation contract from recurrence.
// This diagnostic is restricted to the inspected DEV target, never production.
export function devScheduleDiagnostic(action, support, config) {
  const feature = action === 'schedule.rule.save' ? 'rules' : action === 'schedule.exception.save' ? 'exceptions' : null;
  if (!feature || support?.[feature] !== false || config.isProduction || config.supabase.url !== 'https://vmxjqwlfwnphorthhcwu.supabase.co') return '';
  return `DEV: no se ha guardado. Falta el esquema y el comando de ${feature === 'rules' ? 'horarios habituales (personnel_schedule_rules)' : 'cambios de un día (personnel_schedule_exceptions)'} en vmxjqwlfwnphorthhcwu. Este paquete no aplica migraciones. Los datos del formulario se conservan.`;
}
