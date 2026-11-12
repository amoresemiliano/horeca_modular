-- WP-PERS-002. Additive, no tenant enablement or employee seeds.
BEGIN;
CREATE TABLE personnel_private.push_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, operational_unit_id uuid NOT NULL,
 employee_id uuid NOT NULL, device_id uuid NOT NULL UNIQUE, subscription jsonb NOT NULL,
 enabled boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(employee_id,organization_id) REFERENCES public.personnel_employees(id,organization_id),
 FOREIGN KEY(device_id,organization_id,operational_unit_id) REFERENCES public.personnel_punch_devices(id,organization_id,operational_unit_id)
);
CREATE TABLE personnel_private.notification_preferences (
 subscription_id uuid PRIMARY KEY REFERENCES personnel_private.push_subscriptions(id),
 entry_reminder boolean NOT NULL DEFAULT true, start_check boolean NOT NULL DEFAULT true, exit_reminder boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX personnel_push_endpoint ON personnel_private.push_subscriptions((subscription->>'endpoint')) WHERE enabled;
CREATE FUNCTION public.personnel_activate_device(p_activation_hash text,p_device_hash text,p_previous_hash text,p_ip_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 result:=public.personnel_device_command('activate',p_activation_hash,p_ip_key,jsonb_build_object('deviceHash',p_device_hash));
 IF NOT (result ? 'error') THEN
  UPDATE personnel_private.push_subscriptions SET enabled=false,subscription='{}',updated_at=now()
  WHERE device_id IN(SELECT device_id FROM personnel_private.device_credentials WHERE token_hash=p_previous_hash);
 END IF;
 RETURN result;
END $$;
CREATE TABLE personnel_private.reminder_policies (
 organization_id uuid PRIMARY KEY REFERENCES public.eco_organizations(id), enabled boolean NOT NULL DEFAULT false,
 entry_minutes integer NOT NULL DEFAULT 3 CHECK(entry_minutes=3)
);
CREATE TABLE personnel_private.reminder_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subscription_id uuid NOT NULL REFERENCES personnel_private.push_subscriptions(id),
 schedule_id uuid NOT NULL REFERENCES public.personnel_schedules(id), schedule_revision integer NOT NULL,
 kind text NOT NULL CHECK(kind IN ('ENTRY','START','EXIT')), status text NOT NULL DEFAULT 'CLAIMED' CHECK(status IN ('CLAIMED','SENT','FAILED','SKIPPED')),
 claimed_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, http_status integer,
 UNIQUE(subscription_id,schedule_id,schedule_revision,kind)
);
CREATE FUNCTION public.personnel_push_command(p_token_hash text,p_action text,p_body jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d public.personnel_punch_devices; a personnel_private.attempts; credential uuid; sid uuid;
BEGIN
 SELECT x.* INTO d FROM public.personnel_punch_devices x JOIN personnel_private.device_credentials c ON c.device_id=x.id
 WHERE c.token_hash=p_token_hash AND x.revoked_at IS NULL AND x.expires_at>now() FOR UPDATE OF x;
 IF NOT FOUND OR personnel_private.unit_zone(d.organization_id,d.operational_unit_id) IS NULL
 OR NOT EXISTS(SELECT 1 FROM public.eco_organization_module_entitlements WHERE organization_id=d.organization_id AND module_key='personal' AND is_enabled)
 THEN RETURN jsonb_build_object('error','INVALID_DEVICE'); END IF;
 IF p_action='status' THEN RETURN jsonb_build_object('enabled',EXISTS(SELECT 1 FROM personnel_private.push_subscriptions WHERE device_id=d.id AND enabled)); END IF;
 IF p_action='unsubscribe' THEN
  UPDATE personnel_private.push_subscriptions SET enabled=false,subscription='{}',updated_at=now() WHERE device_id=d.id;
  RETURN jsonb_build_object('enabled',false);
 END IF;
 IF p_action<>'subscribe' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 SELECT * INTO a FROM personnel_private.attempts WHERE id=(p_body->>'attemptId')::uuid AND device_id=d.id AND consumed_at IS NULL AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','PIN_REJECTED'); END IF;
 UPDATE personnel_private.attempts SET consumed_at=now() WHERE id=a.id;
 SELECT c.revision INTO credential FROM personnel_private.pin_credentials c JOIN public.personnel_employees e ON e.id=c.employee_id
 WHERE c.employee_id=a.employee_id AND c.organization_id=d.organization_id AND e.employment_status='ACTIVE' FOR UPDATE OF c,e;
 IF NOT coalesce((p_body->>'verified')::boolean,false) OR credential IS DISTINCT FROM a.credential_revision OR credential IS NULL
 OR NOT EXISTS(SELECT 1 FROM public.personnel_unit_assignments WHERE employee_id=a.employee_id AND operational_unit_id=d.operational_unit_id AND valid_to IS NULL AND valid_from<=(now() AT TIME ZONE personnel_private.unit_zone(d.organization_id,d.operational_unit_id))::date)
 THEN RETURN jsonb_build_object('error','PIN_REJECTED'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('personnel-push:' || (p_body->'subscription'->>'endpoint'),0));
 UPDATE personnel_private.push_subscriptions SET enabled=false,subscription='{}',updated_at=now()
 WHERE device_id<>d.id AND subscription->>'endpoint'=p_body->'subscription'->>'endpoint';
 INSERT INTO personnel_private.push_subscriptions(organization_id,operational_unit_id,employee_id,device_id,subscription)
 VALUES(d.organization_id,d.operational_unit_id,a.employee_id,d.id,p_body->'subscription')
 ON CONFLICT(device_id) DO UPDATE SET employee_id=excluded.employee_id,subscription=excluded.subscription,enabled=true,updated_at=now() RETURNING id INTO sid;
 INSERT INTO personnel_private.notification_preferences(subscription_id) VALUES(sid) ON CONFLICT DO NOTHING;
 INSERT INTO personnel_private.audit(organization_id,device_id,event) VALUES(d.organization_id,d.id,'push.subscribe');
 RETURN jsonb_build_object('enabled',true);
END $$;

-- Recheck current facts for each claim and immediately before provider send.
CREATE FUNCTION personnel_private.reminder_applicable(sub uuid,shift uuid,k text) RETURNS boolean
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
 AND CASE WHEN k IN ('ENTRY','START') THEN
  (CASE WHEN k='ENTRY' THEN pref.entry_reminder AND now()>=s.expected_start_at-policy.entry_minutes*interval '1 minute' AND now()<s.expected_start_at
   ELSE pref.start_check AND now()>=s.expected_start_at AND now()<s.expected_start_at+interval '2 minutes' END)
  AND c.clock_in IS NULL AND NOT EXISTS(SELECT 1 FROM public.personnel_attendance_punches WHERE schedule_id=s.id AND employee_id=s.employee_id AND kind='IN')
 WHEN k='EXIT' THEN pref.exit_reminder AND now()>=s.expected_end_at AND now()<s.expected_end_at+interval '2 minutes'
  AND c.clock_out IS NULL
  AND (c.clock_in IS NOT NULL OR EXISTS(SELECT 1 FROM public.personnel_attendance_punches WHERE schedule_id=s.id AND employee_id=s.employee_id AND kind='IN'))
  AND NOT EXISTS(SELECT 1 FROM public.personnel_attendance_punches WHERE schedule_id=s.id AND employee_id=s.employee_id AND kind='OUT' AND (c.created_at IS NULL OR occurred_at>c.created_at))
 ELSE false END)
$$;
CREATE FUNCTION public.personnel_reminder_job(p_action text,p_body jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 IF p_action='claim' THEN
  WITH candidates AS (
   SELECT p.id subscription_id,s.id schedule_id,s.revision,k.kind
   FROM personnel_private.push_subscriptions p JOIN public.personnel_schedules s ON s.employee_id=p.employee_id AND s.organization_id=p.organization_id AND s.operational_unit_id=p.operational_unit_id
   CROSS JOIN (VALUES('ENTRY'),('START'),('EXIT')) k(kind)
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
ALTER TABLE personnel_private.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_private.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_private.reminder_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_private.reminder_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON personnel_private.push_subscriptions,personnel_private.notification_preferences,personnel_private.reminder_policies,personnel_private.reminder_deliveries FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.personnel_push_command(text,text,jsonb),public.personnel_reminder_job(text,jsonb),personnel_private.reminder_applicable(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.personnel_push_command(text,text,jsonb),public.personnel_reminder_job(text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.personnel_activate_device(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.personnel_activate_device(text,text,text,text) TO service_role;
COMMIT;
