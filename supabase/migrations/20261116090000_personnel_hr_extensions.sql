-- Personnel HR extensions. Additive; no employee seeds or existing command replacement.
BEGIN;
CREATE TABLE personnel_private.hr_catalog (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.eco_organizations(id),
 kind text NOT NULL CHECK(kind IN ('incident_type','severity','leave_type')), label text NOT NULL CHECK(length(btrim(label)) BETWEEN 1 AND 80),
 active boolean NOT NULL DEFAULT true, created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,organization_id,kind)
);
CREATE UNIQUE INDEX hr_catalog_label ON personnel_private.hr_catalog(organization_id,kind,lower(label));
CREATE TABLE personnel_private.hr_incidents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, operational_unit_id uuid NOT NULL, employee_id uuid NOT NULL,
 type_id uuid NOT NULL, severity_id uuid NOT NULL, incident_date date NOT NULL,
 description text NOT NULL CHECK(length(btrim(description)) BETWEEN 1 AND 6000), objective text NOT NULL CHECK(length(btrim(objective)) BETWEEN 1 AND 6000),
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','FOLLOW_UP','CLOSED')), revision integer NOT NULL DEFAULT 1,
 created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(employee_id,organization_id) REFERENCES public.personnel_employees(id,organization_id),
 FOREIGN KEY(operational_unit_id,organization_id) REFERENCES public.eco_operational_units(id,organization_id), UNIQUE(id,organization_id)
);
CREATE TABLE personnel_private.hr_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, incident_id uuid NOT NULL, entry_at timestamptz NOT NULL,
 text text NOT NULL CHECK(length(btrim(text)) BETWEEN 1 AND 6000), author uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(incident_id,organization_id) REFERENCES personnel_private.hr_incidents(id,organization_id)
);
CREATE TABLE personnel_private.hr_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, incident_id uuid NOT NULL, employee_id uuid NOT NULL,
 channel text NOT NULL CHECK(channel IN ('EMAIL','WHATSAPP','PWA','PDF')), destination text CHECK(length(destination)<=254),
 status text NOT NULL DEFAULT 'INITIATED' CHECK(status='INITIATED'), manager uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 revision integer NOT NULL, communication jsonb NOT NULL,
 acknowledged_at timestamptz, acknowledged_device uuid REFERENCES public.personnel_punch_devices(id),
 FOREIGN KEY(incident_id,organization_id) REFERENCES personnel_private.hr_incidents(id,organization_id),
 FOREIGN KEY(employee_id,organization_id) REFERENCES public.personnel_employees(id,organization_id)
);
CREATE TABLE personnel_private.hr_payroll (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, operational_unit_id uuid NOT NULL, employee_id uuid NOT NULL,
 period date NOT NULL CHECK(extract(day FROM period)=1), filename text NOT NULL CHECK(length(filename) BETWEEN 1 AND 180),
 storage_path text NOT NULL UNIQUE, status text NOT NULL DEFAULT 'UPLOADED' CHECK(status IN ('UPLOADED','PROCESSING','READY','NEEDS_REVIEW','ERROR')),
 fields jsonb NOT NULL DEFAULT '{}', revision integer NOT NULL DEFAULT 1, uploaded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(employee_id,organization_id) REFERENCES public.personnel_employees(id,organization_id),
 FOREIGN KEY(operational_unit_id,organization_id) REFERENCES public.eco_operational_units(id,organization_id), UNIQUE(organization_id,employee_id,period)
);
CREATE TABLE personnel_private.hr_leave (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, operational_unit_id uuid NOT NULL, employee_id uuid NOT NULL,
 type_id uuid NOT NULL, start_date date NOT NULL, end_date date NOT NULL CHECK(end_date>=start_date AND end_date<=start_date+366),
 note text CHECK(length(note)<=2000), manager_note text CHECK(length(manager_note)<=2000),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','CHANGE_PROPOSED','CANCELLED')),
 proposed_start date, proposed_end date, revision integer NOT NULL DEFAULT 1,
 created_by_device uuid REFERENCES public.personnel_punch_devices(id), managed_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(employee_id,organization_id) REFERENCES public.personnel_employees(id,organization_id),
 FOREIGN KEY(operational_unit_id,organization_id) REFERENCES public.eco_operational_units(id,organization_id),
 CHECK((proposed_start IS NULL AND proposed_end IS NULL) OR (proposed_end>=proposed_start AND proposed_end<=proposed_start+366))
);
CREATE TABLE personnel_private.hr_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, operational_unit_id uuid NOT NULL, entity_id uuid NOT NULL,
 event text NOT NULL, actor uuid, device_id uuid, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE personnel_private.hr_push_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, operational_unit_id uuid NOT NULL, employee_id uuid NOT NULL,
 leave_id uuid NOT NULL REFERENCES personnel_private.hr_leave(id), status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENT','FAILED','NOT_SUBSCRIBED')),
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['hr_catalog','hr_incidents','hr_entries','hr_deliveries','hr_payroll','hr_leave','hr_history','hr_push_events'] LOOP
 EXECUTE format('ALTER TABLE personnel_private.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON personnel_private.%I FROM PUBLIC,anon,authenticated',t);
 END LOOP;
