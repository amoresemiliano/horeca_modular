-- Run only after migration review, DEV deployment and secrets provisioning.
-- Prerequisites: pg_cron, pg_net and Supabase Vault. No production cron needed.
-- Provision Vault secrets through the deployment secret channel, never source:
-- personnel_dev_origin = the HTTPS DEV origin (without trailing slash)
-- personnel_dev_cron_authorization = 'Bearer ' + PERSONNEL_CRON_SECRET
BEGIN;
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron')
 OR NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_net')
 OR NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='personnel_dev_origin' AND decrypted_secret LIKE 'https://%')
 OR NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='personnel_dev_cron_authorization' AND length(decrypted_secret)>40)
 THEN RAISE EXCEPTION 'PERSONNEL_SCHEDULER_PREREQUISITES_MISSING'; END IF;
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
