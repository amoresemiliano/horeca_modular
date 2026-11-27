-- CCR-PERSONNEL-SCHEDULE-GRANULARITY. No production data changes.
BEGIN;
INSERT INTO public.eco_capabilities(code,scope,description,required_module_key) VALUES
 ('personnel.employees.view','OPERATIONAL_UNIT','Ver empleados','personal'),
 ('personnel.attendance.view','OPERATIONAL_UNIT','Ver asistencia','personal'),
 ('personnel.schedules.view','OPERATIONAL_UNIT','Ver horarios','personal'),
 ('personnel.schedules.manage','OPERATIONAL_UNIT','Gestionar horarios','personal');
INSERT INTO public.eco_role_template_capabilities(role_template_id,capability_id)
 SELECT r.id,c.id FROM public.eco_role_templates r CROSS JOIN public.eco_capabilities c
 WHERE r.code='OWNER' AND c.code IN ('personnel.employees.view','personnel.attendance.view','personnel.schedules.view','personnel.schedules.manage');
CREATE OR REPLACE FUNCTION public.personnel_admin_command(p_org uuid,p_unit uuid,p_action text,p_body jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE emp public.personnel_employees; shift public.personnel_schedules; result jsonb; z text; a timestamptz; b timestamptz; eid uuid; sid uuid; uid uuid; day date; units jsonb; old_cost numeric;
BEGIN
 IF p_unit IS NULL OR NOT public.core_can_read_unit(p_org,p_unit) OR NOT EXISTS
  (SELECT 1 FROM public.eco_organization_module_entitlements WHERE organization_id=p_org AND module_key='personal' AND is_enabled)
  THEN RAISE EXCEPTION 'ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 IF p_action='snapshot' THEN
  IF NOT (public.can_execute_capability_for_org(p_org,'personnel.employees.view',p_unit)
   OR public.can_execute_capability_for_org(p_org,'personnel.attendance.view',p_unit)
   OR public.can_execute_capability_for_org(p_org,'personnel.schedules.view',p_unit)
   OR public.can_execute_capability_for_org(p_org,'personnel.employees.manage')) THEN RAISE EXCEPTION 'ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 ELSIF p_action IN ('schedule.save','schedule.cancel') THEN
  IF NOT (public.can_execute_capability_for_org(p_org,'personnel.schedules.view',p_unit) AND
          public.can_execute_capability_for_org(p_org,'personnel.schedules.manage',p_unit)) THEN RAISE EXCEPTION 'ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 ELSIF p_action='attendance.correct' THEN
  IF NOT public.can_execute_capability_for_org(p_org,'personnel.fichajes.audit') THEN RAISE EXCEPTION 'ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 ELSIF p_action IN ('employee.save','pin.reset','device.activate','device.revoke') THEN
  IF NOT public.can_execute_capability_for_org(p_org,'personnel.employees.manage') THEN RAISE EXCEPTION 'ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 ELSE RAISE EXCEPTION 'ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 IF p_action='snapshot' THEN
  IF p_unit IS NULL OR (p_body->>'to')::date < (p_body->>'from')::date OR (p_body->>'to')::date-(p_body->>'from')::date>93 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  RETURN jsonb_build_object(
   'organization',(SELECT jsonb_build_object('id',id,'name',name) FROM public.eco_organizations WHERE id=p_org),
   'units',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'timeZone',personnel_private.unit_zone(p_org,id))),'[]') FROM public.eco_operational_units WHERE organization_id=p_org AND id=p_unit),
   'employees',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'first_name',e.first_name,'last_name',e.last_name,'preferred_name',e.preferred_name,'employment_status',e.employment_status) || CASE WHEN public.can_execute_capability_for_org(p_org,'personnel.employees.manage') THEN jsonb_build_object('revision',e.revision,'phone',e.phone,'email',e.email,'pinSet',EXISTS(SELECT 1 FROM personnel_private.pin_credentials c WHERE c.employee_id=e.id)) ELSE '{}'::jsonb END),'[]') FROM public.personnel_employees e WHERE e.organization_id=p_org AND (EXISTS(SELECT 1 FROM public.personnel_unit_assignments x WHERE x.employee_id=e.id AND x.organization_id=p_org AND x.operational_unit_id=p_unit) OR EXISTS(SELECT 1 FROM public.personnel_schedules s WHERE s.employee_id=e.id AND s.organization_id=p_org AND s.operational_unit_id=p_unit AND s.local_date BETWEEN (p_body->>'from')::date AND (p_body->>'to')::date))),
   'employment',CASE WHEN public.can_execute_capability_for_org(p_org,'personnel.employees.manage') THEN (SELECT coalesce(jsonb_agg(CASE WHEN public.can_execute_capability_for_org(p_org,'sensitivedata.salaries.read') THEN to_jsonb(e) ELSE to_jsonb(e)-'hourly_cost' END),'[]') FROM public.personnel_employment_assignments e WHERE organization_id=p_org AND EXISTS(SELECT 1 FROM public.personnel_unit_assignments x WHERE x.employee_id=e.employee_id AND x.operational_unit_id=p_unit AND x.organization_id=p_org)) ELSE '[]'::jsonb END,
   'assignments',(SELECT coalesce(jsonb_agg(jsonb_build_object('employee_id',x.employee_id,'operational_unit_id',x.operational_unit_id,'valid_to',x.valid_to)),'[]') FROM public.personnel_unit_assignments x WHERE x.organization_id=p_org AND x.operational_unit_id=p_unit AND x.valid_to IS NULL),
   'schedules',CASE WHEN public.can_execute_capability_for_org(p_org,'personnel.schedules.view',p_unit) OR public.can_execute_capability_for_org(p_org,'personnel.attendance.view',p_unit) THEN (SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY expected_start_at),'[]') FROM public.personnel_schedules s WHERE organization_id=p_org AND operational_unit_id=p_unit AND local_date BETWEEN (p_body->>'from')::date AND (p_body->>'to')::date AND NOT cancelled) ELSE '[]'::jsonb END,
   'punches',CASE WHEN public.can_execute_capability_for_org(p_org,'personnel.attendance.view',p_unit) THEN (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY occurred_at),'[]') FROM public.personnel_attendance_punches x WHERE organization_id=p_org AND operational_unit_id=p_unit AND local_date BETWEEN (p_body->>'from')::date-1 AND (p_body->>'to')::date+1) ELSE '[]'::jsonb END,
   'corrections',CASE WHEN public.can_execute_capability_for_org(p_org,'personnel.attendance.view',p_unit) THEN (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.sequence),'[]') FROM public.personnel_attendance_corrections c JOIN public.personnel_schedules s ON s.id=c.schedule_id WHERE c.organization_id=p_org AND s.operational_unit_id=p_unit AND s.local_date BETWEEN (p_body->>'from')::date AND (p_body->>'to')::date) ELSE '[]'::jsonb END,
   'observations',CASE WHEN public.can_execute_capability_for_org(p_org,'personnel.attendance.view',p_unit) THEN (SELECT coalesce(jsonb_agg(to_jsonb(o)),'[]') FROM public.personnel_punch_observations o JOIN public.personnel_attendance_punches p ON p.id=o.punch_id WHERE p.organization_id=p_org AND p.operational_unit_id=p_unit AND p.local_date BETWEEN (p_body->>'from')::date-1 AND (p_body->>'to')::date+1) ELSE '[]'::jsonb END,
   'devices',CASE WHEN public.can_execute_capability_for_org(p_org,'personnel.employees.manage') THEN (SELECT coalesce(jsonb_agg(to_jsonb(d)),'[]') FROM public.personnel_punch_devices d WHERE organization_id=p_org AND operational_unit_id=p_unit) ELSE '[]'::jsonb END);
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

COMMIT;
