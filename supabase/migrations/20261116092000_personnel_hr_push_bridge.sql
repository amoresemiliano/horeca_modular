BEGIN;
ALTER TABLE personnel_private.hr_push_events DROP CONSTRAINT hr_push_events_status_check;
ALTER TABLE personnel_private.hr_push_events ADD CHECK(status IN ('PENDING','CLAIMED','SENT','FAILED','NOT_SUBSCRIBED'));
CREATE TABLE personnel_private.hr_push_deliveries (
 event_id uuid NOT NULL REFERENCES personnel_private.hr_push_events(id), subscription_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'CLAIMED' CHECK(status IN ('CLAIMED','SENT','FAILED')), http_status integer, completed_at timestamptz,
 PRIMARY KEY(event_id,subscription_id)
);
ALTER TABLE personnel_private.hr_push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON personnel_private.hr_push_deliveries FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.personnel_hr_push(p_action text,p_body jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ev personnel_private.hr_push_events; result jsonb; sub uuid;
BEGIN
 IF p_action='claim' THEN
  SELECT * INTO ev FROM personnel_private.hr_push_events WHERE leave_id=(p_body->>'leaveId')::uuid AND status='PENDING' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN '[]'; END IF;
  IF to_regclass('personnel_private.push_subscriptions') IS NULL THEN
   UPDATE personnel_private.hr_push_events SET status='NOT_SUBSCRIBED',completed_at=now() WHERE id=ev.id;RETURN '[]';
  END IF;
  EXECUTE $q$ WITH valid AS (
   SELECT p.id,p.subscription FROM personnel_private.push_subscriptions p
   JOIN public.personnel_punch_devices d ON d.id=p.device_id AND d.organization_id=p.organization_id AND d.operational_unit_id=p.operational_unit_id AND d.revoked_at IS NULL AND d.expires_at>now()
   JOIN public.personnel_employees e ON e.id=p.employee_id AND e.organization_id=p.organization_id AND e.employment_status='ACTIVE'
   WHERE p.organization_id=$1 AND p.operational_unit_id=$2 AND p.employee_id=$3 AND p.enabled
   AND personnel_private.hr_employee($1,$2,$3)
   AND EXISTS(SELECT 1 FROM public.eco_organization_module_entitlements WHERE organization_id=$1 AND module_key='personal' AND is_enabled)
  ), claimed AS (INSERT INTO personnel_private.hr_push_deliveries(event_id,subscription_id) SELECT $4,id FROM valid ON CONFLICT DO NOTHING RETURNING subscription_id)
  SELECT coalesce(jsonb_agg(jsonb_build_object('eventId',$4,'subscriptionId',v.id,'subscription',v.subscription)),'[]') FROM valid v JOIN claimed c ON c.subscription_id=v.id $q$
  INTO result USING ev.organization_id,ev.operational_unit_id,ev.employee_id,ev.id;
  UPDATE personnel_private.hr_push_events SET status=CASE WHEN jsonb_array_length(result)=0 THEN 'NOT_SUBSCRIBED' ELSE 'CLAIMED' END,completed_at=CASE WHEN jsonb_array_length(result)=0 THEN now() END WHERE id=ev.id;
  RETURN result;
 ELSIF p_action='complete' THEN
  sub:=(p_body->>'subscriptionId')::uuid;
  UPDATE personnel_private.hr_push_deliveries SET status=CASE WHEN (p_body->>'httpStatus')::int BETWEEN 200 AND 299 THEN 'SENT' ELSE 'FAILED' END,http_status=(p_body->>'httpStatus')::int,completed_at=now() WHERE event_id=(p_body->>'eventId')::uuid AND subscription_id=sub AND status='CLAIMED';
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  IF (p_body->>'httpStatus')::int IN (404,410) AND to_regclass('personnel_private.push_subscriptions') IS NOT NULL THEN
   EXECUTE 'UPDATE personnel_private.push_subscriptions SET enabled=false,subscription=''{}'',updated_at=now() WHERE id=$1' USING sub;
  END IF;
  UPDATE personnel_private.hr_push_events e SET status=CASE WHEN EXISTS(SELECT 1 FROM personnel_private.hr_push_deliveries WHERE event_id=e.id AND status='FAILED') THEN 'FAILED' ELSE 'SENT' END,completed_at=now()
  WHERE id=(p_body->>'eventId')::uuid AND NOT EXISTS(SELECT 1 FROM personnel_private.hr_push_deliveries WHERE event_id=e.id AND status='CLAIMED');
  RETURN '{"ok":true}';
 END IF;
 RAISE EXCEPTION 'INVALID_INPUT';
END $$;
REVOKE ALL ON FUNCTION public.personnel_hr_push(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.personnel_hr_push(text,jsonb) TO service_role;
-- Narrow integration with existing reminders. Underlying reminder eligibility is preserved.
DO $install$ BEGIN
 IF to_regprocedure('personnel_private.reminder_applicable(uuid,uuid,text)') IS NOT NULL THEN
  ALTER FUNCTION personnel_private.reminder_applicable(uuid,uuid,text) RENAME TO reminder_applicable_before_hr;
  EXECUTE $ddl$ CREATE FUNCTION personnel_private.reminder_applicable(sub uuid,shift uuid,k text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
   SELECT personnel_private.reminder_applicable_before_hr(sub,shift,k)
   AND NOT EXISTS(SELECT 1 FROM personnel_private.hr_leave l JOIN public.personnel_schedules s
    ON s.employee_id=l.employee_id AND s.organization_id=l.organization_id AND s.operational_unit_id=l.operational_unit_id
    WHERE s.id=shift AND l.status='APPROVED' AND s.local_date BETWEEN l.start_date AND l.end_date)
  $body$ $ddl$;
  REVOKE ALL ON FUNCTION personnel_private.reminder_applicable(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
 END IF;
END $install$;
COMMIT;
