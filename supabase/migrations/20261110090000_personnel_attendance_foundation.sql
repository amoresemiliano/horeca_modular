-- WP-PERS-001. REVIEW ONLY: Master applies after domain review. No tenant seeds.
BEGIN;
CREATE SCHEMA personnel_private;
REVOKE ALL ON SCHEMA personnel_private FROM PUBLIC, anon, authenticated;

CREATE TABLE public.personnel_employees (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.eco_organizations(id),
 first_name text NOT NULL CHECK(length(btrim(first_name)) BETWEEN 1 AND 100), last_name text NOT NULL CHECK(length(btrim(last_name)) BETWEEN 1 AND 100),
 preferred_name text CHECK(length(preferred_name)<=100), phone text CHECK(length(phone)<=60), email text CHECK(length(email)<=254),
 employment_status text NOT NULL DEFAULT 'ACTIVE' CHECK(employment_status IN('ACTIVE','INACTIVE','ON_LEAVE')),
 revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,organization_id)
);
CREATE TABLE public.personnel_employment_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, employee_id uuid NOT NULL,
 position text NOT NULL CHECK(length(btrim(position)) BETWEEN 1 AND 100), start_date date NOT NULL, end_date date,
 contract_type text CHECK(length(contract_type)<=100), weekly_hours numeric CHECK(weekly_hours BETWEEN 0 AND 168), hourly_cost numeric CHECK(hourly_cost>=0),
 FOREIGN KEY(employee_id,organization_id) REFERENCES public.personnel_employees(id,organization_id), CHECK(end_date IS NULL OR end_date>=start_date)
);
CREATE UNIQUE INDEX personnel_current_employment ON public.personnel_employment_assignments(employee_id) WHERE end_date IS NULL;
CREATE TABLE public.personnel_unit_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, employee_id uuid NOT NULL, operational_unit_id uuid NOT NULL,
 valid_from date NOT NULL, valid_to date,
 FOREIGN KEY(employee_id,organization_id) REFERENCES public.personnel_employees(id,organization_id),
 FOREIGN KEY(operational_unit_id,organization_id) REFERENCES public.eco_operational_units(id,organization_id), CHECK(valid_to IS NULL OR valid_to>=valid_from)
);
CREATE UNIQUE INDEX personnel_active_assignment ON public.personnel_unit_assignments(employee_id,operational_unit_id) WHERE valid_to IS NULL;
CREATE TABLE public.personnel_schedules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, operational_unit_id uuid NOT NULL, employee_id uuid NOT NULL,
 local_date date NOT NULL, expected_start_time time NOT NULL, expected_end_time time NOT NULL, timezone text NOT NULL,
 expected_start_at timestamptz NOT NULL, expected_end_at timestamptz NOT NULL, note text CHECK(length(note)<=500),
 revision integer NOT NULL DEFAULT 1, cancelled boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(employee_id,organization_id) REFERENCES public.personnel_employees(id,organization_id),
 FOREIGN KEY(operational_unit_id,organization_id) REFERENCES public.eco_operational_units(id,organization_id),
 CHECK(expected_end_at>expected_start_at AND expected_end_at<=expected_start_at+interval '16 hours'), UNIQUE(id,organization_id)
);
CREATE INDEX personnel_schedule_lookup ON public.personnel_schedules(organization_id,operational_unit_id,local_date);
CREATE TABLE public.personnel_punch_devices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, operational_unit_id uuid NOT NULL,
 label text NOT NULL CHECK(length(btrim(label)) BETWEEN 1 AND 100), created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '90 days', revoked_at timestamptz,
 FOREIGN KEY(operational_unit_id,organization_id) REFERENCES public.eco_operational_units(id,organization_id), UNIQUE(id,organization_id,operational_unit_id)
);
CREATE TABLE public.personnel_attendance_punches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, operational_unit_id uuid NOT NULL, employee_id uuid NOT NULL,
 device_id uuid NOT NULL, kind text NOT NULL CHECK(kind IN('IN','OUT')), occurred_at timestamptz NOT NULL, local_date date NOT NULL,
 timezone text NOT NULL, schedule_id uuid, session_id uuid NOT NULL, request_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(employee_id,organization_id) REFERENCES public.personnel_employees(id,organization_id),
 FOREIGN KEY(device_id,organization_id,operational_unit_id) REFERENCES public.personnel_punch_devices(id,organization_id,operational_unit_id),
 FOREIGN KEY(schedule_id,organization_id) REFERENCES public.personnel_schedules(id,organization_id), UNIQUE(device_id,request_id), UNIQUE(id,organization_id)
);
CREATE INDEX personnel_punch_employee_time ON public.personnel_attendance_punches(employee_id,occurred_at DESC);
CREATE TABLE public.personnel_punch_observations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, punch_id uuid NOT NULL, observation text NOT NULL CHECK(length(btrim(observation)) BETWEEN 1 AND 500),
 created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(punch_id,organization_id) REFERENCES public.personnel_attendance_punches(id,organization_id), UNIQUE(punch_id)
);
CREATE TABLE public.personnel_attendance_corrections (
 sequence bigint GENERATED ALWAYS AS IDENTITY,
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, employee_id uuid NOT NULL, schedule_id uuid NOT NULL,
 clock_in timestamptz NOT NULL, clock_out timestamptz, reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 500),
 actor uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(employee_id,organization_id) REFERENCES public.personnel_employees(id,organization_id), FOREIGN KEY(schedule_id,organization_id) REFERENCES public.personnel_schedules(id,organization_id),
 CHECK(clock_out IS NULL OR clock_out>clock_in)
);
CREATE TABLE personnel_private.pin_credentials (
 employee_id uuid PRIMARY KEY, organization_id uuid NOT NULL, lookup_hash text NOT NULL CHECK(length(lookup_hash)=64),
 password_hash text NOT NULL CHECK(password_hash ~ '^scrypt:32768:8:1:[a-f0-9]{32}:[a-f0-9]{64}$'), revision uuid NOT NULL DEFAULT gen_random_uuid(),
 updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,lookup_hash), FOREIGN KEY(employee_id,organization_id) REFERENCES public.personnel_employees(id,organization_id)
);
CREATE TABLE personnel_private.device_credentials (device_id uuid PRIMARY KEY REFERENCES public.personnel_punch_devices(id), token_hash text UNIQUE NOT NULL CHECK(length(token_hash)=64));
CREATE TABLE personnel_private.activations (
 token_hash text PRIMARY KEY CHECK(length(token_hash)=64), organization_id uuid NOT NULL, operational_unit_id uuid NOT NULL, label text NOT NULL,
 created_by uuid NOT NULL, expires_at timestamptz NOT NULL, consumed_at timestamptz,
 FOREIGN KEY(operational_unit_id,organization_id) REFERENCES public.eco_operational_units(id,organization_id)
);
CREATE TABLE personnel_private.rate_windows (key text PRIMARY KEY, started_at timestamptz NOT NULL, count integer NOT NULL);
CREATE TABLE personnel_private.attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), device_id uuid NOT NULL REFERENCES public.personnel_punch_devices(id), employee_id uuid,
 credential_revision uuid, request_id uuid NOT NULL, expires_at timestamptz NOT NULL, consumed_at timestamptz
);
CREATE TABLE personnel_private.audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, device_id uuid, event text NOT NULL, actor uuid, at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE personnel_private.schedule_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), schedule_id uuid NOT NULL, organization_id uuid NOT NULL, before_image jsonb NOT NULL, actor uuid NOT NULL, at timestamptz NOT NULL DEFAULT now());

