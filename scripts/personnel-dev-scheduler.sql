-- Run only after migration review, DEV deployment and secrets provisioning.
-- Prerequisites: pg_cron, pg_net and Supabase Vault. No production cron needed.
-- Provision Vault secrets through the deployment secret channel, never source:
-- personnel_dev_origin = the HTTPS DEV origin (without trailing slash)
-- personnel_dev_cron_authorization = 'Bearer ' + PERSONNEL_CRON_SECRET
BEGIN;
-- Additive DEV/UAT scheduler prerequisites. Neither extension existed at review.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
REVOKE ALL ON SCHEMA cron,net FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA cron,net FROM PUBLIC,anon,authenticated;
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron')
 OR NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_net')
 OR NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='personnel_dev_origin' AND decrypted_secret LIKE 'https://%')
 OR NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='personnel_dev_cron_authorization' AND length(decrypted_secret)>40)
 THEN RAISE EXCEPTION 'PERSONNEL_SCHEDULER_PREREQUISITES_MISSING'; END IF;
 IF has_table_privilege('anon','net.http_request_queue','SELECT')
 OR has_table_privilege('authenticated','net.http_request_queue','SELECT')
 OR has_table_privilege('authenticated','vault.decrypted_secrets','SELECT')
 THEN RAISE EXCEPTION 'PERSONNEL_SCHEDULER_CREDENTIAL_EXPOSURE'; END IF;
END $$;
SELECT cron.schedule('personnel-dev-attendance-reminders','* * * * *',$job$
 SELECT net.http_get(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='personnel_dev_origin') || '/api/personnel-reminders',
  headers := jsonb_build_object('Authorization',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='personnel_dev_cron_authorization')),
  timeout_milliseconds := 55000
 );
$job$);
COMMIT;
-- Operational rollback: SELECT cron.unschedule('personnel-dev-attendance-reminders');
-- Retain Personnel records; disable the DEV backend/policy if needed. No DROP.
