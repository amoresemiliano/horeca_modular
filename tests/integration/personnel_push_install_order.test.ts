import {describe,it,expect} from 'vitest';import {PGlite} from '@electric-sql/pglite';import {readFileSync} from 'node:fs';
describe('Push provisioning after the existing production recurrence installation',()=>{
 it('installs the canonical push package late, reuses one resolver hook, and safely reapplies the follow-up',async()=>{
  const db=new PGlite();try{
   await db.exec("CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;");
   const files=['20260926000000_horeca_core_baseline.sql','20260927000000_ccr_fin_001_core_authorization.sql','20261002030000_core_module_entitlement_registry.sql','20261110090000_personnel_attendance_foundation.sql','20261114090000_personnel_recurring_schedules.sql','20261111100000_personnel_push_reminders.sql','20261115120000_personnel_push_final_reminders.sql'];
   for(const file of files)await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
   await db.exec(readFileSync('supabase/migrations/20261115120000_personnel_push_final_reminders.sql','utf8'));
   expect((await db.query<{result:unknown}>("SELECT public.personnel_reminder_job('claim') result")).rows[0].result).toEqual([]);
   const result=(await db.query<{body:string}>("SELECT prosrc body FROM pg_proc WHERE oid='public.personnel_reminder_job(text,jsonb)'::regprocedure")).rows[0];expect(result.body).toContain('resolve_schedules');expect(result.body).toContain('personnel_reminder_job_foundation');
   expect((await db.query("SELECT 1 FROM pg_proc WHERE oid='personnel_private.personnel_reminder_job_foundation(text,jsonb)'::regprocedure")).rows).toHaveLength(1);
   expect((await db.query<{allowed:boolean}>("SELECT has_function_privilege('authenticated','public.personnel_reminder_job(text,jsonb)','EXECUTE') allowed")).rows[0].allowed).toBe(false);
  }finally{await db.close();}
 },60000);
});
