import { describe, expect, it } from 'vitest';
import { attendanceProjection, scheduleInterval } from '../../src/modules/personal/domain';
import { normalizeSnapshot } from '../../src/modules/personnel-live/adminClient';

// normalizeSnapshot imports the configured client but never executes a request.
describe('Persisted Personnel projections',()=>{
 it('combines a corrected forgotten IN with a later real OUT',()=>{
  const employee={id:'e'},schedule={id:'s',date:'2026-11-10',start:'10:00',end:'17:00'};
  const state={punches:[{employeeId:'e',scheduleId:'s',kind:'OUT',at:'2026-11-10T16:04:00Z'}],corrections:[{employeeId:'e',scheduleId:'s',clockIn:'2026-11-10T09:00:00Z',clockOut:null,at:'2026-11-10T12:00:00Z'}],incidents:[],absences:[]};
  expect(attendanceProjection(state,employee,schedule,'2026-11-10T18:00:00Z','Europe/Madrid')).toMatchObject({status:'COMPLETED',actualMinutes:424,arrival:0,departure:4});
 });
 it('uses canonical stored instants across timezone changes and derives variances',()=>{
  const employee={id:'employee'},schedule={id:'schedule',date:'2026-11-10',start:'10:00',end:'17:00',expectedStartAt:'2026-11-10T09:00:00Z',expectedEndAt:'2026-11-10T16:00:00Z'};
  const state={punches:[{employeeId:'employee',scheduleId:'schedule',kind:'IN',at:'2026-11-10T09:12:00Z'},{employeeId:'employee',scheduleId:'schedule',kind:'OUT',at:'2026-11-10T16:04:00Z'}],corrections:[],incidents:[],absences:[]};
  expect(scheduleInterval(schedule,'Pacific/Honolulu')).toEqual([schedule.expectedStartAt,schedule.expectedEndAt]);
  const row=attendanceProjection(state,employee,schedule,'2026-11-10T18:00:00Z','Europe/Madrid');
  expect(row.arrival).toBe(12);expect(row.departure).toBe(4);expect(row.expectedMinutes).toBe(420);expect(row.actualMinutes).toBe(412);
 });
 it('normalizes only safe admin projection fields, no hash or device secrets',()=>{
  const state=normalizeSnapshot({employees:[{id:'e',first_name:'Synthetic',last_name:'Employee',employment_status:'ACTIVE',revision:1}],employment:[],assignments:[],units:[],schedules:[],punches:[],corrections:[],observations:[],devices:[]},'2026-11-10');
  expect(state.employees[0].name).toBe('Synthetic Employee');expect(JSON.stringify(state)).not.toContain('password_hash');
 });
});
