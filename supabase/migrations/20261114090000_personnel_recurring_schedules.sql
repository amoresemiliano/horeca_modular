-- Weekly rules are canonical; dated shifts are bounded, stable attendance facts.
BEGIN;
CREATE TABLE public.personnel_schedule_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
 operational_unit_id uuid NOT NULL, employee_id uuid NOT NULL,
 weekdays integer[] NOT NULL CHECK(cardinality(weekdays) BETWEEN 1 AND 7 AND weekdays <@ ARRAY[1,2,3,4,5,6,7]),
 start_time time NOT NULL, end_time time NOT NULL, valid_from date NOT NULL, valid_until date,
 revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(valid_until IS NULL OR valid_until>=valid_from),
 CHECK((CASE WHEN end_time>start_time THEN end_time-start_time ELSE end_time-start_time+interval '24 hours' END) BETWEEN interval '1 minute' AND interval '16 hours'),
 FOREIGN KEY(employee_id,organization_id) REFERENCES public.personnel_employees(id,organization_id),
 FOREIGN KEY(operational_unit_id,organization_id) REFERENCES public.eco_operational_units(id,organization_id), UNIQUE(id,organization_id)
);
CREATE INDEX personnel_rule_lookup ON public.personnel_schedule_rules(organization_id,operational_unit_id,employee_id);
CREATE TABLE public.personnel_schedule_exceptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, operational_unit_id uuid NOT NULL,
 employee_id uuid NOT NULL, local_date date NOT NULL, cancelled boolean NOT NULL DEFAULT false,
 start_time time, end_time time, note text CHECK(length(note)<=500), revision integer NOT NULL DEFAULT 1,
 CHECK(cancelled OR (start_time IS NOT NULL AND end_time IS NOT NULL)),
 FOREIGN KEY(employee_id,organization_id) REFERENCES public.personnel_employees(id,organization_id),
 FOREIGN KEY(operational_unit_id,organization_id) REFERENCES public.eco_operational_units(id,organization_id),
 UNIQUE(employee_id,operational_unit_id,local_date)
);
ALTER TABLE public.personnel_schedules ADD COLUMN source_rule_id uuid REFERENCES public.personnel_schedule_rules(id);
ALTER TABLE public.personnel_schedules ADD COLUMN source_exception_id uuid REFERENCES public.personnel_schedule_exceptions(id);
CREATE UNIQUE INDEX personnel_rule_occurrence ON public.personnel_schedules(source_rule_id,local_date) WHERE source_rule_id IS NOT NULL;
CREATE UNIQUE INDEX personnel_exception_occurrence ON public.personnel_schedules(source_exception_id) WHERE source_exception_id IS NOT NULL;
ALTER TABLE public.personnel_schedule_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel_schedule_exceptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.personnel_schedule_rules,public.personnel_schedule_exceptions FROM PUBLIC,anon,authenticated;
CREATE POLICY personnel_rule_read ON public.personnel_schedule_rules FOR SELECT TO authenticated USING(public.personnel_admin_allowed(organization_id,operational_unit_id));
CREATE POLICY personnel_exception_read ON public.personnel_schedule_exceptions FOR SELECT TO authenticated USING(public.personnel_admin_allowed(organization_id,operational_unit_id));
CREATE TABLE personnel_private.schedule_rule_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,entity_id uuid NOT NULL,
 entity_kind text NOT NULL,before_image jsonb NOT NULL,actor uuid NOT NULL,at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE personnel_private.schedule_rule_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON personnel_private.schedule_rule_history FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER personnel_rule_history_immutable BEFORE UPDATE OR DELETE ON personnel_private.schedule_rule_history FOR EACH ROW EXECUTE FUNCTION personnel_private.immutable();