END $$;
CREATE INDEX hr_incident_scope ON personnel_private.hr_incidents(organization_id,operational_unit_id,employee_id,incident_date);
CREATE INDEX hr_leave_scope ON personnel_private.hr_leave(organization_id,operational_unit_id,start_date,end_date);
CREATE TRIGGER hr_entries_immutable BEFORE UPDATE OR DELETE ON personnel_private.hr_entries FOR EACH ROW EXECUTE FUNCTION personnel_private.immutable();
CREATE TRIGGER hr_history_immutable BEFORE UPDATE OR DELETE ON personnel_private.hr_history FOR EACH ROW EXECUTE FUNCTION personnel_private.immutable();

CREATE FUNCTION personnel_private.hr_employee(org uuid,unit uuid,emp uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.personnel_employees e JOIN public.personnel_unit_assignments a ON a.employee_id=e.id AND a.organization_id=e.organization_id
 WHERE e.id=emp AND e.organization_id=org AND a.operational_unit_id=unit AND a.valid_from<=(now() AT TIME ZONE personnel_private.unit_zone(org,unit))::date AND (a.valid_to IS NULL OR a.valid_to>(now() AT TIME ZONE personnel_private.unit_zone(org,unit))::date))
$$;
CREATE FUNCTION personnel_private.hr_catalog_valid(org uuid,item uuid,k text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM personnel_private.hr_catalog WHERE id=item AND organization_id=org AND kind=k AND active)
$$;
CREATE FUNCTION public.personnel_hr_admin(p_org uuid,p_unit uuid,p_action text,p_body jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE eid uuid; rid uuid; old personnel_private.hr_incidents; pay personnel_private.hr_payroll; req personnel_private.hr_leave; result jsonb; c personnel_private.hr_catalog;
BEGIN
 IF p_unit IS NULL OR NOT public.personnel_admin_allowed(p_org,p_unit) THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
 IF p_action='snapshot' THEN
 RETURN jsonb_build_object(
 'catalog',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY label),'[]') FROM personnel_private.hr_catalog x WHERE organization_id=p_org),
 'incidents',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY incident_date DESC,created_at DESC),'[]') FROM personnel_private.hr_incidents x WHERE organization_id=p_org AND operational_unit_id=p_unit),
 'entries',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.entry_at,x.created_at),'[]') FROM personnel_private.hr_entries x JOIN personnel_private.hr_incidents i ON i.id=x.incident_id WHERE i.organization_id=p_org AND i.operational_unit_id=p_unit),
 'deliveries',(SELECT coalesce(jsonb_agg(to_jsonb(x)-'destination' ORDER BY x.created_at DESC),'[]') FROM personnel_private.hr_deliveries x JOIN personnel_private.hr_incidents i ON i.id=x.incident_id WHERE i.organization_id=p_org AND i.operational_unit_id=p_unit),
 'payroll',(SELECT coalesce(jsonb_agg(to_jsonb(x)-'storage_path' ORDER BY period DESC),'[]') FROM personnel_private.hr_payroll x WHERE organization_id=p_org AND operational_unit_id=p_unit),
 'leave',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY created_at DESC),'[]') FROM personnel_private.hr_leave x WHERE organization_id=p_org AND operational_unit_id=p_unit),
 'history',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY created_at),'[]') FROM personnel_private.hr_history x WHERE organization_id=p_org AND operational_unit_id=p_unit));
 END IF;
 IF p_action='catalog.save' THEN
  rid:=nullif(p_body->>'id','')::uuid;
  IF rid IS NULL THEN
   INSERT INTO personnel_private.hr_catalog(organization_id,kind,label,created_by) VALUES(p_org,p_body->>'kind',btrim(p_body->>'label'),auth.uid()) RETURNING id INTO rid;
  ELSE
   SELECT * INTO c FROM personnel_private.hr_catalog WHERE id=rid AND organization_id=p_org FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
   UPDATE personnel_private.hr_catalog SET label=btrim(p_body->>'label'),active=coalesce((p_body->>'active')::boolean,true),updated_at=now() WHERE id=rid;
  END IF;
 ELSIF p_action='incident.save' THEN
  eid:=(p_body->>'employeeId')::uuid;rid:=nullif(p_body->>'id','')::uuid;
  IF NOT personnel_private.hr_employee(p_org,p_unit,eid) THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  IF rid IS NOT NULL THEN
   SELECT * INTO old FROM personnel_private.hr_incidents WHERE id=rid AND organization_id=p_org AND operational_unit_id=p_unit FOR UPDATE;
   IF NOT FOUND OR old.employee_id<>eid THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
   IF old.revision IS DISTINCT FROM (p_body->>'revision')::int THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;
  END IF;
  IF NOT personnel_private.hr_catalog_valid(p_org,(p_body->>'typeId')::uuid,'incident_type') OR NOT personnel_private.hr_catalog_valid(p_org,(p_body->>'severityId')::uuid,'severity') THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  IF rid IS NULL THEN
   INSERT INTO personnel_private.hr_incidents(organization_id,operational_unit_id,employee_id,type_id,severity_id,incident_date,description,objective,created_by)
   VALUES(p_org,p_unit,eid,(p_body->>'typeId')::uuid,(p_body->>'severityId')::uuid,(p_body->>'date')::date,p_body->>'description',p_body->>'objective',auth.uid()) RETURNING id INTO rid;
  ELSE
   INSERT INTO personnel_private.hr_history(organization_id,operational_unit_id,entity_id,event,actor,detail) VALUES(p_org,p_unit,rid,'incident.before_edit',auth.uid(),to_jsonb(old));
   UPDATE personnel_private.hr_incidents SET type_id=(p_body->>'typeId')::uuid,severity_id=(p_body->>'severityId')::uuid,incident_date=(p_body->>'date')::date,description=p_body->>'description',objective=p_body->>'objective',status=p_body->>'status',revision=revision+1,updated_at=now() WHERE id=rid;
  END IF;
 ELSIF p_action IN ('incident.entry','incident.share','incident.document') THEN
  SELECT * INTO old FROM personnel_private.hr_incidents WHERE id=(p_body->>'id')::uuid AND organization_id=p_org AND operational_unit_id=p_unit FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF; rid:=old.id;
  IF p_action='incident.entry' THEN
   IF (p_body->>'entryAt')::timestamptz>now()+interval '1 minute' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
   INSERT INTO personnel_private.hr_entries(organization_id,incident_id,entry_at,text,author) VALUES(p_org,rid,(p_body->>'entryAt')::timestamptz,p_body->>'text',auth.uid());
   UPDATE personnel_private.hr_incidents SET status=CASE WHEN status='OPEN' THEN 'FOLLOW_UP' ELSE status END,revision=revision+1,updated_at=now() WHERE id=rid;
  ELSE
   SELECT jsonb_build_object('date',old.incident_date,'description',old.description,'objective',old.objective,'status',old.status,
    'type',(SELECT label FROM personnel_private.hr_catalog WHERE id=old.type_id),'severity',(SELECT label FROM personnel_private.hr_catalog WHERE id=old.severity_id)) INTO result;
   IF p_action='incident.share' THEN
    INSERT INTO personnel_private.hr_deliveries(organization_id,incident_id,employee_id,channel,destination,manager,revision,communication)
    SELECT p_org,rid,old.employee_id,p_body->>'channel',CASE p_body->>'channel' WHEN 'EMAIL' THEN e.email WHEN 'WHATSAPP' THEN e.phone END,auth.uid(),old.revision,result FROM public.personnel_employees e WHERE e.id=old.employee_id;
   ELSE
    RETURN result || jsonb_build_object('employee',(SELECT first_name||' '||last_name FROM public.personnel_employees WHERE id=old.employee_id),'organization',(SELECT name FROM public.eco_organizations WHERE id=p_org),'unit',(SELECT name FROM public.eco_operational_units WHERE id=p_unit),'author',(SELECT coalesce(nullif(display_name,''),'Responsable de Personal') FROM public.eco_user_profiles WHERE auth_user_id=old.created_by),'entries',(SELECT coalesce(jsonb_agg(jsonb_build_object('date',entry_at,'text',text,'author',(SELECT coalesce(nullif(display_name,''),'Responsable de Personal') FROM public.eco_user_profiles WHERE auth_user_id=author)) ORDER BY entry_at),'[]') FROM personnel_private.hr_entries WHERE incident_id=rid));
   END IF;
  END IF;
 ELSIF p_action='payroll.reserve' THEN
  eid:=(p_body->>'employeeId')::uuid;
  IF NOT personnel_private.hr_employee(p_org,p_unit,eid) THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  rid:=gen_random_uuid();
  INSERT INTO personnel_private.hr_payroll(id,organization_id,operational_unit_id,employee_id,period,filename,storage_path,uploaded_by)
  VALUES(rid,p_org,p_unit,eid,(p_body->>'period')::date,p_body->>'filename',p_org||'/'||p_unit||'/'||rid||'.pdf',auth.uid()) RETURNING * INTO pay;
  result:=jsonb_build_object('id',rid,'path',pay.storage_path);
 ELSIF p_action IN ('payroll.file','payroll.review','payroll.replace','payroll.failed','payroll.uploaded') THEN
  SELECT * INTO pay FROM personnel_private.hr_payroll WHERE id=(p_body->>'id')::uuid AND organization_id=p_org AND operational_unit_id=p_unit FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;rid:=pay.id;
  IF p_action='payroll.file' THEN
   IF p_body ? 'historyId' THEN
    SELECT detail INTO result FROM personnel_private.hr_history WHERE id=(p_body->>'historyId')::uuid AND entity_id=pay.id AND organization_id=p_org AND operational_unit_id=p_unit AND event='payroll.before_replace';
    IF result IS NULL THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
    RETURN jsonb_build_object('path',result->>'storage_path');
   END IF;
   RETURN jsonb_build_object('path',pay.storage_path);
  END IF;
  IF p_action='payroll.replace' THEN
   IF pay.revision IS DISTINCT FROM (p_body->>'revision')::int THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;
   IF p_body->>'path' !~ ('^'||p_org||'/'||p_unit||'/[a-f0-9-]{36}\.pdf$') THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
   INSERT INTO personnel_private.hr_history(organization_id,operational_unit_id,entity_id,event,actor,detail) VALUES(p_org,p_unit,rid,'payroll.before_replace',auth.uid(),to_jsonb(pay));
   UPDATE personnel_private.hr_payroll SET filename=p_body->>'filename',storage_path=p_body->>'path',fields='{}',status='NEEDS_REVIEW',revision=revision+1,uploaded_by=auth.uid(),updated_at=now() WHERE id=rid;
  ELSIF p_action='payroll.review' THEN
   IF pay.revision IS DISTINCT FROM (p_body->>'revision')::int THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;
   IF jsonb_typeof(p_body->'fields')<>'object' OR length((p_body->'fields')::text)>8000 OR p_body->>'status' NOT IN ('READY','NEEDS_REVIEW') THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
   INSERT INTO personnel_private.hr_history(organization_id,operational_unit_id,entity_id,event,actor,detail) VALUES(p_org,p_unit,rid,'payroll.before_review',auth.uid(),jsonb_build_object('fields',pay.fields,'revision',pay.revision));
   IF EXISTS(SELECT 1 FROM jsonb_each(p_body->'fields') f WHERE f.key NOT IN ('employee_name','employee_identifier','employment_start','payroll_period','base_salary','gross_pay','net_pay','employer_social_security','employee_social_security','tax_withholding','other_deductions','supplements','company_cost') OR jsonb_typeof(f.value)<>'object' OR length(f.value->>'value')>200) THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
   UPDATE personnel_private.hr_payroll SET fields=(SELECT coalesce(jsonb_object_agg(f.key,jsonb_build_object('value',f.value->>'value','status',CASE WHEN coalesce(f.value->>'value','')='' THEN 'MISSING' ELSE 'MANUAL_REVIEWED' END,'sourceDocument',pay.id)),'{}') FROM jsonb_each(p_body->'fields') f),status=p_body->>'status',revision=revision+1,updated_at=now() WHERE id=rid;
  ELSE UPDATE personnel_private.hr_payroll SET status=CASE p_action WHEN 'payroll.failed' THEN 'ERROR' ELSE 'NEEDS_REVIEW' END,updated_at=now() WHERE id=rid;END IF;
 ELSIF p_action='leave.decide' THEN
  SELECT * INTO req FROM personnel_private.hr_leave WHERE id=(p_body->>'id')::uuid AND organization_id=p_org AND operational_unit_id=p_unit FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;rid:=req.id;
  IF req.revision IS DISTINCT FROM (p_body->>'revision')::int THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;
  IF req.status NOT IN ('PENDING','CHANGE_PROPOSED') OR p_body->>'status' NOT IN ('APPROVED','REJECTED','CHANGE_PROPOSED') OR req.start_date < (now() AT TIME ZONE personnel_private.unit_zone(p_org,p_unit))::date THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  IF p_body->>'status'='CHANGE_PROPOSED' AND ((p_body->>'start')::date IS NULL OR (p_body->>'end')::date IS NULL OR (p_body->>'start')::date < (now() AT TIME ZONE personnel_private.unit_zone(p_org,p_unit))::date) THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  INSERT INTO personnel_private.hr_history(organization_id,operational_unit_id,entity_id,event,actor,detail) VALUES(p_org,p_unit,rid,'leave.before_decision',auth.uid(),to_jsonb(req));
  UPDATE personnel_private.hr_leave SET status=p_body->>'status',manager_note=p_body->>'note',managed_by=auth.uid(),proposed_start=CASE WHEN p_body->>'status'='CHANGE_PROPOSED' THEN (p_body->>'start')::date END,proposed_end=CASE WHEN p_body->>'status'='CHANGE_PROPOSED' THEN (p_body->>'end')::date END,revision=revision+1,updated_at=now() WHERE id=rid;
  INSERT INTO personnel_private.hr_push_events(organization_id,operational_unit_id,employee_id,leave_id) VALUES(p_org,p_unit,req.employee_id,rid);
 ELSE RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 INSERT INTO personnel_private.hr_history(organization_id,operational_unit_id,entity_id,event,actor) VALUES(p_org,p_unit,rid,p_action,auth.uid());
 INSERT INTO personnel_private.audit(organization_id,event,actor) VALUES(p_org,'hr.'||p_action,auth.uid());
 RETURN coalesce(result,jsonb_build_object('id',rid));
