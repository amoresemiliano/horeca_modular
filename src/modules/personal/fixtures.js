import { addDays, wallInstant } from './domain';

export function createFixtures(context) {
  const date = '2026-11-06';
  const units = [{ id: 'demo-dining', name: 'Restaurante · Centro', timeZone: 'Europe/Madrid' }, { id: 'demo-kitchen', name: 'Cocina central', timeZone: 'Europe/Madrid' }];
  const people = [['Lucía', 'Navarro', 'Cocina'], ['Mateo', 'Soler', 'Sala'], ['Inés', 'Vidal', 'Producción'], ['Hugo', 'Serrano', 'Sala'], ['Clara', 'Molina', 'Cocina'], ['Leo', 'Campos', 'Sala'], ['Alba', 'Ríos', 'Cocina'], ['Nora', 'Gil', 'Producción']];
  const employees = people.map(([firstName, lastName, position], i) => ({ id: `demo-employee-${i}`, organizationId: context.organizationId, firstName, lastName, name: `${firstName} ${lastName}`, position, unitIds: [units[i === 7 ? 1 : 0].id], status: i === 7 ? 'INACTIVE' : 'ACTIVE', weeklyHours: 40, contractType: 'Indefinido', startDate: '2026-02-02', phone: '', email: `${firstName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}@example.invalid`, identity: 'Documento sintético', address: '', emergency: '', hourlyCost: '', salary: '' }));
  const schedules = employees.slice(0, 7).flatMap((e, i) => [0, -1, -2, -3, -4, -7, -8, -9, -10, -11].map(day => ({ id: `demo-shift-${i}-${day}`, employeeId: e.id, organizationId: context.organizationId, unitId: units[0].id, date: addDays(date, day), start: i === 2 ? '07:00' : i === 3 ? '17:00' : '10:00', end: i === 2 ? '11:00' : i === 3 ? '23:30' : '17:00', note: '' })));
  const punches = schedules.filter(s => [0, 1, 2, 6].includes(Number(s.employeeId.split('-').at(-1)))).flatMap(s => {
    const i = Number(s.employeeId.split('-').at(-1));
    const entry = { id: `${s.id}-in`, employeeId: s.employeeId, scheduleId: s.id, kind: 'IN', at: wallInstant(s.date, i === 1 ? '10:12' : i === 2 ? '06:58' : '09:59', units[0].timeZone), unitId: s.unitId };
    return i === 2 || s.date < date ? [entry, { ...entry, id: `${s.id}-out`, kind: 'OUT', at: wallInstant(s.date, i === 2 ? '11:03' : '17:04', units[0].timeZone) }] : [entry];
  });
  return { date, units, employees, schedules, punches, corrections: [], observations: [], notifications: [],
    incidentTypes: ['Retraso', 'Salida anticipada', 'Olvido de entrada', 'Olvido de salida', 'Cambio de turno', 'Ausencia injustificada', 'Incidencia médica', 'Accidente laboral', 'Otra'],
    absenceTypes: ['Vacaciones', 'Baja médica', 'Permiso retribuido', 'Permiso no retribuido', 'Maternidad / paternidad', 'Ausencia injustificada', 'Descanso', 'Otro'].map((name, i) => ({ id: `type-${i}`, name, active: true, approval: true, document: i === 1, paid: i !== 3 })),
    incidents: [{ id: 'demo-incident', employeeId: employees[1].id, unitId: units[0].id, date, type: 'Retraso', description: 'Cambio de transporte comunicado al responsable.', status: 'Abierta', resolution: '', createdBy: 'Administración demo', createdAt: `${date}T09:15:00Z`, scheduleId: 'demo-shift-1-0' }],
    absences: [{ id: 'demo-absence', employeeId: employees[4].id, unitId: units[0].id, typeId: 'type-0', start: date, end: addDays(date, 3), status: 'Aprobada', partial: false, note: '', document: '' }, { id: 'demo-medical', employeeId: employees[6].id, unitId: units[0].id, typeId: 'type-1', start: addDays(date, 1), end: addDays(date, 4), status: 'Pendiente', partial: false, note: '', document: 'Justificante sintético.pdf' }],
    documents: [{ id: 'demo-document', employeeId: employees[0].id, type: 'Contrato', title: 'Contrato de incorporación · ejemplo', issued: '2026-02-02', expires: '', fileName: 'contrato-ejemplo.pdf', storageReference: 'mock:contract', uploadedBy: 'Administración demo', uploadedAt: `${date}T09:00:00Z` }],
    payroll: [{ id: 'demo-payroll', employeeId: employees[0].id, month: '2026-10', gross: 1850, net: 1535, employerCost: 2440, contribution: 590, deductions: 315, fileName: 'nomina-ejemplo.pdf', notes: 'Importes sintéticos facilitados; sin cálculo de nómina.' }],
  };
}