-- Called only by the same trusted admin/device/reminder boundaries as attendance.
CREATE FUNCTION personnel_private.resolve_schedules(org uuid,unit uuid,date_from date,date_to date,worker uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE emp record; day date; rule public.personnel_schedule_rules; ex public.personnel_schedule_exceptions;
 z text; a timestamptz; b timestamptz; st time; en time; rid uuid; xid uuid; sid uuid; frozen boolean;
BEGIN
 IF date_from IS NULL OR date_to IS NULL OR date_to<date_from OR date_to-date_from>93 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 z:=personnel_private.unit_zone(org,unit); IF z IS NULL THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
 FOR emp IN SELECT id FROM public.personnel_employees WHERE organization_id=org AND (worker IS NULL OR id=worker) ORDER BY id FOR UPDATE LOOP
  FOR day IN SELECT date_from+n FROM generate_series(0,date_to-date_from) n LOOP
   -- Never rewrite a started shift or any shift referenced by an immutable fact.
   SELECT EXISTS(SELECT 1 FROM public.personnel_schedules s WHERE s.employee_id=emp.id AND s.operational_unit_id=unit AND s.local_date=day
     AND (s.expected_start_at<=now() OR EXISTS(SELECT 1 FROM public.personnel_attendance_punches p WHERE p.schedule_id=s.id)
       OR EXISTS(SELECT 1 FROM public.personnel_attendance_corrections c WHERE c.schedule_id=s.id))) INTO frozen;
   IF frozen THEN CONTINUE; END IF;
   SELECT * INTO ex FROM public.personnel_schedule_exceptions WHERE employee_id=emp.id AND operational_unit_id=unit AND local_date=day;
   rid:=NULL; xid:=NULL; st:=NULL; en:=NULL;
   IF ex.id IS NOT NULL THEN
    IF NOT ex.cancelled THEN st:=ex.start_time; en:=ex.end_time; xid:=ex.id; END IF;
   ELSIF EXISTS(SELECT 1 FROM public.personnel_schedules s WHERE s.employee_id=emp.id AND s.operational_unit_id=unit AND s.local_date=day AND s.source_rule_id IS NULL AND s.source_exception_id IS NULL) THEN
    CONTINUE; -- Existing manual rows, including cancellations, take precedence.
   ELSE
    SELECT * INTO rule FROM public.personnel_schedule_rules r WHERE r.employee_id=emp.id AND r.operational_unit_id=unit
      AND day>=r.valid_from AND (r.valid_until IS NULL OR day<=r.valid_until) AND extract(isodow FROM day)::int=ANY(r.weekdays) ORDER BY id LIMIT 1;
    IF rule.id IS NOT NULL THEN st:=rule.start_time; en:=rule.end_time; rid:=rule.id; END IF;
   END IF;
   -- A repeated projection must not bump revisions or duplicate reminders.
   IF st IS NOT NULL AND EXISTS(SELECT 1 FROM public.personnel_schedules s WHERE s.employee_id=emp.id AND s.operational_unit_id=unit AND s.local_date=day AND NOT cancelled
    AND s.source_rule_id IS NOT DISTINCT FROM rid AND s.source_exception_id IS NOT DISTINCT FROM xid AND expected_start_time=st AND expected_end_time=en AND note IS NOT DISTINCT FROM ex.note) THEN CONTINUE; END IF;
   -- Only the requested range is materialized, never an unlimited future series.
   INSERT INTO personnel_private.schedule_history(schedule_id,organization_id,before_image,actor)
    SELECT id,org,to_jsonb(s),coalesce(auth.uid(),'00000000-0000-0000-0000-000000000000'::uuid) FROM public.personnel_schedules s WHERE employee_id=emp.id AND operational_unit_id=unit AND local_date=day AND NOT cancelled AND (source_rule_id IS NOT NULL OR source_exception_id IS NOT NULL);
   UPDATE public.personnel_schedules s SET cancelled=true,revision=revision+1 WHERE employee_id=emp.id AND operational_unit_id=unit AND local_date=day AND NOT cancelled AND (source_rule_id IS NOT NULL OR source_exception_id IS NOT NULL);
   IF st IS NULL OR NOT EXISTS(SELECT 1 FROM public.personnel_unit_assignments WHERE employee_id=emp.id AND operational_unit_id=unit AND valid_from<=day AND (valid_to IS NULL OR day<valid_to)) THEN CONTINUE; END IF;
   a:=(day+st) AT TIME ZONE z; b:=((day+CASE WHEN en<=st THEN 1 ELSE 0 END)+en) AT TIME ZONE z;
   -- Reject nonexistent/ambiguous local times rather than invent a DST instant.
   IF (a AT TIME ZONE z)::time<>st OR (b AT TIME ZONE z)::time<>en OR b<=a OR b>a+interval '16 hours'
    OR EXISTS(SELECT 1 FROM generate_series(-4,4) n WHERE n<>0 AND (((a+n*interval '30 minutes') AT TIME ZONE z)=(a AT TIME ZONE z) OR ((b+n*interval '30 minutes') AT TIME ZONE z)=(b AT TIME ZONE z))) THEN
    RAISE EXCEPTION 'INVALID_INPUT';
   END IF;
   IF EXISTS(SELECT 1 FROM public.personnel_schedules s WHERE s.employee_id=emp.id AND NOT cancelled AND expected_start_at<b AND expected_end_at>a) THEN RAISE EXCEPTION 'OVERLAPPING_SCHEDULE'; END IF;
   SELECT id INTO sid FROM public.personnel_schedules WHERE employee_id=emp.id AND operational_unit_id=unit AND local_date=day AND ((rid IS NOT NULL AND source_rule_id=rid) OR (xid IS NOT NULL AND source_exception_id=xid));
   IF sid IS NULL THEN
    INSERT INTO public.personnel_schedules(organization_id,operational_unit_id,employee_id,local_date,expected_start_time,expected_end_time,timezone,expected_start_at,expected_end_at,source_rule_id,source_exception_id,note)
    VALUES(org,unit,emp.id,day,st,en,z,a,b,rid,xid,ex.note);
   ELSE
    UPDATE public.personnel_schedules SET expected_start_time=st,expected_end_time=en,expected_start_at=a,expected_end_at=b,timezone=z,cancelled=false,note=ex.note,revision=revision+1 WHERE id=sid;
   END IF;
  END LOOP;
 END LOOP;
END $$;

-- Keep the original domain commands intact behind a private, revoked adapter.
ALTER FUNCTION public.personnel_admin_command(uuid,uuid,text,jsonb) RENAME TO personnel_admin_command_foundation;
ALTER FUNCTION public.personnel_admin_command_foundation(uuid,uuid,text,jsonb) SET SCHEMA personnel_private;
REVOKE ALL ON FUNCTION personnel_private.personnel_admin_command_foundation(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.personnel_admin_command(p_org uuid,p_unit uuid,p_action text,p_body jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb; r public.personnel_schedule_rules; candidate public.personnel_schedule_rules; ex public.personnel_schedule_exceptions;
 eid uuid; rid uuid; old_rid uuid; day date; today date; z text; a timestamp; b timestamp; vfrom date; vuntil date; days integer[]; st time; en time; other_day date; other_rule record;
BEGIN
 IF NOT public.personnel_admin_allowed(p_org,p_unit) THEN RAISE EXCEPTION 'ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 IF p_action='snapshot' THEN
  PERFORM personnel_private.resolve_schedules(p_org,p_unit,(p_body->>'from')::date,(p_body->>'to')::date);
  result:=personnel_private.personnel_admin_command_foundation(p_org,p_unit,p_action,p_body);
  RETURN result || jsonb_build_object('scheduleRules',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY valid_from,id),'[]') FROM public.personnel_schedule_rules x WHERE organization_id=p_org AND operational_unit_id=p_unit),
   'scheduleExceptions',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY local_date),'[]') FROM public.personnel_schedule_exceptions x WHERE organization_id=p_org AND operational_unit_id=p_unit AND local_date BETWEEN (p_body->>'from')::date AND (p_body->>'to')::date));
 END IF;
 IF p_action NOT IN('schedule.rule.save','schedule.exception.save','schedule.save','schedule.cancel') THEN RETURN personnel_private.personnel_admin_command_foundation(p_org,p_unit,p_action,p_body); END IF;
 IF p_unit IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 eid:=(p_body->>'employeeId')::uuid;
 PERFORM 1 FROM public.personnel_employees WHERE id=eid AND organization_id=p_org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
 z:=personnel_private.unit_zone(p_org,p_unit); today:=(now() AT TIME ZONE z)::date;
 IF p_action='schedule.rule.save' THEN
  rid:=coalesce((p_body->>'id')::uuid,gen_random_uuid());
  SELECT * INTO r FROM public.personnel_schedule_rules WHERE id=rid AND organization_id=p_org AND operational_unit_id=p_unit AND employee_id=eid FOR UPDATE;
  IF r.id IS NULL AND p_body ? 'id' THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  IF r.id IS NOT NULL AND r.revision IS DISTINCT FROM (p_body->>'revision')::int THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;
  vfrom:=(p_body->>'validFrom')::date; vuntil:=nullif(p_body->>'validUntil','')::date;
  st:=(p_body->>'start')::time; en:=(p_body->>'end')::time;
  SELECT array_agg(DISTINCT value::int ORDER BY value::int) INTO days FROM jsonb_array_elements_text(p_body->'weekdays');
  IF vfrom IS NULL OR st IS NULL OR en IS NULL OR days IS NULL OR cardinality(days)=0 OR NOT days <@ ARRAY[1,2,3,4,5,6,7] OR (vuntil IS NOT NULL AND vuntil<vfrom)
   OR (r.id IS NULL AND vfrom<today) OR (r.id IS NOT NULL AND vfrom<today AND vfrom<>r.valid_from)
   OR (CASE WHEN en>st THEN en-st ELSE en-st+interval '24 hours' END) NOT BETWEEN interval '1 minute' AND interval '16 hours' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.personnel_unit_assignments WHERE employee_id=eid AND operational_unit_id=p_unit AND valid_from<=greatest(vfrom,today) AND (valid_to IS NULL OR valid_to>greatest(vfrom,today))) THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.personnel_employees WHERE id=eid AND employment_status='ACTIVE') THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  -- Weekly overlap, including adjacent-day overnight shifts and finite bounds.
  FOR other_rule IN SELECT * FROM public.personnel_schedule_rules WHERE employee_id=eid AND id<>rid LOOP
   FOR day IN SELECT greatest(vfrom,other_rule.valid_from,today)-1+n FROM generate_series(0,15) n LOOP
    IF day<vfrom OR (vuntil IS NOT NULL AND day>vuntil) OR NOT extract(isodow FROM day)::int=ANY(days) THEN CONTINUE; END IF;
    a:=day+st; b:=(day+CASE WHEN en<=st THEN 1 ELSE 0 END)+en;
    FOR other_day IN SELECT day+n FROM generate_series(-1,1) n LOOP
     IF other_day>=other_rule.valid_from AND (other_rule.valid_until IS NULL OR other_day<=other_rule.valid_until) AND extract(isodow FROM other_day)::int=ANY(other_rule.weekdays)
      AND (other_day+other_rule.start_time)<b AND ((other_day+CASE WHEN other_rule.end_time<=other_rule.start_time THEN 1 ELSE 0 END)+other_rule.end_time)>a THEN RAISE EXCEPTION 'OVERLAPPING_SCHEDULE'; END IF;
    END LOOP;
   END LOOP;
  END LOOP;
  -- Version changes to an established rule: never reinterpret earlier dates.
  old_rid:=rid;
  IF r.id IS NOT NULL THEN INSERT INTO personnel_private.schedule_rule_history(organization_id,entity_id,entity_kind,before_image,actor) VALUES(p_org,r.id,'RULE',to_jsonb(r),auth.uid()); END IF;
  IF r.id IS NOT NULL AND r.valid_from<today THEN
   IF vuntil IS NOT NULL AND vuntil<today THEN RAISE EXCEPTION 'HISTORICAL_SCHEDULE'; END IF;
   UPDATE public.personnel_schedule_rules SET valid_until=today-1,revision=revision+1 WHERE id=rid;
   rid:=gen_random_uuid(); vfrom:=greatest(vfrom,today);
  END IF;
  INSERT INTO public.personnel_schedule_rules(id,organization_id,operational_unit_id,employee_id,weekdays,start_time,end_time,valid_from,valid_until)
   VALUES(rid,p_org,p_unit,eid,days,st,en,vfrom,vuntil)
   ON CONFLICT(id) DO UPDATE SET weekdays=excluded.weekdays,start_time=excluded.start_time,end_time=excluded.end_time,valid_from=excluded.valid_from,valid_until=excluded.valid_until,revision=personnel_schedule_rules.revision+1;
  -- Reconcile only already requested future projections, preserving started facts.
  FOR day IN SELECT DISTINCT local_date FROM public.personnel_schedules WHERE employee_id=eid AND source_rule_id=old_rid AND local_date>=today LOOP
   PERFORM personnel_private.resolve_schedules(p_org,p_unit,day,day,eid);
  END LOOP;
  INSERT INTO personnel_private.audit(organization_id,event,actor) VALUES(p_org,'SCHEDULE_RULE_SAVED',auth.uid());
  RETURN jsonb_build_object('id',rid);
 ELSIF p_action='schedule.exception.save' THEN
  day:=(p_body->>'date')::date; st:=nullif(p_body->>'start','')::time; en:=nullif(p_body->>'end','')::time;
  IF NOT EXISTS(SELECT 1 FROM public.personnel_unit_assignments WHERE employee_id=eid AND operational_unit_id=p_unit AND valid_from<=day AND (valid_to IS NULL OR valid_to>day)) THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  IF day IS NULL OR day<today OR (NOT coalesce((p_body->>'cancelled')::boolean,false) AND (st IS NULL OR en IS NULL OR (day+st) AT TIME ZONE z<=now())) THEN RAISE EXCEPTION 'HISTORICAL_SCHEDULE'; END IF;
  IF EXISTS(SELECT 1 FROM public.personnel_schedules s WHERE employee_id=eid AND operational_unit_id=p_unit AND local_date=day AND (expected_start_at<=now() OR EXISTS(SELECT 1 FROM public.personnel_attendance_punches p WHERE p.schedule_id=s.id) OR EXISTS(SELECT 1 FROM public.personnel_attendance_corrections c WHERE c.schedule_id=s.id))) THEN RAISE EXCEPTION 'HISTORICAL_SCHEDULE'; END IF;
  SELECT * INTO ex FROM public.personnel_schedule_exceptions WHERE employee_id=eid AND operational_unit_id=p_unit AND local_date=day;
  IF ex.id IS NOT NULL AND ex.revision IS DISTINCT FROM (p_body->>'revision')::int THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;
  IF ex.id IS NOT NULL THEN INSERT INTO personnel_private.schedule_rule_history(organization_id,entity_id,entity_kind,before_image,actor) VALUES(p_org,ex.id,'EXCEPTION',to_jsonb(ex),auth.uid()); END IF;
  INSERT INTO public.personnel_schedule_exceptions(organization_id,operational_unit_id,employee_id,local_date,cancelled,start_time,end_time,note)
  VALUES(p_org,p_unit,eid,day,coalesce((p_body->>'cancelled')::boolean,false),st,en,p_body->>'note')
  ON CONFLICT(employee_id,operational_unit_id,local_date) DO UPDATE SET cancelled=excluded.cancelled,start_time=excluded.start_time,end_time=excluded.end_time,note=excluded.note,revision=personnel_schedule_exceptions.revision+1;
  INSERT INTO personnel_private.schedule_history(schedule_id,organization_id,before_image,actor) SELECT id,p_org,to_jsonb(s),auth.uid() FROM public.personnel_schedules s WHERE employee_id=eid AND operational_unit_id=p_unit AND local_date=day AND NOT cancelled;
  UPDATE public.personnel_schedules SET cancelled=true,revision=revision+1 WHERE employee_id=eid AND operational_unit_id=p_unit AND local_date=day AND NOT cancelled;
  PERFORM personnel_private.resolve_schedules(p_org,p_unit,day,day,eid);
  INSERT INTO personnel_private.audit(organization_id,event,actor) VALUES(p_org,'SCHEDULE_EXCEPTION_SAVED',auth.uid());
  RETURN jsonb_build_object('ok',true);
 ELSE
  result:=personnel_private.personnel_admin_command_foundation(p_org,p_unit,p_action,p_body);
  IF p_action='schedule.save' THEN
   day:=(p_body->>'date')::date;
   -- Manual dated shifts remain valid and suppress that date's weekly projection.
   UPDATE public.personnel_schedules SET source_rule_id=NULL,source_exception_id=NULL WHERE id=(result->>'id')::uuid;
  END IF;
  RETURN result;
 END IF;
