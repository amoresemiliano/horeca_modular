-- Production-only operational provisioning. Secrets already reside in Vault.
-- Execute within a transaction after setting horeca.push_project_ref locally.
DO $$ BEGIN
 IF current_setting('horeca.push_project_ref',true) IS DISTINCT FROM 'cznauyzhtbqvqtwmfeki' THEN RAISE EXCEPTION 'EXPLICIT_PRODUCTION_TARGET_REQUIRED'; END IF;
 IF to_regprocedure('public.personnel_reminder_job(text,jsonb)') IS NULL THEN RAISE EXCEPTION 'PUSH_MIGRATIONS_REQUIRED'; END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
REVOKE ALL ON SCHEMA cron FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA cron FROM PUBLIC,anon,authenticated;
-- Hosted pg_net grants belong to supabase_admin and postgres cannot revoke them.
-- As in the established DEV scheduler: orchestration must verify net is NOT a
-- Data API schema. App roles must have no direct DB login or usable Vault access.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='personnel_production_origin' AND decrypted_secret='https://horecamodular.vercel.app')
 OR NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='personnel_production_cron_authorization' AND length(decrypted_secret)>40)
 THEN RAISE EXCEPTION 'PRODUCTION_SCHEDULER_SECRETS_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN('anon','authenticated') AND rolcanlogin)
 OR (has_schema_privilege('authenticated','vault','USAGE') AND has_table_privilege('authenticated','vault.decrypted_secrets','SELECT'))
 OR (has_schema_privilege('anon','vault','USAGE') AND has_table_privilege('anon','vault.decrypted_secrets','SELECT')) THEN RAISE EXCEPTION 'SCHEDULER_SECRET_EXPOSURE';END IF;
END $$;
SELECT cron.schedule('personnel-production-attendance-reminders','* * * * *',$job$
 SELECT net.http_get(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='personnel_production_origin') || '/api/personnel-reminders',
  headers := jsonb_build_object('Authorization',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='personnel_production_cron_authorization')),
  timeout_milliseconds := 55000
 );
$job$);
-- Release orchestration enables this job only after production deployment checks.
SELECT cron.alter_job(job_id:=jobid,active:=false) FROM cron.job WHERE jobname='personnel-production-attendance-reminders';
