import { describe, expect, it, vi } from 'vitest';
import { attendanceProjection, scheduleInterval, wallInstant, minutes, localDate } from '../../src/modules/personal/domain';
import { MockPersonnelService, PersonnelNotificationService, MockPersonnelDocumentStorage } from '../../src/modules/personal/services';

const create = () => new MockPersonnelService({ organizationId: 'synthetic-org' });
describe('Personnel prototype domain and mock ports', () => {
  it('derives expected/actual differences without replacing the schedule', () => {
    const service = create(), state = service.snapshot();
    const schedule = state.schedules.find(s => s.employeeId === 'demo-employee-1' && s.date === '2026-11-05');
    const row = attendanceProjection(state, service.employee(schedule.employeeId), schedule, '2026-11-06T11:00:00Z', 'Europe/Madrid');
    expect(row.arrival).toBe(12); expect(row.departure).toBe(4); expect(row.actualMinutes).toBe(412); expect(schedule.start).toBe('10:00');
  });
  it('handles overnight shifts, unit day boundaries and DST gaps', () => {
    const interval = scheduleInterval({ date: '2026-11-06', start: '23:00', end: '07:00' }, 'Europe/Madrid');
    expect(minutes(interval[1], interval[0])).toBe(480);
    expect(localDate('2026-11-06T23:30:00Z', 'Europe/Madrid')).toBe('2026-11-07');
    expect(wallInstant('2026-07-06', '10:00', 'Europe/Madrid')).toBe('2026-07-06T08:00:00.000Z');
    expect(() => wallInstant('2026-03-29', '02:30', 'Europe/Madrid')).toThrow();
  });
  it('keeps original punches and appends attributed corrections', () => {
    const service = create(), original = structuredClone(service.state.punches);
    service.correct({ employeeId: 'demo-employee-1', scheduleId: 'demo-shift-1-0', unitId: 'demo-dining', date: '2026-11-06', start: '10:00', end: '17:00', reason: 'Reloj revisado' }, 'Actor demo');
    expect(service.state.punches).toEqual(original); expect(service.state.corrections[0].actor).toBe('Actor demo');
    expect(() => service.correct({ employeeId: 'demo-employee-1', reason: '' }, 'Actor')).toThrow();
  });
  it('rejects overlapping schedules and copies only missing shifts', () => {
    const service = create(), shift = service.state.schedules[0];
    expect(() => service.saveSchedule({ ...shift, start: '11:00' })).toThrow(/solapa/);
    expect(service.copyWeek('2026-11-02', 'demo-dining')).toBe(0);
    expect(service.copyWeek('2026-11-09', 'demo-dining')).toBeGreaterThan(0);
  });
  it('generates non-retrievable credentials and records in/out with duplicate suppression', async () => {
    const service = create(), employeeId = 'demo-employee-3';
    const pin = await service.resetPin(employeeId);
    expect(pin).toMatch(/^\d{4}$/); expect(JSON.stringify(service.credentials.get(employeeId))).not.toContain(`"${pin}"`);
    const first = await service.punch(pin, 'demo-dining', '2026-11-06T16:00:00Z');
    expect(first.event.kind).toBe('IN');
    await expect(service.punch(pin, 'demo-dining')).rejects.toThrow(/ya se ha registrado/);
    service.lastPunch.clear();
    expect((await service.punch(pin, 'demo-dining', '2026-11-06T22:30:00Z')).event.kind).toBe('OUT');
    service.lastPunch.clear();
    await expect(service.punch(pin, 'demo-kitchen')).rejects.toThrow(/validar/);
    service.employee(employeeId).status = 'INACTIVE';
    await expect(service.punch(pin, 'demo-dining')).rejects.toThrow(/validar/);
  });
  it('throttles unsuccessful attempts without disclosing an identity', async () => {
    const service = create();
    for (let i = 0; i < 5; i++) await expect(service.punch('invalid', 'demo-dining')).rejects.toThrow(/validar/);
    await expect(service.punch('invalid', 'demo-dining')).rejects.toThrow(/Espera un minuto/);
  });
  it('rejects invalid absence ranges and missing required documents', () => {
    const service = create();
    expect(() => service.saveAbsence({ employeeId: 'demo-employee-0', typeId: 'type-1', start: '2026-11-06', end: '2026-11-05' })).toThrow(/fecha final/);
    expect(() => service.saveAbsence({ employeeId: 'demo-employee-0', typeId: 'type-1', start: '2026-11-06', end: '2026-11-07', status: 'Aprobada' })).toThrow(/justificante/);
    expect(() => service.employee('outside-tenant')).toThrow(/organización/);
  });
  it('simulates files and notifications without network or retained binary', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const service = create(), notifications = new PersonnelNotificationService(service), storage = new MockPersonnelDocumentStorage();
    const record = notifications.compose('demo-employee-0', 'Mensaje sintético');
    expect((await notifications.simulate(record)).status).toBe('Simulada');
    expect((await storage.upload({ name: 'ejemplo.pdf' })).storageReference).toMatch(/^mock:/);
    expect(await (await storage.download({ title: 'Ejemplo' })).text()).toContain('Sin contenido personal');
    expect(fetch).not.toHaveBeenCalled(); fetch.mockRestore();
  });
});