END $$;

ALTER FUNCTION public.personnel_device_command(text,text,text,jsonb) RENAME TO personnel_device_command_foundation;
ALTER FUNCTION public.personnel_device_command_foundation(text,text,text,jsonb) SET SCHEMA personnel_private;
REVOKE ALL ON FUNCTION personnel_private.personnel_device_command_foundation(text,text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.personnel_device_command(p_action text,p_token_hash text,p_ip_key text,p_body jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d public.personnel_punch_devices; day date; worker uuid;
BEGIN
 IF p_action='execute' THEN
  d:=personnel_private.device(p_token_hash);
  IF d.id IS NOT NULL THEN
   SELECT employee_id INTO worker FROM personnel_private.attempts WHERE id=(p_body->>'attemptId')::uuid AND device_id=d.id AND consumed_at IS NULL AND expires_at>now();
   IF worker IS NOT NULL THEN
    day:=(now() AT TIME ZONE personnel_private.unit_zone(d.organization_id,d.operational_unit_id))::date;
    BEGIN
     PERFORM personnel_private.resolve_schedules(d.organization_id,d.operational_unit_id,day-1,day+1,worker);
    EXCEPTION WHEN raise_exception THEN
     -- An invalid local-time projection must never forbid an otherwise valid
     -- unscheduled punch. The original verifier remains the only authority.
     IF SQLERRM NOT IN('INVALID_INPUT','OVERLAPPING_SCHEDULE') THEN RAISE; END IF;
     INSERT INTO personnel_private.audit(organization_id,device_id,event) VALUES(d.organization_id,d.id,'SCHEDULE_PROJECTION_REJECTED');
    END;
   END IF;
  END IF;
 END IF;
 RETURN personnel_private.personnel_device_command_foundation(p_action,p_token_hash,p_ip_key,p_body);
END $$;

-- Optional reminder infrastructure uses the same date resolver; never enable it.
DO $reminders$ BEGIN
 IF to_regprocedure('public.personnel_reminder_job(text,jsonb)') IS NOT NULL THEN
  ALTER FUNCTION public.personnel_reminder_job(text,jsonb) RENAME TO personnel_reminder_job_foundation;
  ALTER FUNCTION public.personnel_reminder_job_foundation(text,jsonb) SET SCHEMA personnel_private;
  REVOKE ALL ON FUNCTION personnel_private.personnel_reminder_job_foundation(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
  EXECUTE $fn$CREATE FUNCTION public.personnel_reminder_job(p_action text,p_body jsonb DEFAULT '{}') RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
  DECLARE u record; day date;
  BEGIN
   IF p_action='claim' THEN
    FOR u IN SELECT DISTINCT organization_id,operational_unit_id FROM public.personnel_schedule_rules LOOP
     day:=(now() AT TIME ZONE personnel_private.unit_zone(u.organization_id,u.operational_unit_id))::date;
     PERFORM personnel_private.resolve_schedules(u.organization_id,u.operational_unit_id,day-1,day+1);
    END LOOP;
   END IF;
   RETURN personnel_private.personnel_reminder_job_foundation(p_action,p_body);
  END $body$ $fn$;
  REVOKE ALL ON FUNCTION public.personnel_reminder_job(text,jsonb) FROM PUBLIC,anon,authenticated;
  GRANT EXECUTE ON FUNCTION public.personnel_reminder_job(text,jsonb) TO service_role;
 END IF;
END $reminders$;
REVOKE ALL ON FUNCTION personnel_private.resolve_schedules(uuid,uuid,date,date,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.personnel_admin_command(uuid,uuid,text,jsonb),public.personnel_device_command(text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.personnel_admin_command(uuid,uuid,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.personnel_device_command(text,text,text,jsonb) TO service_role;
COMMIT;