CREATE FUNCTION public.personnel_admin_allowed(org uuid, unit uuid DEFAULT NULL) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT auth.uid() IS NOT NULL AND public.can_execute_capability_for_org(org,'personnel.employees.manage')
 AND EXISTS(SELECT 1 FROM public.eco_organization_module_entitlements WHERE organization_id=org AND module_key='personal' AND is_enabled)
 AND (unit IS NULL OR public.core_can_read_unit(org,unit))
$$;
REVOKE ALL ON FUNCTION public.personnel_admin_allowed(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.personnel_admin_allowed(uuid,uuid) TO authenticated;

CREATE FUNCTION personnel_private.unit_zone(org uuid, unit uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce(nullif(to_jsonb(u)->>'timezone',''),o.timezone) FROM public.eco_operational_units u JOIN public.eco_organizations o ON o.id=u.organization_id
 WHERE o.id=org AND u.id=unit AND u.is_active AND o.is_active
$$;
-- Core unit currently has no timezone column; inherit canonical Organization.timezone.
-- No parallel unit master is introduced. Future per-unit timezone override belongs to Core.
CREATE FUNCTION personnel_private.immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'IMMUTABLE_EVENT'; END $$;
CREATE TRIGGER personnel_punch_immutable BEFORE UPDATE OR DELETE ON public.personnel_attendance_punches FOR EACH ROW EXECUTE FUNCTION personnel_private.immutable();
CREATE TRIGGER personnel_observation_immutable BEFORE UPDATE OR DELETE ON public.personnel_punch_observations FOR EACH ROW EXECUTE FUNCTION personnel_private.immutable();
CREATE TRIGGER personnel_correction_immutable BEFORE UPDATE OR DELETE ON public.personnel_attendance_corrections FOR EACH ROW EXECUTE FUNCTION personnel_private.immutable();
CREATE TRIGGER personnel_schedule_history_immutable BEFORE UPDATE OR DELETE ON personnel_private.schedule_history FOR EACH ROW EXECUTE FUNCTION personnel_private.immutable();
CREATE TRIGGER personnel_audit_immutable BEFORE UPDATE OR DELETE ON personnel_private.audit FOR EACH ROW EXECUTE FUNCTION personnel_private.immutable();

CREATE FUNCTION public.personnel_admin_command(p_org uuid,p_unit uuid,p_action text,p_body jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE emp public.personnel_employees; shift public.personnel_schedules; result jsonb; z text; a timestamptz; b timestamptz; eid uuid; sid uuid; uid uuid; day date; units jsonb; old_cost numeric;
BEGIN
 IF NOT public.personnel_admin_allowed(p_org,p_unit) THEN RAISE EXCEPTION 'ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 IF p_action='snapshot' THEN
  IF p_unit IS NULL OR (p_body->>'to')::date < (p_body->>'from')::date OR (p_body->>'to')::date-(p_body->>'from')::date>93 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  RETURN jsonb_build_object(
   'organization', (SELECT jsonb_build_object('id',id,'name',name) FROM public.eco_organizations WHERE id=p_org),
   'units', (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'timeZone',personnel_private.unit_zone(p_org,id))),'[]') FROM public.eco_operational_units WHERE organization_id=p_org AND is_active AND public.core_can_read_unit(p_org,id)),
   'employees',(SELECT coalesce(jsonb_agg(to_jsonb(e) || jsonb_build_object('pinSet',EXISTS(SELECT 1 FROM personnel_private.pin_credentials c WHERE c.employee_id=e.id))),'[]') FROM public.personnel_employees e WHERE organization_id=p_org),
   'employment',(SELECT coalesce(jsonb_agg(CASE WHEN public.can_execute_capability_for_org(p_org,'sensitivedata.salaries.read') THEN to_jsonb(e) ELSE to_jsonb(e)-'hourly_cost' END),'[]') FROM public.personnel_employment_assignments e WHERE organization_id=p_org),
   'assignments',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM public.personnel_unit_assignments x WHERE organization_id=p_org),
   'schedules',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY expected_start_at),'[]') FROM public.personnel_schedules s WHERE organization_id=p_org AND operational_unit_id=p_unit AND local_date BETWEEN (p_body->>'from')::date AND (p_body->>'to')::date AND NOT cancelled),
   'punches',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY occurred_at),'[]') FROM public.personnel_attendance_punches x WHERE organization_id=p_org AND operational_unit_id=p_unit AND local_date BETWEEN (p_body->>'from')::date-1 AND (p_body->>'to')::date+1),
   'corrections',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.sequence),'[]') FROM public.personnel_attendance_corrections c JOIN public.personnel_schedules s ON s.id=c.schedule_id WHERE c.organization_id=p_org AND s.operational_unit_id=p_unit AND s.local_date BETWEEN (p_body->>'from')::date AND (p_body->>'to')::date),
   'observations',(SELECT coalesce(jsonb_agg(to_jsonb(o)),'[]') FROM public.personnel_punch_observations o JOIN public.personnel_attendance_punches p ON p.id=o.punch_id WHERE p.organization_id=p_org AND p.operational_unit_id=p_unit AND p.local_date BETWEEN (p_body->>'from')::date-1 AND (p_body->>'to')::date+1),
   'devices',(SELECT coalesce(jsonb_agg(to_jsonb(d)),'[]') FROM public.personnel_punch_devices d WHERE organization_id=p_org AND operational_unit_id=p_unit));
 END IF;
 IF p_action='employee.save' THEN
  eid:=coalesce((p_body->>'id')::uuid,gen_random_uuid());
  SELECT * INTO emp FROM public.personnel_employees WHERE id=eid AND organization_id=p_org FOR UPDATE;
  IF FOUND THEN
   IF emp.revision IS DISTINCT FROM (p_body->>'revision')::integer THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;
   UPDATE public.personnel_employees SET first_name=p_body->>'firstName',last_name=p_body->>'lastName',preferred_name=p_body->>'preferredName',phone=p_body->>'phone',email=p_body->>'email',employment_status=p_body->>'status',revision=revision+1 WHERE id=eid;
  ELSE
   IF p_body ? 'id' THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
   INSERT INTO public.personnel_employees(id,organization_id,first_name,last_name,preferred_name,phone,email,employment_status)
   VALUES(eid,p_org,p_body->>'firstName',p_body->>'lastName',p_body->>'preferredName',p_body->>'phone',p_body->>'email',coalesce(p_body->>'status','ACTIVE'));
  END IF;
  IF p_body ? 'hourlyCost' AND NOT public.can_execute_capability_for_org(p_org,'sensitivedata.salaries.read') THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  -- Version employment facts instead of rewriting an old contract.
  SELECT hourly_cost INTO old_cost FROM public.personnel_employment_assignments WHERE employee_id=eid AND end_date IS NULL;
  UPDATE public.personnel_employment_assignments SET end_date=greatest(start_date,current_date) WHERE employee_id=eid AND end_date IS NULL;
  INSERT INTO public.personnel_employment_assignments(organization_id,employee_id,position,start_date,contract_type,weekly_hours,hourly_cost)
  VALUES(p_org,eid,p_body->>'position',(p_body->>'startDate')::date,p_body->>'contractType',nullif(p_body->>'weeklyHours','')::numeric,CASE WHEN p_body ? 'hourlyCost' THEN nullif(p_body->>'hourlyCost','')::numeric ELSE old_cost END);
  units:=p_body->'unitIds';
  IF units IS NULL OR jsonb_typeof(units)<>'array' OR jsonb_array_length(units)=0 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  FOR uid IN SELECT value::uuid FROM jsonb_array_elements_text(units) LOOP
   IF NOT public.core_can_read_unit(p_org,uid) THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.personnel_unit_assignments WHERE employee_id=eid AND operational_unit_id=uid AND valid_to IS NULL) THEN
    INSERT INTO public.personnel_unit_assignments(organization_id,employee_id,operational_unit_id,valid_from) VALUES(p_org,eid,uid,(now() AT TIME ZONE personnel_private.unit_zone(p_org,uid))::date);
   END IF;
  END LOOP;
  UPDATE public.personnel_unit_assignments SET valid_to=(now() AT TIME ZONE personnel_private.unit_zone(p_org,operational_unit_id))::date WHERE employee_id=eid AND valid_to IS NULL AND NOT (units ? operational_unit_id::text);
  result:=jsonb_build_object('id',eid);
 ELSIF p_action IN('schedule.save','schedule.cancel') THEN
  IF p_unit IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  eid:=(p_body->>'employeeId')::uuid; sid:=coalesce((p_body->>'id')::uuid,gen_random_uuid());
  PERFORM 1 FROM public.personnel_employees WHERE id=eid AND organization_id=p_org AND (employment_status='ACTIVE' OR p_action='schedule.cancel') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  SELECT * INTO shift FROM public.personnel_schedules WHERE id=sid AND organization_id=p_org AND operational_unit_id=p_unit FOR UPDATE;
  IF FOUND THEN
   IF shift.employee_id<>eid OR shift.revision IS DISTINCT FROM (p_body->>'revision')::integer THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;
   IF shift.expected_start_at<=now() OR EXISTS(SELECT 1 FROM public.personnel_attendance_punches WHERE schedule_id=sid) THEN RAISE EXCEPTION 'HISTORICAL_SCHEDULE'; END IF;
   INSERT INTO personnel_private.schedule_history(schedule_id,organization_id,before_image,actor) VALUES(sid,p_org,to_jsonb(shift),auth.uid());
  ELSIF p_body ? 'id' THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  IF p_action='schedule.cancel' THEN
   UPDATE public.personnel_schedules SET cancelled=true,revision=revision+1 WHERE id=sid;
  ELSE
   z:=personnel_private.unit_zone(p_org,p_unit); day:=(p_body->>'date')::date;
   a:=(day+(p_body->>'start')::time) AT TIME ZONE z;
   b:=((day+CASE WHEN (p_body->>'end')::time <= (p_body->>'start')::time THEN 1 ELSE 0 END)+(p_body->>'end')::time) AT TIME ZONE z;
   IF (a AT TIME ZONE z)::time<>(p_body->>'start')::time OR (b AT TIME ZONE z)::time<>(p_body->>'end')::time OR a<=now() THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
   IF EXISTS(SELECT 1 FROM (SELECT n*interval '30 minutes' off FROM generate_series(-4,4) n WHERE n<>0) offsets WHERE off<>interval '0' AND ((a+off) AT TIME ZONE z=a AT TIME ZONE z OR (b+off) AT TIME ZONE z=b AT TIME ZONE z)) THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.personnel_unit_assignments WHERE employee_id=eid AND operational_unit_id=p_unit AND valid_from<=day AND (valid_to IS NULL OR valid_to>day)) THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
   IF EXISTS(SELECT 1 FROM public.personnel_schedules WHERE employee_id=eid AND id<>sid AND NOT cancelled AND expected_start_at<b AND expected_end_at>a) THEN RAISE EXCEPTION 'OVERLAPPING_SCHEDULE'; END IF;
   INSERT INTO public.personnel_schedules(id,organization_id,operational_unit_id,employee_id,local_date,expected_start_time,expected_end_time,timezone,expected_start_at,expected_end_at,note)
   VALUES(sid,p_org,p_unit,eid,day,(p_body->>'start')::time,(p_body->>'end')::time,z,a,b,p_body->>'note')
   ON CONFLICT(id) DO UPDATE SET local_date=excluded.local_date,expected_start_time=excluded.expected_start_time,expected_end_time=excluded.expected_end_time,timezone=excluded.timezone,expected_start_at=excluded.expected_start_at,expected_end_at=excluded.expected_end_at,note=excluded.note,revision=personnel_schedules.revision+1;
  END IF;
  result:=jsonb_build_object('id',sid);
 ELSIF p_action='pin.reset' THEN
  eid:=(p_body->>'employeeId')::uuid;
  PERFORM 1 FROM public.personnel_employees WHERE id=eid AND organization_id=p_org AND employment_status='ACTIVE' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  BEGIN
   INSERT INTO personnel_private.pin_credentials(employee_id,organization_id,lookup_hash,password_hash) VALUES(eid,p_org,p_body->>'lookup',p_body->>'hash')
   ON CONFLICT(employee_id) DO UPDATE SET lookup_hash=excluded.lookup_hash,password_hash=excluded.password_hash,revision=gen_random_uuid(),updated_at=now();
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'PIN_COLLISION'; END;
  result:='{}';
 ELSIF p_action='device.activate' THEN
  IF p_unit IS NULL OR length(p_body->>'label') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  INSERT INTO personnel_private.activations(token_hash,organization_id,operational_unit_id,label,created_by,expires_at)
  VALUES(p_body->>'tokenHash',p_org,p_unit,p_body->>'label',auth.uid(),now()+interval '10 minutes'); result:='{}';
 ELSIF p_action='device.revoke' THEN
  UPDATE public.personnel_punch_devices SET revoked_at=now() WHERE id=(p_body->>'deviceId')::uuid AND organization_id=p_org AND operational_unit_id=p_unit;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF; result:='{}';
 ELSIF p_action='attendance.correct' THEN
  IF NOT public.can_execute_capability_for_org(p_org,'personnel.fichajes.audit') THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  SELECT * INTO shift FROM public.personnel_schedules WHERE id=(p_body->>'scheduleId')::uuid AND organization_id=p_org AND operational_unit_id=p_unit;
  IF NOT FOUND OR shift.employee_id<>(p_body->>'employeeId')::uuid THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  PERFORM 1 FROM public.personnel_employees WHERE id=shift.employee_id FOR UPDATE;
  IF (p_body->>'clockIn')::timestamptz>now() OR (p_body->>'clockOut')::timestamptz>now() THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  INSERT INTO public.personnel_attendance_corrections(organization_id,employee_id,schedule_id,clock_in,clock_out,reason,actor)
  VALUES(p_org,shift.employee_id,shift.id,(p_body->>'clockIn')::timestamptz,(p_body->>'clockOut')::timestamptz,p_body->>'reason',auth.uid()); result:='{}';
 ELSE RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 INSERT INTO personnel_private.audit(organization_id,event,actor) VALUES(p_org,p_action,auth.uid());
 RETURN result;