END $$;

CREATE FUNCTION public.personnel_hr_employee(p_token_hash text,p_body jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d public.personnel_punch_devices; a personnel_private.attempts; req personnel_private.hr_leave; delivery personnel_private.hr_deliveries; rid uuid; action text:=p_body->>'action'; today date;
BEGIN
 d:=personnel_private.device(p_token_hash);
 IF d.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.eco_organization_module_entitlements WHERE organization_id=d.organization_id AND module_key='personal' AND is_enabled) THEN RETURN jsonb_build_object('error','INVALID_DEVICE'); END IF;
 SELECT * INTO a FROM personnel_private.attempts WHERE id=(p_body->>'attemptId')::uuid AND device_id=d.id AND consumed_at IS NULL AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','PIN_REJECTED'); END IF;
 UPDATE personnel_private.attempts SET consumed_at=now() WHERE id=a.id;
 IF NOT coalesce((p_body->>'verified')::boolean,false) OR NOT EXISTS(SELECT 1 FROM personnel_private.pin_credentials c JOIN public.personnel_employees e ON e.id=c.employee_id WHERE c.employee_id=a.employee_id AND c.revision=a.credential_revision AND c.organization_id=d.organization_id AND e.employment_status='ACTIVE') OR NOT personnel_private.hr_employee(d.organization_id,d.operational_unit_id,a.employee_id) THEN RETURN jsonb_build_object('error','PIN_REJECTED'); END IF;
 today:=(now() AT TIME ZONE personnel_private.unit_zone(d.organization_id,d.operational_unit_id))::date;
 IF action='snapshot' THEN
  RETURN jsonb_build_object('types',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label)),'[]') FROM personnel_private.hr_catalog WHERE organization_id=d.organization_id AND kind='leave_type' AND active),
  'leave',(SELECT coalesce(jsonb_agg(to_jsonb(x)-'manager_note'-'managed_by'-'created_by_device'-'organization_id'-'employee_id' ORDER BY created_at DESC),'[]') FROM personnel_private.hr_leave x WHERE organization_id=d.organization_id AND employee_id=a.employee_id AND operational_unit_id=d.operational_unit_id),
  'communications',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'communication',communication,'acknowledged_at',acknowledged_at,'sent_at',created_at) ORDER BY created_at DESC),'[]') FROM personnel_private.hr_deliveries WHERE organization_id=d.organization_id AND employee_id=a.employee_id));
 ELSIF action='leave.create' THEN
  IF NOT personnel_private.hr_catalog_valid(d.organization_id,(p_body->>'typeId')::uuid,'leave_type') OR (p_body->>'start')::date < today THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  INSERT INTO personnel_private.hr_leave(organization_id,operational_unit_id,employee_id,type_id,start_date,end_date,note,created_by_device)
  VALUES(d.organization_id,d.operational_unit_id,a.employee_id,(p_body->>'typeId')::uuid,(p_body->>'start')::date,(p_body->>'end')::date,p_body->>'note',d.id) RETURNING id INTO rid;
 ELSIF action IN ('leave.accept','leave.decline','leave.cancel') THEN
  SELECT * INTO req FROM personnel_private.hr_leave WHERE id=(p_body->>'id')::uuid AND organization_id=d.organization_id AND operational_unit_id=d.operational_unit_id AND employee_id=a.employee_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;rid:=req.id;
  IF req.revision IS DISTINCT FROM (p_body->>'revision')::int THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;
  IF req.start_date<today OR (action IN ('leave.accept','leave.decline') AND (req.status<>'CHANGE_PROPOSED' OR req.proposed_start<today)) OR (action='leave.cancel' AND req.status NOT IN ('PENDING','CHANGE_PROPOSED')) THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  INSERT INTO personnel_private.hr_history(organization_id,operational_unit_id,entity_id,event,device_id,detail) VALUES(d.organization_id,d.operational_unit_id,rid,'leave.before_response',d.id,to_jsonb(req));
  UPDATE personnel_private.hr_leave SET status=CASE action WHEN 'leave.accept' THEN 'APPROVED' WHEN 'leave.decline' THEN 'PENDING' ELSE 'CANCELLED' END,start_date=CASE action WHEN 'leave.accept' THEN proposed_start ELSE start_date END,end_date=CASE action WHEN 'leave.accept' THEN proposed_end ELSE end_date END,proposed_start=NULL,proposed_end=NULL,revision=revision+1,updated_at=now() WHERE id=rid;
 ELSIF action='incident.ack' THEN
  SELECT * INTO delivery FROM personnel_private.hr_deliveries WHERE id=(p_body->>'id')::uuid AND organization_id=d.organization_id AND employee_id=a.employee_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;rid:=delivery.incident_id;
  UPDATE personnel_private.hr_deliveries SET acknowledged_at=coalesce(acknowledged_at,now()),acknowledged_device=coalesce(acknowledged_device,d.id) WHERE id=delivery.id;
 ELSE RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 INSERT INTO personnel_private.hr_history(organization_id,operational_unit_id,entity_id,event,device_id) VALUES(d.organization_id,d.operational_unit_id,rid,action,d.id);
 INSERT INTO personnel_private.audit(organization_id,device_id,event) VALUES(d.organization_id,d.id,'hr.'||action);
 RETURN jsonb_build_object('ok',true);
END $$;
-- Explicit read-only integration: approved leave overlays interpretation; never rewrites schedules/punches.
CREATE FUNCTION public.personnel_hr_leave_context(p_org uuid,p_unit uuid,p_from date,p_to date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT public.personnel_admin_allowed(p_org,p_unit) OR p_unit IS NULL OR p_to<p_from OR p_to>p_from+93 THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('employeeId',employee_id,'start',start_date,'end',end_date,'status','APPROVED')),'[]') FROM personnel_private.hr_leave WHERE organization_id=p_org AND operational_unit_id=p_unit AND status='APPROVED' AND start_date<=p_to AND end_date>=p_from);
END $$;
REVOKE ALL ON FUNCTION public.personnel_hr_admin(uuid,uuid,text,jsonb),public.personnel_hr_employee(text,jsonb),public.personnel_hr_leave_context(uuid,uuid,date,date),personnel_private.hr_employee(uuid,uuid,uuid),personnel_private.hr_catalog_valid(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.personnel_hr_admin(uuid,uuid,text,jsonb),public.personnel_hr_leave_context(uuid,uuid,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.personnel_hr_employee(text,jsonb) TO service_role;
COMMIT;
