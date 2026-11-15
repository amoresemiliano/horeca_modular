import {describe,it,expect} from 'vitest';
import {adjacentDate,calendarRange,devScheduleDiagnostic} from '../../src/modules/personnel-live/schedule/calendarPresentation';
describe('Personnel calendar presentation and inspected DEV diagnostics',()=>{
 it('bounds day, week and leap-year month query windows',()=>{
  expect(calendarRange('day','2040-02-12')).toEqual(['2040-02-12','2040-02-12']);
  expect(calendarRange('week','2040-02-27')).toEqual(['2040-02-27','2040-03-04']);
  expect(calendarRange('month','2040-02-12')).toEqual(['2040-02-01','2040-02-29']);
 });
 it('moves by selected view, clamping end-of-month without overflowing',()=>{
  expect(adjacentDate('day','2040-12-31',1)).toBe('2041-01-01');
  expect(adjacentDate('week','2040-11-05',-1)).toBe('2040-10-29');
  expect(adjacentDate('month','2040-01-31',1)).toBe('2040-02-29');
  expect(adjacentDate('month','2040-01-31',-1)).toBe('2039-12-31');
 });
 const dev={isProduction:false,supabase:{url:'https://vmxjqwlfwnphorthhcwu.supabase.co'}};
 it.each([['schedule.rule.save','personnel_schedule_rules'],['schedule.exception.save','personnel_schedule_exceptions']])('diagnoses unsupported %s precisely without success or validation claims',(action,table)=>{
  const message=devScheduleDiagnostic(action,{rules:false,exceptions:false},dev);
  expect(message).toContain(table);expect(message).toContain('no se ha guardado');expect(message).not.toContain('Revisa los datos');
 });
 it('does not override supported, unknown, manual or production behavior',()=>{
  for(const support of [undefined,{rules:true,exceptions:true}])expect(devScheduleDiagnostic('schedule.rule.save',support,dev)).toBe('');
  expect(devScheduleDiagnostic('schedule.save',{rules:false},dev)).toBe('');
  expect(devScheduleDiagnostic('schedule.rule.save',{rules:false},{...dev,isProduction:true})).toBe('');
  expect(devScheduleDiagnostic('schedule.rule.save',{rules:false},{...dev,supabase:{url:'https://production.invalid'}})).toBe('');
 });
});