END $$;

-- Every device action is server-role-only. Request permits bind the server-side
-- scrypt verification to one credential revision and one bounded database attempt.
CREATE FUNCTION personnel_private.budget(k text, ceiling integer) RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE n integer;
BEGIN
 INSERT INTO personnel_private.rate_windows(key,started_at,count) VALUES(k,now(),1)
 ON CONFLICT(key) DO UPDATE SET started_at=CASE WHEN rate_windows.started_at<now()-interval '1 minute' THEN now() ELSE rate_windows.started_at END,
 count=CASE WHEN rate_windows.started_at<now()-interval '1 minute' THEN 1 ELSE rate_windows.count+1 END RETURNING count INTO n;
 RETURN n<=ceiling;
END $$;
CREATE FUNCTION personnel_private.device(p_hash text) RETURNS public.personnel_punch_devices LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT d FROM public.personnel_punch_devices d JOIN personnel_private.device_credentials c ON c.device_id=d.id
 JOIN public.eco_operational_units u ON u.id=d.operational_unit_id AND u.organization_id=d.organization_id
 JOIN public.eco_organizations o ON o.id=d.organization_id
 WHERE c.token_hash=p_hash AND d.revoked_at IS NULL AND d.expires_at>now() AND u.is_active AND o.is_active
 AND EXISTS(SELECT 1 FROM public.eco_organization_module_entitlements e WHERE e.organization_id=d.organization_id AND e.module_key='personal' AND e.is_enabled)
