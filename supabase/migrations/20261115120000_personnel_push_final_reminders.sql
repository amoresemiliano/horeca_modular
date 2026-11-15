-- Production push follow-up: reuses WP-PERS-002 foundation; no attendance/PIN/role changes.
-- PO final policy (2026-11-15): entry T-3 / T / T+15; exit T / T+15; never +30.
BEGIN;
ALTER TABLE personnel_private.reminder_deliveries DROP CONSTRAINT IF EXISTS reminder_deliveries_kind_check;
ALTER TABLE personnel_private.reminder_deliveries ADD CONSTRAINT reminder_deliveries_kind_check CHECK(kind IN ('ENTRY','START','ENTRY_15','EXIT','EXIT_15'));
CREATE OR REPLACE FUNCTION personnel_private.reminder_applicable(sub uuid,shift uuid,k text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(
 SELECT 1 FROM personnel_private.push_subscriptions p
 JOIN personnel_private.notification_preferences pref ON pref.subscription_id=p.id
 JOIN personnel_private.reminder_policies policy ON policy.organization_id=p.organization_id AND policy.enabled
 JOIN public.personnel_schedules s ON s.id=shift AND s.organization_id=p.organization_id AND s.operational_unit_id=p.operational_unit_id AND s.employee_id=p.employee_id
 JOIN public.personnel_employees e ON e.id=p.employee_id AND e.employment_status='ACTIVE'
 JOIN public.personnel_punch_devices d ON d.id=p.device_id AND d.revoked_at IS NULL AND d.expires_at>now()
 LEFT JOIN LATERAL (SELECT clock_in,clock_out,created_at FROM public.personnel_attendance_corrections WHERE schedule_id=s.id AND employee_id=s.employee_id ORDER BY sequence DESC LIMIT 1) c ON true
 WHERE p.id=sub AND p.enabled AND NOT s.cancelled
 AND personnel_private.unit_zone(p.organization_id,p.operational_unit_id) IS NOT NULL
 AND EXISTS(SELECT 1 FROM public.eco_organization_module_entitlements WHERE organization_id=p.organization_id AND module_key='personal' AND is_enabled)
 AND EXISTS(SELECT 1 FROM public.personnel_unit_assignments WHERE employee_id=p.employee_id AND operational_unit_id=p.operational_unit_id AND valid_to IS NULL)
 AND CASE WHEN k IN ('ENTRY','START','ENTRY_15') THEN
  (CASE WHEN k='ENTRY' THEN pref.entry_reminder AND now()>=s.expected_start_at-policy.entry_minutes*interval '1 minute' AND now()<s.expected_start_at
   WHEN k='START' THEN pref.start_check AND now()>=s.expected_start_at AND now()<s.expected_start_at+interval '2 minutes'
   ELSE pref.start_check AND now()>=s.expected_start_at+interval '15 minutes' AND now()<s.expected_start_at+interval '17 minutes' END)
  AND c.clock_in IS NULL AND NOT EXISTS(SELECT 1 FROM public.personnel_attendance_punches WHERE schedule_id=s.id AND employee_id=s.employee_id AND kind='IN')
 WHEN k IN ('EXIT','EXIT_15') THEN pref.exit_reminder
  AND now()>=s.expected_end_at+CASE WHEN k='EXIT_15' THEN interval '15 minutes' ELSE interval '0 minutes' END
  AND now()<s.expected_end_at+CASE WHEN k='EXIT_15' THEN interval '17 minutes' ELSE interval '2 minutes' END
  AND c.clock_out IS NULL
  AND (c.clock_in IS NOT NULL OR EXISTS(SELECT 1 FROM public.personnel_attendance_punches WHERE schedule_id=s.id AND employee_id=s.employee_id AND kind='IN'))
  AND NOT EXISTS(SELECT 1 FROM public.personnel_attendance_punches WHERE schedule_id=s.id AND employee_id=s.employee_id AND kind='OUT' AND (c.created_at IS NULL OR occurred_at>c.created_at))
 ELSE false END)
$$;

-- Supports both installation orders: push before recurrence, or push after recurrence.
DO $install$ BEGIN
 IF to_regprocedure('personnel_private.personnel_reminder_job_foundation(text,jsonb)') IS NULL THEN
  ALTER FUNCTION public.personnel_reminder_job(text,jsonb) RENAME TO personnel_reminder_job_foundation;
  ALTER FUNCTION public.personnel_reminder_job_foundation(text,jsonb) SET SCHEMA personnel_private;
 END IF;
END $install$;
CREATE OR REPLACE FUNCTION personnel_private.personnel_reminder_job_foundation(p_action text,p_body jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 IF p_action='claim' THEN
  WITH candidates AS (
   SELECT p.id subscription_id,s.id schedule_id,s.revision,k.kind
   FROM personnel_private.push_subscriptions p JOIN public.personnel_schedules s ON s.employee_id=p.employee_id AND s.organization_id=p.organization_id AND s.operational_unit_id=p.operational_unit_id
   CROSS JOIN (VALUES('ENTRY'),('START'),('ENTRY_15'),('EXIT'),('EXIT_15')) k(kind)
   WHERE s.expected_start_at BETWEEN now()-interval '17 hours' AND now()+interval '3 minutes'
   AND personnel_private.reminder_applicable(p.id,s.id,k.kind)
   AND NOT EXISTS(SELECT 1 FROM personnel_private.reminder_deliveries x WHERE x.subscription_id=p.id AND x.schedule_id=s.id AND x.schedule_revision=s.revision AND x.kind=k.kind)
   ORDER BY s.expected_start_at,p.id,k.kind LIMIT 20
  ), claimed AS (
   INSERT INTO personnel_private.reminder_deliveries(subscription_id,schedule_id,schedule_revision,kind)
   SELECT * FROM candidates ON CONFLICT DO NOTHING RETURNING id
  ) SELECT coalesce(jsonb_agg(id),'[]') INTO result FROM claimed;
  RETURN result;
 ELSIF p_action='prepare' THEN
  SELECT jsonb_build_object('subscription',p.subscription,'kind',x.kind,'start',to_char(s.expected_start_at AT TIME ZONE s.timezone,'HH24:MI')) INTO result
  FROM personnel_private.reminder_deliveries x JOIN personnel_private.push_subscriptions p ON p.id=x.subscription_id JOIN public.personnel_schedules s ON s.id=x.schedule_id
  WHERE x.id=(p_body->>'id')::uuid AND x.status='CLAIMED' AND x.claimed_at>now()-interval '1 minute' AND x.schedule_revision=s.revision
  AND personnel_private.reminder_applicable(p.id,s.id,x.kind);
  RETURN coalesce(result,'{}');
 ELSIF p_action='complete' THEN
  UPDATE personnel_private.reminder_deliveries SET status=p_body->>'status',http_status=(p_body->>'httpStatus')::integer,completed_at=now() WHERE id=(p_body->>'id')::uuid AND status='CLAIMED';
  IF (p_body->>'httpStatus')::integer IN (404,410) THEN
   UPDATE personnel_private.push_subscriptions SET enabled=false,subscription='{}' WHERE id=(SELECT subscription_id FROM personnel_private.reminder_deliveries WHERE id=(p_body->>'id')::uuid);
  END IF;
  RETURN jsonb_build_object('ok',true);
 END IF;
 RAISE EXCEPTION 'INVALID_INPUT';
END $$;

CREATE OR REPLACE FUNCTION public.personnel_reminder_job(p_action text,p_body jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE binding record; day date;
BEGIN
 IF p_action='claim' THEN
  -- Use the approved date resolver only for opted-in employees, never all tenants.
  FOR binding IN SELECT DISTINCT p.organization_id,p.operational_unit_id,p.employee_id
   FROM personnel_private.push_subscriptions p
   JOIN personnel_private.reminder_policies policy ON policy.organization_id=p.organization_id AND policy.enabled
   JOIN public.personnel_punch_devices d ON d.id=p.device_id AND d.revoked_at IS NULL AND d.expires_at>now()
   WHERE p.enabled
  LOOP
   day:=(now() AT TIME ZONE personnel_private.unit_zone(binding.organization_id,binding.operational_unit_id))::date;
   IF day IS NOT NULL THEN
    PERFORM personnel_private.resolve_schedules(binding.organization_id,binding.operational_unit_id,day-1,day+1,binding.employee_id);
   END IF;
  END LOOP;
 END IF;
 RETURN personnel_private.personnel_reminder_job_foundation(p_action,p_body);
END $$;
REVOKE ALL ON FUNCTION personnel_private.personnel_reminder_job_foundation(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION personnel_private.reminder_applicable(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.personnel_reminder_job(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.personnel_reminder_job(text,jsonb) TO service_role;
COMMIT;
