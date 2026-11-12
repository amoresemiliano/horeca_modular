import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { hashPin, pinLookup, tokenHash, verifyPin } from '../../server/personnel/security';

const org=randomUUID(), foreign=randomUUID(), unit=randomUUID(), other=randomUUID(), owner=randomUUID(), worker=randomUUID();
const pepper='synthetic-test-pepper-never-a-production-secret';
describe('Personnel real PostgreSQL contracts, RLS and device commands (ephemeral only)',()=>{
 let db:PGlite;
 beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
   CREATE TABLE auth.users(id uuid PRIMARY KEY);
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; GRANT USAGE ON SCHEMA auth TO authenticated,anon;`);
  for(const name of ['20260926000000_horeca_core_baseline.sql','20260927000000_ccr_fin_001_core_authorization.sql','20261002030000_core_module_entitlement_registry.sql','20261110090000_personnel_attendance_foundation.sql','20261111100000_personnel_push_reminders.sql']) await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
 },60000);
 afterAll(async()=>{await db?.close()});
 beforeEach(async()=>{
  await db.exec('BEGIN');
  for(const actor of [owner,worker]){
   await db.query<Record<string,unknown>>('INSERT INTO auth.users VALUES($1)',[actor]);
   await db.query<Record<string,unknown>>('INSERT INTO public.eco_user_profiles(id,auth_user_id) VALUES($1,$1)',[actor]);
  }
  await db.query<Record<string,unknown>>("INSERT INTO public.eco_organizations(id,code,name) VALUES($1,'HORECA_DEV_LAB','HORECA DEV LAB'),($2,'SYNTHETIC_OTHER','Synthetic other tenant')",[org,foreign]);
  await db.query<Record<string,unknown>>("INSERT INTO public.eco_operational_units(id,organization_id,code,name,unit_type) VALUES($1,$3,'A','Synthetic A','LOCAL'),($2,$3,'B','Synthetic B','LOCAL')",[unit,other,org]);
  await db.query<Record<string,unknown>>("INSERT INTO public.eco_organization_module_entitlements(organization_id,module_key,is_enabled) VALUES($1,'personal',true)",[org]);
  for(const [actor,role] of [[owner,'OWNER'],[worker,'PRODUCTION']]) await db.query<Record<string,unknown>>('INSERT INTO public.eco_organization_members(organization_id,user_id,role_template_id,is_organization_wide) SELECT $1,$2,id,true FROM public.eco_role_templates WHERE code=$3',[org,actor,role]);
 });
 afterEach(async()=>{await db.exec('ROLLBACK')});
 async function run(role:string,actor:string,sql:string,params:unknown[]=[]):Promise<Record<string,unknown>[]> {
  await db.exec('SAVEPOINT command');
  try {await db.exec('SET LOCAL ROLE '+role);await db.query<Record<string,unknown>>("SELECT set_config('request.jwt.claim.sub',$1,true)",[actor]); const result=await db.query<Record<string,unknown>>(sql,params);await db.exec('RESET ROLE; RELEASE SAVEPOINT command');return result.rows;}
  catch(e){await db.exec('ROLLBACK TO SAVEPOINT command; RELEASE SAVEPOINT command');throw e;}
 }
 const admin=async(action:string,body:object={},actor=owner,organization=org,opunit:string|null=unit)=>(await run('authenticated',actor,'SELECT public.personnel_admin_command($1,$2,$3,$4) result',[organization,opunit,action,JSON.stringify(body)]))[0].result as Record<string,unknown>;
 const device=async(action:string,token:string,body:object={},role='service_role')=>(await run(role,'','SELECT public.personnel_device_command($1,$2,$3,$4) result',[action,tokenHash(token),'synthetic-ip',JSON.stringify(body)]))[0].result as Record<string,unknown>;
 async function employee(){return (await admin('employee.save',{firstName:'Synthetic',lastName:'Employee',position:'Sala',startDate:'2026-01-01',unitIds:[unit]})).id as string;}
 async function activated(label='Test mobile') {const token=randomUUID(); await admin('device.activate',{tokenHash:tokenHash(token),label}); const credential=randomUUID(); expect(await device('activate',token,{deviceHash:tokenHash(credential)})).toEqual({ok:true});return {credential,token};}
 async function pin(eid:string,raw='1648') {await admin('pin.reset',{employeeId:eid,lookup:pinLookup(org,raw,pepper),hash:await hashPin(raw,pepper)});return raw;}
 async function punch(credential:string,raw:string,requestId=randomUUID()) {const prepared=await device('prepare',credential,{lookup:pinLookup(org,raw,pepper),requestId});if(prepared.error)return prepared;return device('execute',credential,{attemptId:prepared.attemptId,verified:prepared.hash?await verifyPin(raw,String(prepared.hash),pepper):false});}

 it('gates admin by canonical capability, entitlement, revoke and tenant',async()=>{
  await expect(admin('employee.save',{},worker)).rejects.toThrow('ACCESS_DENIED');
  await expect(admin('employee.save',{},owner,foreign)).rejects.toThrow('ACCESS_DENIED');
  await db.query<Record<string,unknown>>("UPDATE public.eco_organization_module_entitlements SET is_enabled=false WHERE organization_id=$1",[org]);
  await expect(employee()).rejects.toThrow('ACCESS_DENIED');
  await db.query<Record<string,unknown>>("UPDATE public.eco_organization_module_entitlements SET is_enabled=true WHERE organization_id=$1",[org]);
  await db.query<Record<string,unknown>>("INSERT INTO public.eco_member_capability_overrides(membership_id,organization_id,capability_id,effect) SELECT m.id,$1,c.id,'REVOKE' FROM public.eco_organization_members m CROSS JOIN public.eco_capabilities c WHERE m.user_id=$2 AND c.code='personnel.employees.manage'",[org,owner]);
  await expect(employee()).rejects.toThrow('ACCESS_DENIED');
 });
 it('denies anonymous table access, private credentials and device RPC to app users',async()=>{
  await employee();
  for(const role of ['anon','authenticated']){
   await expect(run(role,owner,'SELECT * FROM public.personnel_employees')).rejects.toThrow(/permission denied/);
   await expect(run(role,owner,'SELECT * FROM personnel_private.pin_credentials')).rejects.toThrow(/permission denied/);
   await expect(device('session','invalid',{},role)).rejects.toThrow(/permission denied/);
   await expect(run(role,owner,"INSERT INTO public.personnel_employees(organization_id,first_name,last_name) VALUES($1,'x','y')",[org])).rejects.toThrow(/permission denied/);
  }
 });
 it('makes activation expiring, single-use, scoped, minimal and revocable',async()=>{
  const {credential,token}=await activated();
  expect(await device('activate',token,{deviceHash:tokenHash('second')})).toEqual({error:'INVALID_DEVICE'});
  const session=await device('session',credential);expect(Object.keys(session).sort()).toEqual(['organization','timeZone','unit']);
  const snapshot=await admin('snapshot',{from:'2026-01-01',to:'2026-01-02'});const devices=snapshot.devices as {id:string}[];
  await admin('device.revoke',{deviceId:devices[0].id});expect(await device('session',credential)).toEqual({error:'INVALID_DEVICE'});
  const expired='expired';await admin('device.activate',{tokenHash:tokenHash(expired),label:'Expired'});
  await db.query<Record<string,unknown>>("UPDATE personnel_private.activations SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[tokenHash(expired)]);
  expect(await device('activate',expired,{deviceHash:tokenHash('no')})).toEqual({error:'INVALID_DEVICE'});
 });
 it('persists immutable IN and idempotent retry; suppresses double tap across devices',async()=>{
  const eid=await employee(),raw=await pin(eid),a=await activated(),b=await activated('Second');const request=randomUUID();
  const first=await punch(a.credential,raw,request);expect(first.kind).toBe('IN');expect(Object.keys(first).sort()).toEqual(['firstName','id','kind','occurredAt']);
  expect(await punch(a.credential,raw,request)).toEqual(first);
  expect(await punch(b.credential,raw)).toEqual({error:'DUPLICATE_PUNCH'});
  await expect(db.query<Record<string,unknown>>('UPDATE public.personnel_attendance_punches SET kind=\'OUT\' WHERE id=$1',[first.id])).rejects.toThrow('IMMUTABLE_EVENT');
 });
 it('treats unknown, inactive, wrong unit and reset PIN uniformly and records no attempted PIN',async()=>{
  const eid=await employee(),raw=await pin(eid),a=await activated();
  expect(await punch(a.credential,'9999')).toEqual({error:'PIN_REJECTED'});
  const prepared=await device('prepare',a.credential,{lookup:pinLookup(org,raw,pepper),requestId:randomUUID()});
  await pin(eid,'2839');expect(await device('execute',a.credential,{attemptId:prepared.attemptId,verified:true})).toEqual({error:'PIN_REJECTED'});
  expect(await punch(a.credential,raw)).toEqual({error:'PIN_REJECTED'});
  await db.query<Record<string,unknown>>("UPDATE public.personnel_employees SET employment_status='INACTIVE' WHERE id=$1",[eid]);expect(await punch(a.credential,'2839')).toEqual({error:'PIN_REJECTED'});
  await db.query<Record<string,unknown>>("UPDATE public.personnel_employees SET employment_status='ACTIVE' WHERE id=$1",[eid]);
  await db.query<Record<string,unknown>>('UPDATE public.personnel_unit_assignments SET valid_to=valid_from WHERE employee_id=$1',[eid]);expect(await punch(a.credential,'2839')).toEqual({error:'PIN_REJECTED'});
  const audit=JSON.stringify((await db.query<Record<string,unknown>>('SELECT * FROM personnel_private.audit')).rows);expect(audit).not.toContain(raw);expect(audit).not.toContain('2839');
 });
 it('enforces database-backed budgets and one-use attempt permits',async()=>{
  const a=await activated();let result:Record<string,unknown>={};
  for(let i=0;i<9;i++)result=await device('prepare',a.credential,{lookup:'x',requestId:randomUUID()});
  expect(result).toEqual({error:'PIN_REJECTED'});
  expect((await db.query<Record<string,unknown>>("SELECT count(*) n FROM personnel_private.audit WHERE event='THROTTLED'")).rows[0]).toMatchObject({n:1});
 });
 it('validates future schedules, overlap, revisions, overnight and immutable history',async()=>{
  const eid=await employee();const draft={employeeId:eid,date:'2040-11-05',start:'23:00',end:'07:00'};const saved=await admin('schedule.save',draft);
  await expect(admin('schedule.save',{...draft,start:'23:30'})).rejects.toThrow('OVERLAPPING_SCHEDULE');
  await expect(admin('schedule.save',{...draft,id:saved.id,revision:0})).rejects.toThrow('STALE_REVISION');
  await admin('schedule.save',{...draft,id:saved.id,revision:1,end:'08:00'});
  expect((await db.query<Record<string,unknown>>('SELECT count(*)::int n FROM personnel_private.schedule_history')).rows[0].n).toBe(1);
  await expect(admin('schedule.save',{...draft,date:'2040-03-25',start:'02:30',end:'05:00'})).rejects.toThrow('INVALID_INPUT');
 });
 it('records OUT against the original overnight session and unit timezone date',async()=>{
  const eid=await employee(),raw=await pin(eid),a=await activated();const d=(await db.query<Record<string,unknown>>('SELECT id FROM public.personnel_punch_devices')).rows[0].id;
  const sid=randomUUID();
  await db.query<Record<string,unknown>>("INSERT INTO public.personnel_attendance_punches(organization_id,operational_unit_id,employee_id,device_id,kind,occurred_at,local_date,timezone,session_id,request_id) VALUES($1,$2,$3,$4,'IN',now()-interval '8 hours',(now() AT TIME ZONE 'Europe/Madrid')::date-1,'Europe/Madrid',$5,$6)",[org,unit,eid,d,sid,randomUUID()]);
  expect((await punch(a.credential,raw)).kind).toBe('OUT');
  const row=(await db.query<Record<string,unknown>>("SELECT * FROM public.personnel_attendance_punches WHERE kind='OUT'")).rows[0];expect(row.session_id).toBe(sid);
  await device('observe',a.credential,{punchId:row.id,observation:'Synthetic observation'});
  expect((await db.query<Record<string,unknown>>('SELECT count(*)::int n FROM public.personnel_punch_observations')).rows[0].n).toBe(1);
 });
 it('rejects a valid PIN at a different unit without employee enumeration',async()=>{
  const eid=await employee(),raw=await pin(eid),activation=randomUUID(),credential=randomUUID();
  await admin('device.activate',{tokenHash:tokenHash(activation),label:'Other unit'},owner,org,other);
  await device('activate',activation,{deviceHash:tokenHash(credential)});
  expect(await punch(credential,raw)).toEqual({error:'PIN_REJECTED'});
  await expect(admin('snapshot',{from:'2026-01-01',to:'2026-01-02'},owner,org,randomUUID())).rejects.toThrow('ACCESS_DENIED');
 });
 it('rechecks revocation and permit expiry between hash verification and commit',async()=>{
  const eid=await employee(),raw=await pin(eid),a=await activated();
  const prepared=await device('prepare',a.credential,{lookup:pinLookup(org,raw,pepper),requestId:randomUUID()});
  await db.query<Record<string,unknown>>("UPDATE personnel_private.attempts SET expires_at=now()-interval '1 second' WHERE id=$1",[prepared.attemptId]);
  expect(await device('execute',a.credential,{attemptId:prepared.attemptId,verified:true})).toEqual({error:'PIN_REJECTED'});
  const next=await device('prepare',a.credential,{lookup:pinLookup(org,raw,pepper),requestId:randomUUID()});
  await db.exec('UPDATE public.personnel_punch_devices SET revoked_at=now()');
  expect(await device('execute',a.credential,{attemptId:next.attemptId,verified:true})).toEqual({error:'INVALID_DEVICE'});
  expect((await db.query<Record<string,unknown>>('SELECT count(*)::int n FROM public.personnel_attendance_punches')).rows[0].n).toBe(0);
 });
 it('uses a canonical unit zone when Core provides one, otherwise organization inheritance',async()=>{
  await db.exec('ALTER TABLE public.eco_operational_units ADD COLUMN timezone text');
  await db.query<Record<string,unknown>>("UPDATE public.eco_operational_units SET timezone='Pacific/Kiritimati' WHERE id=$1",[unit]);
  const eid=await employee(),raw=await pin(eid),a=await activated();
  expect((await device('session',a.credential)).timeZone).toBe('Pacific/Kiritimati');
  await punch(a.credential,raw);
  expect((await db.query<Record<string,unknown>>("SELECT local_date=(now() AT TIME ZONE 'Pacific/Kiritimati')::date AS matches FROM public.personnel_attendance_punches")).rows[0].matches).toBe(true);
 });
 it('closes a corrected forgotten IN without creating or rewriting an original IN',async()=>{
  const eid=await employee(),raw=await pin(eid),a=await activated(),sid=randomUUID();
  await db.query<Record<string,unknown>>("INSERT INTO public.personnel_schedules(id,organization_id,operational_unit_id,employee_id,local_date,expected_start_time,expected_end_time,timezone,expected_start_at,expected_end_at) VALUES($1,$2,$3,$4,(now() AT TIME ZONE 'Europe/Madrid')::date,'07:00','15:00','Europe/Madrid',now()-interval '8 hours',now()+interval '1 hour')",[sid,org,unit,eid]);
  const clock=(await db.query<Record<string,unknown>>("SELECT (now()-interval '2 hours')::text val")).rows[0].val;
  await admin('attendance.correct',{employeeId:eid,scheduleId:sid,clockIn:clock,clockOut:null,reason:'Synthetic forgotten entry'});
  const event=await punch(a.credential,raw);expect(event.kind).toBe('OUT');
  const rows=(await db.query<Record<string,unknown>>('SELECT kind,schedule_id FROM public.personnel_attendance_punches')).rows;
  expect(rows).toEqual([{kind:'OUT',schedule_id:sid}]);
 });
 it('does not reopen a superseded open correction after a later closing correction',async()=>{
  const eid=await employee(),raw=await pin(eid),a=await activated(),sid=randomUUID();
  await db.query<Record<string,unknown>>("INSERT INTO public.personnel_schedules(id,organization_id,operational_unit_id,employee_id,local_date,expected_start_time,expected_end_time,timezone,expected_start_at,expected_end_at) VALUES($1,$2,$3,$4,(now() AT TIME ZONE 'Europe/Madrid')::date,'07:00','15:00','Europe/Madrid',now()-interval '8 hours',now()+interval '1 hour')",[sid,org,unit,eid]);
  const times=(await db.query<Record<string,unknown>>("SELECT (now()-interval '2 hours')::text start,(now()-interval '1 hour')::text finish")).rows[0];
  await admin('attendance.correct',{employeeId:eid,scheduleId:sid,clockIn:times.start,clockOut:null,reason:'Synthetic initial correction'});
  await admin('attendance.correct',{employeeId:eid,scheduleId:sid,clockIn:times.start,clockOut:times.finish,reason:'Synthetic final correction'});
  expect((await punch(a.credential,raw)).kind).toBe('IN');
 });

 const push=async(credential:string,action:string,body:object={})=>(await run('service_role','','SELECT public.personnel_push_command($1,$2,$3) result',[tokenHash(credential),action,JSON.stringify(body)]))[0].result as Record<string,unknown>;
 const job=async(action:string,body:object={})=>(await run('service_role','','SELECT public.personnel_reminder_job($1,$2) result',[action,JSON.stringify(body)]))[0].result;
 async function subscribed(){
  const eid=await employee(),raw=await pin(eid),a=await activated();
  const prepared=await device('prepare',a.credential,{lookup:pinLookup(org,raw,pepper),requestId:randomUUID()});
  expect(await push(a.credential,'subscribe',{attemptId:prepared.attemptId,verified:true,subscription:{endpoint:'https://synthetic.invalid',keys:{}}})).toEqual({enabled:true});
  await db.query("INSERT INTO personnel_private.reminder_policies(organization_id,enabled) VALUES($1,true)",[org]);
  return {eid,raw,...a};
 }
 async function due(eid:string,kind:string){
  const sid=randomUUID(),start=kind==='ENTRY'?"now()+interval '2 minutes'":kind==='EXIT'?"now()-interval '8 hours'":"now()-interval '30 seconds'",end=kind==='EXIT'?"now()-interval '30 seconds'":"now()+interval '8 hours'";
  await db.query(`INSERT INTO public.personnel_schedules(id,organization_id,operational_unit_id,employee_id,local_date,expected_start_time,expected_end_time,timezone,expected_start_at,expected_end_at) VALUES($1,$2,$3,$4,current_date,'10:00','18:00','Europe/Madrid',${start},${end})`,[sid,org,unit,eid]);return sid;
 }
 it('requires PIN proof for push binding, consumes permits, isolates devices and honors revocation',async()=>{
  const a=await subscribed(),b=await activated();
  expect(await push(a.credential,'status')).toEqual({enabled:true});expect(await push(b.credential,'status')).toEqual({enabled:false});
  const prepared=await device('prepare',b.credential,{lookup:pinLookup(org,a.raw,pepper),requestId:randomUUID()});
  await pin(a.eid,'2839');
  expect(await push(b.credential,'subscribe',{attemptId:prepared.attemptId,verified:true,subscription:{}})).toEqual({error:'PIN_REJECTED'});
  await push(a.credential,'unsubscribe');expect(await push(a.credential,'status')).toEqual({enabled:false});
  await db.exec('UPDATE public.personnel_punch_devices SET revoked_at=now()');expect(await push(a.credential,'status')).toEqual({error:'INVALID_DEVICE'});
  await expect(run('authenticated',owner,"SELECT public.personnel_reminder_job('claim')")).rejects.toThrow(/permission denied/);
  await expect(run('authenticated',owner,'SELECT * FROM personnel_private.push_subscriptions')).rejects.toThrow(/permission denied/);
 });
 it.each(['ENTRY','START'])('claims %s once and rechecks IN before sending',async(kind)=>{
  const a=await subscribed();await due(a.eid,kind);
  const claims=await job('claim') as string[];expect(claims).toHaveLength(1);expect(await job('claim')).toEqual([]);
  expect(await job('prepare',{id:claims[0]})).toMatchObject({kind});
  await punch(a.credential,a.raw);
  expect(await job('prepare',{id:claims[0]})).toEqual({});
  await job('complete',{id:claims[0],status:'SKIPPED'});expect(await job('claim')).toEqual([]);
 });
 it('sends no exit reminder without an open session or after a corrected OUT',async()=>{
  const a=await subscribed(),sid=await due(a.eid,'EXIT');
  expect(await job('claim')).toEqual([]);
  const times=(await db.query<{start:string,end:string}>("SELECT (now()-interval '8 hours')::text start,(now()-interval '1 minute')::text end")).rows[0];
  await admin('attendance.correct',{employeeId:a.eid,scheduleId:sid,clockIn:times.start,reason:'Synthetic open session'});
  const claims=await job('claim') as string[];expect(claims).toHaveLength(1);
  await admin('attendance.correct',{employeeId:a.eid,scheduleId:sid,clockIn:times.start,clockOut:times.end,reason:'Synthetic closed session'});
  expect(await job('prepare',{id:claims[0]})).toEqual({});
 });
 it('disables expired provider credentials without returning secrets to the device',async()=>{
  const a=await subscribed();await due(a.eid,'ENTRY');const claims=await job('claim') as string[];
  await job('complete',{id:claims[0],status:'FAILED',httpStatus:410});expect(await push(a.credential,'status')).toEqual({enabled:false});expect(await job('claim')).toEqual([]);
 });

 it('clears the previous mobile reminder association atomically on reactivation',async()=>{
  const a=await subscribed(),activation=randomUUID(),credential=randomUUID();
  await admin('device.activate',{tokenHash:tokenHash(activation),label:'Reactivated mobile'});
  const rows=await run('service_role','','SELECT public.personnel_activate_device($1,$2,$3,$4) result',[tokenHash(activation),tokenHash(credential),tokenHash(a.credential),'synthetic-ip']);
  expect(rows[0].result).toEqual({ok:true});
  expect(await push(a.credential,'status')).toEqual({enabled:false});
  expect(await push(credential,'status')).toEqual({enabled:false});
 });
});