$$;
CREATE FUNCTION public.personnel_device_command(p_action text,p_token_hash text,p_ip_key text,p_body jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d public.personnel_punch_devices; activation personnel_private.activations; credential personnel_private.pin_credentials; attempt personnel_private.attempts;
 emp public.personnel_employees; previous public.personnel_attendance_punches; event public.personnel_attendance_punches; shift public.personnel_schedules;
 last_correction public.personnel_attendance_corrections;
 z text; day date; stamp timestamptz; eid uuid; kind text; previous_kind text; sid uuid; allowed boolean;
BEGIN
 IF p_action='activate' THEN
  IF NOT personnel_private.budget('activate:'||p_ip_key,10) THEN RETURN jsonb_build_object('error','INVALID_DEVICE'); END IF;
  SELECT * INTO activation FROM personnel_private.activations WHERE token_hash=p_token_hash FOR UPDATE;
  IF NOT FOUND OR activation.consumed_at IS NOT NULL OR activation.expires_at<=now() OR personnel_private.unit_zone(activation.organization_id,activation.operational_unit_id) IS NULL
   OR NOT EXISTS(SELECT 1 FROM public.eco_organization_module_entitlements WHERE organization_id=activation.organization_id AND module_key='personal' AND is_enabled)
  THEN INSERT INTO personnel_private.audit(event) VALUES('ACTIVATION_DENIED'); RETURN jsonb_build_object('error','INVALID_DEVICE'); END IF;
  INSERT INTO public.personnel_punch_devices(organization_id,operational_unit_id,label) VALUES(activation.organization_id,activation.operational_unit_id,activation.label) RETURNING * INTO d;
  INSERT INTO personnel_private.device_credentials VALUES(d.id,p_body->>'deviceHash');
  UPDATE personnel_private.activations SET consumed_at=now() WHERE token_hash=p_token_hash;
  INSERT INTO personnel_private.audit(organization_id,device_id,event) VALUES(d.organization_id,d.id,'DEVICE_ACTIVATED');
  RETURN jsonb_build_object('ok',true);
 END IF;
 d:=personnel_private.device(p_token_hash);
 IF d.id IS NULL THEN
  PERFORM personnel_private.budget('invalid-device:'||p_ip_key,30);
  RETURN jsonb_build_object('error','INVALID_DEVICE');
 END IF;
 -- Lock same device so revocation cannot race a committing punch.
 PERFORM 1 FROM public.personnel_punch_devices WHERE id=d.id FOR UPDATE;
 d:=personnel_private.device(p_token_hash);
 IF d.id IS NULL THEN RETURN jsonb_build_object('error','INVALID_DEVICE'); END IF;
 IF p_action='session' THEN
  RETURN jsonb_build_object('organization',(SELECT name FROM public.eco_organizations WHERE id=d.organization_id),'unit',(SELECT name FROM public.eco_operational_units WHERE id=d.operational_unit_id),'timeZone',personnel_private.unit_zone(d.organization_id,d.operational_unit_id));
 ELSIF p_action='prepare' THEN
  allowed:=personnel_private.budget('device:'||d.id,8);
  allowed:=personnel_private.budget('org:'||d.organization_id,120) AND allowed;
  IF NOT allowed THEN INSERT INTO personnel_private.audit(organization_id,device_id,event) VALUES(d.organization_id,d.id,'THROTTLED'); RETURN jsonb_build_object('error','PIN_REJECTED'); END IF;
  SELECT * INTO credential FROM personnel_private.pin_credentials WHERE organization_id=d.organization_id AND lookup_hash=p_body->>'lookup';
  -- Failure audit is committed even if caller later crashes. No PIN/lookup logged.
  INSERT INTO personnel_private.audit(organization_id,device_id,event) VALUES(d.organization_id,d.id,'PIN_ATTEMPT');
  INSERT INTO personnel_private.attempts(device_id,employee_id,credential_revision,request_id,expires_at)
  VALUES(d.id,credential.employee_id,credential.revision,(p_body->>'requestId')::uuid,now()+interval '30 seconds') RETURNING * INTO attempt;
  RETURN jsonb_build_object('attemptId',attempt.id,'hash',credential.password_hash,'org',d.organization_id);
 ELSIF p_action='org' THEN
  -- Internal backend only; never returned by HTTP. Needed for tenant-bound HMAC.
  RETURN jsonb_build_object('org',d.organization_id);
 ELSIF p_action='execute' THEN
  SELECT * INTO attempt FROM personnel_private.attempts WHERE id=(p_body->>'attemptId')::uuid AND device_id=d.id FOR UPDATE;
  IF NOT FOUND OR attempt.consumed_at IS NOT NULL OR attempt.expires_at<=now() THEN RETURN jsonb_build_object('error','PIN_REJECTED'); END IF;
  UPDATE personnel_private.attempts SET consumed_at=now() WHERE id=attempt.id;
  IF coalesce((p_body->>'verified')::boolean,false) IS NOT TRUE OR attempt.employee_id IS NULL THEN
   INSERT INTO personnel_private.audit(organization_id,device_id,event) VALUES(d.organization_id,d.id,'PIN_REJECTED'); RETURN jsonb_build_object('error','PIN_REJECTED');
  END IF;
  SELECT * INTO emp FROM public.personnel_employees WHERE id=attempt.employee_id AND organization_id=d.organization_id FOR UPDATE;
  stamp:=clock_timestamp(); z:=personnel_private.unit_zone(d.organization_id,d.operational_unit_id); day:=(stamp AT TIME ZONE z)::date;
  IF emp.employment_status<>'ACTIVE' OR NOT EXISTS(SELECT 1 FROM personnel_private.pin_credentials WHERE employee_id=emp.id AND revision=attempt.credential_revision)
    OR NOT EXISTS(SELECT 1 FROM public.personnel_unit_assignments WHERE employee_id=emp.id AND operational_unit_id=d.operational_unit_id AND valid_from<=day AND (valid_to IS NULL OR valid_to>day))
  THEN INSERT INTO personnel_private.audit(organization_id,device_id,event) VALUES(d.organization_id,d.id,'PIN_REJECTED'); RETURN jsonb_build_object('error','PIN_REJECTED'); END IF;
  SELECT * INTO event FROM public.personnel_attendance_punches WHERE device_id=d.id AND request_id=attempt.request_id;
  IF FOUND THEN
   IF event.employee_id<>emp.id THEN RETURN jsonb_build_object('error','PIN_REJECTED'); END IF;
  ELSE
   SELECT * INTO previous FROM public.personnel_attendance_punches WHERE employee_id=emp.id ORDER BY occurred_at DESC,created_at DESC LIMIT 1;
   IF previous.id IS NOT NULL AND previous.occurred_at>now()-interval '5 seconds' THEN RETURN jsonb_build_object('error','DUPLICATE_PUNCH'); END IF;
   previous_kind:=previous.kind;
   SELECT * INTO last_correction FROM public.personnel_attendance_corrections WHERE employee_id=emp.id AND schedule_id=previous.schedule_id ORDER BY sequence DESC LIMIT 1;
   IF last_correction.id IS NOT NULL AND last_correction.created_at>=previous.created_at THEN
    previous_kind:=CASE WHEN last_correction.clock_out IS NULL THEN 'IN' ELSE 'OUT' END;
   END IF;
   -- A correction can supply a forgotten IN without fabricating a raw punch.
   IF previous_kind IS DISTINCT FROM 'IN' THEN
    SELECT * INTO last_correction FROM public.personnel_attendance_corrections c WHERE employee_id=emp.id AND clock_out IS NULL
    AND NOT EXISTS(SELECT 1 FROM public.personnel_attendance_corrections newer WHERE newer.employee_id=c.employee_id AND newer.schedule_id=c.schedule_id AND newer.sequence>c.sequence)
    AND clock_in>coalesce(previous.occurred_at,'-infinity'::timestamptz) ORDER BY sequence DESC LIMIT 1;
    IF FOUND THEN
     previous_kind:='IN'; previous.schedule_id:=last_correction.schedule_id; previous.session_id:=last_correction.id;
     SELECT operational_unit_id INTO previous.operational_unit_id FROM public.personnel_schedules WHERE id=last_correction.schedule_id;
    END IF;
   END IF;
   IF previous_kind='IN' AND previous.operational_unit_id<>d.operational_unit_id THEN RETURN jsonb_build_object('error','PIN_REJECTED'); END IF;
   kind:=CASE WHEN previous_kind='IN' THEN 'OUT' ELSE 'IN' END;
   IF kind='OUT' THEN sid:=previous.schedule_id; eid:=previous.session_id;
   ELSE
    SELECT * INTO shift FROM public.personnel_schedules s WHERE employee_id=emp.id AND operational_unit_id=d.operational_unit_id AND NOT cancelled
    AND NOT EXISTS(SELECT 1 FROM public.personnel_attendance_punches p WHERE p.schedule_id=s.id AND p.kind='IN')
    AND NOT EXISTS(SELECT 1 FROM public.personnel_attendance_corrections c WHERE c.schedule_id=s.id)
    AND expected_start_at<=now()+interval '4 hours' AND expected_end_at>=now()-interval '4 hours'
    ORDER BY abs(extract(epoch FROM expected_start_at-now())) LIMIT 1;
    sid:=shift.id; eid:=gen_random_uuid();
   END IF;
   INSERT INTO public.personnel_attendance_punches(organization_id,operational_unit_id,employee_id,device_id,kind,occurred_at,local_date,timezone,schedule_id,session_id,request_id)
   VALUES(d.organization_id,d.operational_unit_id,emp.id,d.id,kind,stamp,day,z,sid,eid,attempt.request_id) RETURNING * INTO event;
   INSERT INTO personnel_private.audit(organization_id,device_id,event) VALUES(d.organization_id,d.id,'PUNCH_COMMITTED');
  END IF;
  RETURN jsonb_build_object('id',event.id,'kind',event.kind,'occurredAt',event.occurred_at,'firstName',coalesce(nullif(emp.preferred_name,''),emp.first_name));
 ELSIF p_action='observe' THEN
  SELECT * INTO event FROM public.personnel_attendance_punches WHERE id=(p_body->>'punchId')::uuid AND device_id=d.id AND occurred_at>now()-interval '2 minutes';
  IF NOT FOUND THEN RETURN jsonb_build_object('error','INVALID_DEVICE'); END IF;
  INSERT INTO public.personnel_punch_observations(organization_id,punch_id,observation) VALUES(d.organization_id,event.id,p_body->>'observation') ON CONFLICT(punch_id) DO NOTHING;
  RETURN jsonb_build_object('ok',true);
 END IF;
 RETURN jsonb_build_object('error','INVALID_DEVICE');
END $$;

DO $security$
DECLARE t text; f record;
BEGIN
 FOREACH t IN ARRAY ARRAY['personnel_employees','personnel_employment_assignments','personnel_unit_assignments','personnel_schedules','personnel_punch_devices','personnel_attendance_punches','personnel_punch_observations','personnel_attendance_corrections'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('CREATE POLICY personnel_admin_read ON public.%I FOR SELECT TO authenticated USING(public.personnel_admin_allowed(organization_id))',t);
 END LOOP;
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='personnel_private' LOOP
  EXECUTE format('ALTER TABLE personnel_private.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON personnel_private.%I FROM PUBLIC,anon,authenticated',t);
 END LOOP;
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='personnel_private' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 END LOOP;
END $security$;
REVOKE ALL ON FUNCTION public.personnel_admin_command(uuid,uuid,text,jsonb),public.personnel_device_command(text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.personnel_admin_command(uuid,uuid,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.personnel_device_command(text,text,text,jsonb) TO service_role;
REVOKE ALL ON SEQUENCE public.personnel_attendance_corrections_sequence_seq FROM PUBLIC,anon,authenticated;
COMMIT;
