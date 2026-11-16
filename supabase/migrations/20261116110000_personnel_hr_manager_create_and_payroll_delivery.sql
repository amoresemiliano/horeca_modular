-- Authorized DEV refinement: extend exactly two actions on the existing admin RPC.
-- No tables, grants, policies or unrelated action bodies change.
BEGIN;
DO $migration$
DECLARE definition text; anchor text:=' ELSIF p_action=''leave.decide'' THEN'; addition text;
BEGIN
 SELECT pg_get_functiondef('public.personnel_hr_admin(uuid,uuid,text,jsonb)'::regprocedure) INTO definition;
 IF position(anchor IN definition)=0 OR position('payroll.delivery.initiate' IN definition)>0 THEN
  RAISE EXCEPTION 'HR_ADMIN_CONTRACT_MISMATCH';
 END IF;
 addition:=$actions$
 ELSIF p_action='leave.create' THEN
  eid:=(p_body->>'employeeId')::uuid;
  IF NOT personnel_private.hr_employee(p_org,p_unit,eid)
   OR NOT EXISTS(SELECT 1 FROM public.personnel_employees WHERE id=eid AND organization_id=p_org AND employment_status='ACTIVE')
  THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  IF NOT personnel_private.hr_catalog_valid(p_org,(p_body->>'typeId')::uuid,'leave_type')
   OR (p_body->>'start')::date IS NULL OR (p_body->>'end')::date IS NULL
   OR (p_body->>'start')::date<(now() AT TIME ZONE personnel_private.unit_zone(p_org,p_unit))::date
   OR coalesce(p_body->>'status','PENDING') NOT IN ('PENDING','APPROVED','REJECTED')
  THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  INSERT INTO personnel_private.hr_leave(organization_id,operational_unit_id,employee_id,type_id,start_date,end_date,note,managed_by)
  VALUES(p_org,p_unit,eid,(p_body->>'typeId')::uuid,(p_body->>'start')::date,(p_body->>'end')::date,p_body->>'note',auth.uid()) RETURNING id INTO rid;
  INSERT INTO personnel_private.hr_history(organization_id,operational_unit_id,entity_id,event,actor,detail)
  VALUES(p_org,p_unit,rid,'leave.create',auth.uid(),jsonb_build_object('origin','MANAGER','initialStatus',coalesce(p_body->>'status','PENDING')));
  INSERT INTO personnel_private.audit(organization_id,event,actor) VALUES(p_org,'hr.leave.create',auth.uid());
  IF coalesce(p_body->>'status','PENDING')<>'PENDING' THEN
   PERFORM public.personnel_hr_admin(p_org,p_unit,'leave.decide',jsonb_build_object('id',rid,'revision',1,'status',p_body->>'status','note',p_body->>'managerNote'));
  END IF;
  RETURN jsonb_build_object('id',rid);
 ELSIF p_action='payroll.delivery.initiate' THEN
  SELECT * INTO pay FROM personnel_private.hr_payroll WHERE id=(p_body->>'id')::uuid AND organization_id=p_org AND operational_unit_id=p_unit FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  IF p_body->>'channel' IS NULL OR p_body->>'channel' NOT IN ('NATIVE_SHARE','EMAIL','WHATSAPP') THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  INSERT INTO personnel_private.hr_history(organization_id,operational_unit_id,entity_id,event,actor,detail)
  VALUES(p_org,p_unit,pay.id,'payroll.delivery.initiate',auth.uid(),jsonb_build_object('channel',p_body->>'channel','status','INITIATED',
   'destination',CASE p_body->>'channel' WHEN 'EMAIL' THEN (SELECT email FROM public.personnel_employees WHERE id=pay.employee_id AND organization_id=p_org)
    WHEN 'WHATSAPP' THEN (SELECT phone FROM public.personnel_employees WHERE id=pay.employee_id AND organization_id=p_org) END,
   'payrollRevision',pay.revision,'transport','EXTERNAL_SHARE'));
  INSERT INTO personnel_private.audit(organization_id,event,actor) VALUES(p_org,'hr.payroll.delivery.initiate',auth.uid());
  RETURN jsonb_build_object('id',pay.id,'status','INITIATED');
$actions$;
 -- CREATE OR REPLACE retains the existing function OID and ACL.
 EXECUTE replace(definition,anchor,addition||anchor);
END $migration$;
COMMIT;
