-- Synthetic records only; caller MUST execute in a transaction followed by ROLLBACK.
DO $test$
DECLARE org uuid:=gen_random_uuid(); unit uuid:=gen_random_uuid(); actor uuid:=gen_random_uuid(); emp uuid; typ uuid; sev uuid; leave_type uuid;
 dev uuid:=gen_random_uuid(); incident uuid; request uuid; payroll uuid; snapshot jsonb; attempt uuid; credential uuid:=gen_random_uuid(); reply jsonb; communication uuid;
BEGIN
 INSERT INTO auth.users(id) VALUES(actor);
 INSERT INTO public.eco_user_profiles(id,auth_user_id,display_name) VALUES(actor,actor,'Synthetic HR manager');
 INSERT INTO public.eco_organizations(id,code,name) VALUES(org,'HR_TX_'||substr(org::text,1,8),'Synthetic HR rollback');
 INSERT INTO public.eco_operational_units(id,organization_id,code,name,unit_type) VALUES(unit,org,'TEST','Synthetic unit','LOCAL');
 INSERT INTO public.eco_organization_module_entitlements(organization_id,module_key,is_enabled) VALUES(org,'personal',true);
 INSERT INTO public.eco_organization_members(organization_id,user_id,role_template_id,is_organization_wide) SELECT org,actor,id,true FROM public.eco_role_templates WHERE code='OWNER';
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 emp:=(public.personnel_admin_command(org,unit,'employee.save',jsonb_build_object('firstName','Synthetic','lastName','Worker','position','Test','startDate','2026-01-01','unitIds',jsonb_build_array(unit)))->>'id')::uuid;
 typ:=(public.personnel_hr_admin(org,unit,'catalog.save','{"kind":"incident_type","label":"Synthetic type"}')->>'id')::uuid;
 sev:=(public.personnel_hr_admin(org,unit,'catalog.save','{"kind":"severity","label":"Synthetic severity"}')->>'id')::uuid;
 leave_type:=(public.personnel_hr_admin(org,unit,'catalog.save','{"kind":"leave_type","label":"Synthetic leave"}')->>'id')::uuid;
 incident:=(public.personnel_hr_admin(org,unit,'incident.save',jsonb_build_object('employeeId',emp,'date',current_date,'typeId',typ,'severityId',sev,'description','Synthetic private communication','objective','Synthetic objective'))->>'id')::uuid;
 PERFORM public.personnel_hr_admin(org,unit,'incident.entry',jsonb_build_object('id',incident,'entryAt',now(),'text','Synthetic manager follow-up'));
 PERFORM public.personnel_hr_admin(org,unit,'incident.share',jsonb_build_object('id',incident,'channel','PWA'));
 payroll:=(public.personnel_hr_admin(org,unit,'payroll.reserve',jsonb_build_object('employeeId',emp,'period','2040-01-01','filename','synthetic.pdf'))->>'id')::uuid;
 PERFORM public.personnel_hr_admin(org,unit,'payroll.review',jsonb_build_object('id',payroll,'revision',1,'status','READY','fields',jsonb_build_object('net_pay',jsonb_build_object('value','1200'))));
 INSERT INTO public.personnel_punch_devices(id,organization_id,operational_unit_id,label) VALUES(dev,org,unit,'Synthetic HR rollback');
 INSERT INTO personnel_private.device_credentials(device_id,token_hash) VALUES(dev,repeat('a',64));
 INSERT INTO personnel_private.pin_credentials(employee_id,organization_id,lookup_hash,password_hash,revision) VALUES(emp,org,repeat('b',64),'scrypt:32768:8:1:'||repeat('0',32)||':'||repeat('0',64),credential);
 attempt:=gen_random_uuid();INSERT INTO personnel_private.attempts(id,device_id,employee_id,credential_revision,request_id,expires_at) VALUES(attempt,dev,emp,credential,gen_random_uuid(),now()+interval '30 seconds');
 PERFORM public.personnel_hr_employee(repeat('a',64),jsonb_build_object('action','leave.create','attemptId',attempt,'verified',true,'typeId',leave_type,'start','2040-01-10','end','2040-01-12'));
 snapshot:=public.personnel_hr_admin(org,unit,'snapshot');request:=(snapshot->'leave'->0->>'id')::uuid;communication:=(snapshot->'deliveries'->0->>'id')::uuid;
 IF jsonb_array_length(snapshot->'incidents')<>1 OR jsonb_array_length(snapshot->'entries')<>1 OR snapshot->'payroll'->0->>'status'<>'READY' THEN RAISE EXCEPTION 'HR acceptance snapshot mismatch'; END IF;
 PERFORM public.personnel_hr_admin(org,unit,'leave.decide',jsonb_build_object('id',request,'revision',1,'status','CHANGE_PROPOSED','start','2040-01-15','end','2040-01-16','note','Private manager note'));
 attempt:=gen_random_uuid();INSERT INTO personnel_private.attempts(id,device_id,employee_id,credential_revision,request_id,expires_at) VALUES(attempt,dev,emp,credential,gen_random_uuid(),now()+interval '30 seconds');
 PERFORM public.personnel_hr_employee(repeat('a',64),jsonb_build_object('action','leave.accept','attemptId',attempt,'verified',true,'id',request,'revision',2));
 attempt:=gen_random_uuid();INSERT INTO personnel_private.attempts(id,device_id,employee_id,credential_revision,request_id,expires_at) VALUES(attempt,dev,emp,credential,gen_random_uuid(),now()+interval '30 seconds');
 PERFORM public.personnel_hr_employee(repeat('a',64),jsonb_build_object('action','incident.ack','attemptId',attempt,'verified',true,'id',communication));
 attempt:=gen_random_uuid();INSERT INTO personnel_private.attempts(id,device_id,employee_id,credential_revision,request_id,expires_at) VALUES(attempt,dev,emp,credential,gen_random_uuid(),now()+interval '30 seconds');
 reply:=public.personnel_hr_employee(repeat('a',64),jsonb_build_object('action','snapshot','attemptId',attempt,'verified',true));
 IF reply->'leave'->0->>'status'<>'APPROVED' OR reply::text LIKE '%Private manager note%' OR reply::text LIKE '%Synthetic manager follow-up%' OR reply->'communications'->0->>'acknowledged_at' IS NULL THEN RAISE EXCEPTION 'HR employee privacy/workflow mismatch'; END IF;
 IF jsonb_array_length(public.personnel_hr_leave_context(org,unit,'2040-01-01','2040-01-31'))<>1 THEN RAISE EXCEPTION 'Approved leave overlay missing'; END IF;
END $test$;
