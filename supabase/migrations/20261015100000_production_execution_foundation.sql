-- WP-PROD-001: forward-only Production ownership. DO NOT APPLY HOSTED in module WP.
-- Requires current Core; CCR-PROD-001 and owner adapters are Master handoffs.
BEGIN;

CREATE TABLE public.eco_production_batches (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, operational_unit_id uuid NOT NULL,
 effective_date date NOT NULL, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 actor_profile_id uuid NOT NULL REFERENCES public.eco_user_profiles(id),
 status text NOT NULL CHECK(status IN ('DRAFT','CONFIRMED','CORRECTED','REVERSED','CANCELLED')),
 revision integer NOT NULL CHECK(revision>0), draft jsonb NOT NULL,
 current_execution_id uuid, shift text, notes text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(operational_unit_id,organization_id) REFERENCES public.eco_operational_units(id,organization_id),
 UNIQUE(id,organization_id,operational_unit_id)
);
CREATE TABLE public.eco_production_policies (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, operational_unit_id uuid NOT NULL,
 product_id uuid NOT NULL, stock_scope jsonb NOT NULL, minimum numeric(20,6) NOT NULL CHECK(minimum>=0),
 maximum numeric(20,6) NOT NULL CHECK(maximum>=minimum), unit text NOT NULL CHECK(unit IN ('kg','g','L','ml','unit')),
 revision integer NOT NULL CHECK(revision>0), actor_profile_id uuid NOT NULL REFERENCES public.eco_user_profiles(id),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(operational_unit_id,organization_id) REFERENCES public.eco_operational_units(id,organization_id),
 UNIQUE(organization_id,operational_unit_id,product_id,stock_scope)
);
CREATE TABLE public.eco_production_commands (
 request_id uuid NOT NULL, organization_id uuid NOT NULL, operational_unit_id uuid NOT NULL,
 actor_profile_id uuid NOT NULL REFERENCES public.eco_user_profiles(id), payload_hash text NOT NULL,
 result jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,operational_unit_id,request_id),
 FOREIGN KEY(operational_unit_id,organization_id) REFERENCES public.eco_operational_units(id,organization_id)
);
CREATE TABLE public.eco_production_executions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), batch_id uuid NOT NULL, organization_id uuid NOT NULL, operational_unit_id uuid NOT NULL,
 batch_revision integer NOT NULL, action text NOT NULL CHECK(action IN ('CONFIRM','CORRECT','REVERSE')),
 snapshot jsonb NOT NULL, supersedes_execution_id uuid, reason text,
 actor_profile_id uuid NOT NULL REFERENCES public.eco_user_profiles(id), recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(batch_id,organization_id,operational_unit_id) REFERENCES public.eco_production_batches(id,organization_id,operational_unit_id),
 UNIQUE(id,organization_id,operational_unit_id), UNIQUE(batch_id,batch_revision),
 FOREIGN KEY(supersedes_execution_id,organization_id,operational_unit_id) REFERENCES public.eco_production_executions(id,organization_id,operational_unit_id)
);
ALTER TABLE public.eco_production_batches ADD CONSTRAINT production_current_execution_fk
 FOREIGN KEY(current_execution_id,organization_id,operational_unit_id) REFERENCES public.eco_production_executions(id,organization_id,operational_unit_id);
CREATE TABLE public.eco_production_outputs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), execution_id uuid NOT NULL, organization_id uuid NOT NULL, operational_unit_id uuid NOT NULL,
 line_id uuid NOT NULL, product_id uuid NOT NULL, mode text NOT NULL CHECK(mode IN ('PACKAGED','LOOSE')),
 package_id uuid, package_version uuid, unit_count integer CHECK(unit_count>0), normalized_quantity numeric(20,6) NOT NULL CHECK(normalized_quantity>0),
 unit text NOT NULL CHECK(unit IN ('kg','g','L','ml','unit')), conversion_snapshot jsonb NOT NULL, destination_location_id uuid NOT NULL,
 FOREIGN KEY(execution_id,organization_id,operational_unit_id) REFERENCES public.eco_production_executions(id,organization_id,operational_unit_id),
 UNIQUE(execution_id,line_id),
 CHECK((mode='PACKAGED' AND package_id IS NOT NULL AND package_version IS NOT NULL AND unit_count IS NOT NULL)
 OR (mode='LOOSE' AND package_id IS NULL AND package_version IS NULL AND unit_count IS NULL))
);
CREATE TABLE public.eco_production_consumptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), execution_id uuid NOT NULL, organization_id uuid NOT NULL, operational_unit_id uuid NOT NULL,
 line_id uuid NOT NULL, product_id uuid NOT NULL, quantity numeric(20,6) NOT NULL CHECK(quantity>0), unit text NOT NULL CHECK(unit IN ('kg','g','L','ml','unit')),
 source_location_id uuid NOT NULL,
 FOREIGN KEY(execution_id,organization_id,operational_unit_id) REFERENCES public.eco_production_executions(id,organization_id,operational_unit_id), UNIQUE(execution_id,line_id)
);
CREATE TABLE public.eco_production_wastes (
 id uuid PRIMARY KEY, batch_id uuid NOT NULL, execution_id uuid NOT NULL, organization_id uuid NOT NULL, operational_unit_id uuid NOT NULL,
 product_id uuid NOT NULL, quantity numeric(20,6) NOT NULL CHECK(quantity>0), unit text NOT NULL CHECK(unit IN ('kg','g','L','ml','unit')),
 classification text NOT NULL CHECK(classification IN ('PROCESS_ALREADY_CONSUMED','STOCK_REMOVAL','OUTPUT_LOSS')),
 reason text NOT NULL CHECK(length(btrim(reason))>0), related_line_id uuid, location_id uuid,
 actor_profile_id uuid NOT NULL REFERENCES public.eco_user_profiles(id), recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(batch_id,organization_id,operational_unit_id) REFERENCES public.eco_production_batches(id,organization_id,operational_unit_id),
 FOREIGN KEY(execution_id,organization_id,operational_unit_id) REFERENCES public.eco_production_executions(id,organization_id,operational_unit_id),
 UNIQUE(id,organization_id,operational_unit_id)
);
CREATE TABLE public.eco_production_waste_confirmations (
 waste_id uuid PRIMARY KEY, organization_id uuid NOT NULL, operational_unit_id uuid NOT NULL,
 actor_profile_id uuid NOT NULL REFERENCES public.eco_user_profiles(id), recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(waste_id,organization_id,operational_unit_id) REFERENCES public.eco_production_wastes(id,organization_id,operational_unit_id)
);
CREATE TABLE public.eco_production_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, operational_unit_id uuid NOT NULL,
 entity_id uuid NOT NULL, command_id uuid NOT NULL, action text NOT NULL, before_fact jsonb, after_fact jsonb NOT NULL,
 actor_profile_id uuid NOT NULL REFERENCES public.eco_user_profiles(id), occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(organization_id,operational_unit_id,command_id) REFERENCES public.eco_production_commands(organization_id,operational_unit_id,request_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE public.eco_production_outbox (
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1),
 event_type text NOT NULL CHECK(event_type IN ('OUTPUT_CONFIRMED','CONSUMPTION_DECLARED','STOCK_WASTE_CONFIRMED','EXECUTION_COMPENSATION_REQUIRED')),
 organization_id uuid NOT NULL, operational_unit_id uuid NOT NULL, batch_id uuid NOT NULL, execution_id uuid NOT NULL,
 batch_revision integer NOT NULL, line_id uuid, command_id uuid NOT NULL, effective_date date NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(), actor_profile_id uuid NOT NULL REFERENCES public.eco_user_profiles(id),
 correlation_id uuid NOT NULL, payload jsonb NOT NULL, supersedes_event_id uuid REFERENCES public.eco_production_outbox(event_id),
 delivery_state text NOT NULL DEFAULT 'PENDING' CHECK(delivery_state='PENDING'),
 FOREIGN KEY(batch_id,organization_id,operational_unit_id) REFERENCES public.eco_production_batches(id,organization_id,operational_unit_id),
 FOREIGN KEY(execution_id,organization_id,operational_unit_id) REFERENCES public.eco_production_executions(id,organization_id,operational_unit_id),
 FOREIGN KEY(organization_id,operational_unit_id,command_id) REFERENCES public.eco_production_commands(organization_id,operational_unit_id,request_id) DEFERRABLE INITIALLY DEFERRED,
 UNIQUE NULLS NOT DISTINCT(organization_id,operational_unit_id,command_id,event_type,line_id)
);
CREATE INDEX production_batches_scope_date ON public.eco_production_batches(organization_id,operational_unit_id,effective_date DESC,id);
CREATE INDEX production_outbox_pending ON public.eco_production_outbox(organization_id,operational_unit_id,occurred_at);

-- No Product, Packaging, Recipe or Stock master is created here. The approved
-- owner must replace this scoped resolver before enabling execution in a tenant.
CREATE FUNCTION public.production_owner_reference(org uuid, opunit uuid, kind text, reference_id uuid, reference_version uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='OWNER_CONTRACT_UNAVAILABLE'; END $$;

CREATE FUNCTION public.production_require_reference(org uuid, opunit uuid, kind text, ref uuid, ver uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$
DECLARE r jsonb;
BEGIN
 IF ref IS NULL THEN RAISE EXCEPTION 'REFERENCE_REQUIRED'; END IF;
 r := public.production_owner_reference(org,opunit,kind,ref,ver);
 IF r IS NULL OR r->>'approved' IS DISTINCT FROM 'true' OR (r->>'id')::uuid IS DISTINCT FROM ref
 OR (r->>'organization_id')::uuid IS DISTINCT FROM org OR r->>'kind' IS DISTINCT FROM kind
 OR (r ? 'operational_unit_id' AND (r->>'operational_unit_id')::uuid IS DISTINCT FROM opunit)
 OR (ver IS NOT NULL AND (r->>'version')::uuid IS DISTINCT FROM ver) THEN
  RAISE EXCEPTION 'REFERENCE_DENIED';
 END IF;
 RETURN r;
END $$;
CREATE FUNCTION public.production_decimal(value text) RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
BEGIN
 IF value IS NULL OR value !~ '^-?[0-9]{1,14}(\.[0-9]{1,6})?$' THEN RAISE EXCEPTION 'INVALID_DECIMAL'; END IF;
 RETURN value::numeric(20,6);
END $$;
CREATE FUNCTION public.production_normalize_execution(org uuid, opunit uuid, doc jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$
DECLARE line jsonb; product jsonb; package jsonb; recipe jsonb; outputs jsonb:='[]'; inputs jsonb:='[]';
 qty numeric; cnt integer; unit text; ids uuid[]:='{}'; lineid uuid; snapshot jsonb; normalized jsonb;
BEGIN
 IF doc->>'mode' IS NULL OR doc->>'mode' NOT IN ('MANUAL_OUTPUT','RECIPE_REFERENCE')
 OR doc->>'effective_date' IS NULL OR doc->>'effective_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 OR jsonb_typeof(doc->'outputs') IS DISTINCT FROM 'array' OR jsonb_array_length(doc->'outputs') NOT BETWEEN 1 AND 200
 OR jsonb_typeof(doc->'consumptions') IS DISTINCT FROM 'array' OR jsonb_array_length(doc->'consumptions')>200 THEN
  RAISE EXCEPTION 'INVALID_EXECUTION';
 END IF;
 PERFORM (doc->>'effective_date')::date;
 IF doc->>'mode'='RECIPE_REFERENCE' THEN
  recipe:=public.production_require_reference(org,opunit,'RECIPE',(doc->>'recipe_id')::uuid,(doc->>'recipe_version')::uuid);
  IF doc->>'recipe_version' IS NULL THEN RAISE EXCEPTION 'RECIPE_VERSION_REQUIRED'; END IF;
 ELSIF doc ? 'recipe_id' OR doc ? 'recipe_version' THEN RAISE EXCEPTION 'MANUAL_MODE_HAS_NO_RECIPE'; END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(doc->'outputs') LOOP
  lineid:=(line->>'line_id')::uuid;
  IF lineid IS NULL OR lineid=ANY(ids) THEN RAISE EXCEPTION 'DUPLICATE_OR_MISSING_LINE'; END IF; ids:=array_append(ids,lineid);
  product:=public.production_require_reference(org,opunit,'PRODUCT',(line->>'product_id')::uuid);
  PERFORM public.production_require_reference(org,opunit,'LOCATION',(line->>'destination_location_id')::uuid);
  unit:=product->>'base_unit'; cnt:=NULL; package:=NULL;
  IF unit IS NULL OR unit NOT IN ('kg','g','L','ml','unit') THEN RAISE EXCEPTION 'INVALID_UNIT'; END IF;
  IF line->>'mode'='PACKAGED' THEN
   IF line->>'count' IS NULL OR line->>'count' !~ '^[1-9][0-9]{0,9}$' OR (line->>'count')::numeric>2147483647 OR line->>'package_version' IS NULL THEN RAISE EXCEPTION 'INVALID_PACKAGE_COUNT_OR_VERSION'; END IF;
   cnt:=(line->>'count')::integer;
   package:=public.production_require_reference(org,opunit,'PACKAGE',(line->>'package_id')::uuid,(line->>'package_version')::uuid);
   IF (package->>'product_id')::uuid IS DISTINCT FROM (line->>'product_id')::uuid OR package->>'unit' IS DISTINCT FROM unit THEN RAISE EXCEPTION 'CONVERSION_DIMENSION_MISMATCH'; END IF;
   qty:=public.production_decimal(package->>'net_quantity');
   IF qty<=0 THEN RAISE EXCEPTION 'UNKNOWN_OR_INVALID_CONVERSION'; END IF;
   snapshot:=package; qty:=public.production_decimal((qty*cnt)::text);
  ELSIF line->>'mode'='LOOSE' THEN
   IF line->>'unit' IS DISTINCT FROM unit OR product->>'loose_allowed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'LOOSE_QUANTITY_DENIED'; END IF;
   qty:=public.production_decimal(line->>'quantity'); snapshot:=jsonb_build_object('unit',unit,'mode','LOOSE');
  ELSE RAISE EXCEPTION 'OUTPUT_MODE_REQUIRED'; END IF;
  IF qty<=0 THEN RAISE EXCEPTION 'INVALID_OUTPUT_QUANTITY'; END IF;
  normalized:=jsonb_build_object('line_id',lineid,'product_id',line->>'product_id','mode',line->>'mode',
   'package_id',package->>'id','package_version',package->>'version','unit_count',cnt,
   'quantity',qty::text,'unit',unit,'conversion_snapshot',snapshot,'destination_location_id',line->>'destination_location_id');
  outputs:=outputs||jsonb_build_array(normalized);
 END LOOP;
 FOR line IN SELECT value FROM jsonb_array_elements(doc->'consumptions') LOOP
  lineid:=(line->>'line_id')::uuid;
  IF lineid IS NULL OR lineid=ANY(ids) THEN RAISE EXCEPTION 'DUPLICATE_OR_MISSING_LINE'; END IF; ids:=array_append(ids,lineid);
  product:=public.production_require_reference(org,opunit,'PRODUCT',(line->>'product_id')::uuid);
  PERFORM public.production_require_reference(org,opunit,'LOCATION',(line->>'source_location_id')::uuid);
  qty:=public.production_decimal(line->>'quantity'); unit:=line->>'unit';
  IF qty<=0 OR unit IS NULL OR unit IS DISTINCT FROM product->>'base_unit' THEN RAISE EXCEPTION 'INVALID_ACTUAL_CONSUMPTION'; END IF;
  inputs:=inputs||jsonb_build_array(jsonb_build_object('line_id',lineid,'product_id',line->>'product_id','quantity',qty::text,'unit',unit,'source_location_id',line->>'source_location_id'));
 END LOOP;
 RETURN jsonb_build_object('mode',doc->>'mode','effective_date',doc->>'effective_date','shift',doc->>'shift','notes',doc->>'notes',
  'recipe_snapshot',recipe,'outputs',outputs,'consumptions',inputs,'ingredient_traceability',CASE WHEN doc->>'mode'='MANUAL_OUTPUT' THEN 'NOT_IMPLIED' ELSE 'DECLARED_ACTUALS_ONLY' END);
END $$;

CREATE FUNCTION public.production_execute_command(request jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE org uuid:=(request->>'organization_id')::uuid; opunit uuid:=(request->>'operational_unit_id')::uuid;
 commandid uuid:=(request->>'request_id')::uuid; entity uuid:=(request->>'entity_id')::uuid;
 command text:=request->>'command'; expected integer:=(request->>'expected_revision')::integer;
 body jsonb:=request->'body'; capability text; actor uuid; fingerprint text;
 prior public.eco_production_commands%ROWTYPE; batch public.eco_production_batches%ROWTYPE;
 policy public.eco_production_policies%ROWTYPE; waste public.eco_production_wastes%ROWTYPE;
 normalized jsonb; beforefact jsonb; afterfact jsonb; result jsonb; execid uuid; rev integer;
 line jsonb; ref jsonb; scope jsonb; minqty numeric; maxqty numeric; unit text; qty numeric; used numeric; capacity numeric;
 reason text; originalevents jsonb; oldexecution uuid; batchstatus text; location uuid; related uuid;
BEGIN
 capability:=CASE command WHEN 'create_draft' THEN 'production.batch.log' WHEN 'update_draft' THEN 'production.batch.log'
 WHEN 'cancel_draft' THEN 'production.batch.log' WHEN 'confirm_batch' THEN 'production.batch.confirm'
 WHEN 'correct_batch' THEN 'production.batch.correct' WHEN 'reverse_batch' THEN 'production.batch.correct'
 WHEN 'save_policy' THEN 'production.plan.manage' WHEN 'log_waste' THEN 'production.waste.log'
 WHEN 'confirm_waste' THEN 'production.waste.confirm' ELSE NULL END;
 IF capability IS NULL OR commandid IS NULL OR entity IS NULL OR expected IS NULL OR expected<0 OR jsonb_typeof(body) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_COMMAND'; END IF;
 IF org IS NULL OR opunit IS NULL OR auth.uid() IS NULL
 OR public.can_execute_capability_for_org(org,capability,opunit) IS DISTINCT FROM true THEN
  RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='PRODUCTION_ACCESS_DENIED';
 END IF;
 SELECT id INTO STRICT actor FROM public.eco_user_profiles WHERE auth_user_id=auth.uid() AND is_active;
 -- Identical concurrent retries serialize before cache lookup, across backends.
 PERFORM pg_advisory_xact_lock(hashtextextended(org::text||opunit::text||commandid::text,0));
 fingerprint:=encode(sha256(convert_to(request::text,'UTF8')),'hex');
 SELECT * INTO prior FROM public.eco_production_commands WHERE organization_id=org AND operational_unit_id=opunit AND request_id=commandid;
 IF FOUND THEN
  IF prior.payload_hash<>fingerprint OR prior.actor_profile_id<>actor THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
  RETURN prior.result;
 END IF;

 IF command='save_policy' THEN
  SELECT * INTO policy FROM public.eco_production_policies WHERE id=entity AND organization_id=org AND operational_unit_id=opunit FOR UPDATE;
  IF (FOUND AND policy.revision<>expected) OR (NOT FOUND AND expected<>0) THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;
  beforefact:=CASE WHEN policy.id IS NOT NULL THEN to_jsonb(policy) ELSE NULL END; rev:=expected+1;
  ref:=public.production_require_reference(org,opunit,'PRODUCT',(body->>'product_id')::uuid);
  unit:=body->>'unit'; minqty:=public.production_decimal(body->>'minimum'); maxqty:=public.production_decimal(body->>'maximum');
  IF unit IS DISTINCT FROM ref->>'base_unit' OR minqty<0 OR maxqty<minqty THEN RAISE EXCEPTION 'INVALID_PLANNING_POLICY'; END IF;
  IF jsonb_typeof(body->'stock_scope'->'location_ids') IS DISTINCT FROM 'array' OR jsonb_array_length(body->'stock_scope'->'location_ids') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'STOCK_SCOPE_REQUIRED'; END IF;
  FOR line IN SELECT value FROM jsonb_array_elements(body->'stock_scope'->'location_ids') LOOP
   PERFORM public.production_require_reference(org,opunit,'LOCATION',(line#>>'{}')::uuid);
  END LOOP;
  SELECT jsonb_build_object('location_ids',jsonb_agg(x ORDER BY x)) INTO scope FROM (SELECT DISTINCT value AS x FROM jsonb_array_elements(body->'stock_scope'->'location_ids')) s;
  INSERT INTO public.eco_production_policies(id,organization_id,operational_unit_id,product_id,stock_scope,minimum,maximum,unit,revision,actor_profile_id)
   VALUES(entity,org,opunit,(body->>'product_id')::uuid,scope,minqty,maxqty,unit,rev,actor)
   ON CONFLICT(id) DO UPDATE SET product_id=EXCLUDED.product_id,stock_scope=EXCLUDED.stock_scope,minimum=EXCLUDED.minimum,maximum=EXCLUDED.maximum,unit=EXCLUDED.unit,revision=EXCLUDED.revision,actor_profile_id=actor,updated_at=clock_timestamp()
   WHERE eco_production_policies.organization_id=org AND eco_production_policies.operational_unit_id=opunit AND eco_production_policies.revision=expected;
  IF NOT FOUND THEN RAISE EXCEPTION 'POLICY_SCOPE_CONFLICT'; END IF;
  SELECT to_jsonb(p) INTO afterfact FROM public.eco_production_policies p WHERE id=entity;
  result:=jsonb_build_object('entity_id',entity,'revision',rev,'status','POLICY_SAVED');
 ELSE
  SELECT * INTO batch FROM public.eco_production_batches WHERE id=entity AND organization_id=org AND operational_unit_id=opunit FOR UPDATE;
  IF command='create_draft' THEN
   IF FOUND OR expected<>0 THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;
   normalized:=public.production_normalize_execution(org,opunit,body); rev:=1;
   INSERT INTO public.eco_production_batches(id,organization_id,operational_unit_id,effective_date,actor_profile_id,status,revision,draft,shift,notes)
   VALUES(entity,org,opunit,(normalized->>'effective_date')::date,actor,'DRAFT',rev,normalized,normalized->>'shift',normalized->>'notes');
   batchstatus:='DRAFT';
  ELSE
   IF NOT FOUND THEN RAISE EXCEPTION 'BATCH_NOT_FOUND'; END IF;
   IF batch.revision<>expected THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;
   beforefact:=to_jsonb(batch); rev:=expected+1; batchstatus:=batch.status; oldexecution:=batch.current_execution_id;
   IF command='update_draft' THEN
    IF batchstatus<>'DRAFT' THEN RAISE EXCEPTION 'CONFIRMED_EXECUTION_IMMUTABLE'; END IF;
    normalized:=public.production_normalize_execution(org,opunit,body);
    UPDATE public.eco_production_batches SET draft=normalized,effective_date=(normalized->>'effective_date')::date,shift=normalized->>'shift',notes=normalized->>'notes' WHERE id=entity;
   ELSIF command='cancel_draft' THEN
    IF batchstatus<>'DRAFT' OR length(btrim(coalesce(body->>'reason','')))=0 THEN RAISE EXCEPTION 'DRAFT_CANCELLATION_REASON_REQUIRED'; END IF;
    batchstatus:='CANCELLED';
   ELSIF command IN ('confirm_batch','correct_batch','reverse_batch') THEN
    IF command='confirm_batch' THEN
     IF batchstatus<>'DRAFT' THEN RAISE EXCEPTION 'ALREADY_FINALIZED'; END IF;
     -- Revalidate owner references/conversion at confirmation, never accept a stale catalog snapshot.
     normalized:=public.production_normalize_execution(org,opunit,body);
     IF normalized IS DISTINCT FROM batch.draft THEN RAISE EXCEPTION 'DRAFT_CONFIRMATION_MISMATCH'; END IF;
     batchstatus:='CONFIRMED';
    ELSE
     reason:=btrim(body->>'reason');
     IF batchstatus NOT IN ('CONFIRMED','CORRECTED') OR reason IS NULL OR length(reason)=0 THEN RAISE EXCEPTION 'CORRECTION_REASON_OR_STATE_INVALID'; END IF;
     IF command='correct_batch' THEN normalized:=public.production_normalize_execution(org,opunit,body->'execution'); batchstatus:='CORRECTED';
     ELSE normalized:=jsonb_build_object('effective_date',batch.effective_date,'outputs','[]'::jsonb,'consumptions','[]'::jsonb); batchstatus:='REVERSED'; END IF;
    END IF;
    INSERT INTO public.eco_production_executions(batch_id,organization_id,operational_unit_id,batch_revision,action,snapshot,supersedes_execution_id,reason,actor_profile_id)
    VALUES(entity,org,opunit,rev,CASE command WHEN 'confirm_batch' THEN 'CONFIRM' WHEN 'correct_batch' THEN 'CORRECT' ELSE 'REVERSE' END,normalized,oldexecution,reason,actor) RETURNING id INTO execid;
    IF oldexecution IS NOT NULL THEN
     SELECT coalesce(jsonb_agg(event_id ORDER BY event_id),'[]') INTO originalevents FROM public.eco_production_outbox
      WHERE execution_id=oldexecution AND event_type<>'EXECUTION_COMPENSATION_REQUIRED';
     INSERT INTO public.eco_production_outbox(event_type,organization_id,operational_unit_id,batch_id,execution_id,batch_revision,command_id,effective_date,actor_profile_id,correlation_id,payload)
     VALUES('EXECUTION_COMPENSATION_REQUIRED',org,opunit,entity,execid,rev,commandid,(normalized->>'effective_date')::date,actor,entity,
      jsonb_build_object('original_execution_id',oldexecution,'original_event_ids',originalevents,'reason',reason,'replacement_execution_id',execid));
    END IF;
    FOR line IN SELECT value FROM jsonb_array_elements(normalized->'outputs') LOOP
     INSERT INTO public.eco_production_outputs(execution_id,organization_id,operational_unit_id,line_id,product_id,mode,package_id,package_version,unit_count,normalized_quantity,unit,conversion_snapshot,destination_location_id)
     VALUES(execid,org,opunit,(line->>'line_id')::uuid,(line->>'product_id')::uuid,line->>'mode',(line->>'package_id')::uuid,(line->>'package_version')::uuid,(line->>'unit_count')::integer,(line->>'quantity')::numeric,line->>'unit',line->'conversion_snapshot',(line->>'destination_location_id')::uuid);
     INSERT INTO public.eco_production_outbox(event_type,organization_id,operational_unit_id,batch_id,execution_id,batch_revision,line_id,command_id,effective_date,actor_profile_id,correlation_id,payload)
     VALUES('OUTPUT_CONFIRMED',org,opunit,entity,execid,rev,(line->>'line_id')::uuid,commandid,(normalized->>'effective_date')::date,actor,entity,line);
    END LOOP;
    FOR line IN SELECT value FROM jsonb_array_elements(normalized->'consumptions') LOOP
     INSERT INTO public.eco_production_consumptions(execution_id,organization_id,operational_unit_id,line_id,product_id,quantity,unit,source_location_id)
     VALUES(execid,org,opunit,(line->>'line_id')::uuid,(line->>'product_id')::uuid,(line->>'quantity')::numeric,line->>'unit',(line->>'source_location_id')::uuid);
     INSERT INTO public.eco_production_outbox(event_type,organization_id,operational_unit_id,batch_id,execution_id,batch_revision,line_id,command_id,effective_date,actor_profile_id,correlation_id,payload)
     VALUES('CONSUMPTION_DECLARED',org,opunit,entity,execid,rev,(line->>'line_id')::uuid,commandid,(normalized->>'effective_date')::date,actor,entity,line);
    END LOOP;
    UPDATE public.eco_production_batches SET current_execution_id=execid,effective_date=(normalized->>'effective_date')::date,shift=normalized->>'shift',notes=normalized->>'notes' WHERE id=entity;
   ELSIF command='log_waste' THEN
    IF batchstatus NOT IN ('CONFIRMED','CORRECTED') THEN RAISE EXCEPTION 'WASTE_REQUIRES_EXECUTION'; END IF;
    ref:=public.production_require_reference(org,opunit,'PRODUCT',(body->>'product_id')::uuid);
    qty:=public.production_decimal(body->>'quantity'); unit:=body->>'unit'; reason:=btrim(body->>'reason'); related:=(body->>'related_line_id')::uuid; location:=(body->>'location_id')::uuid;
    IF qty<=0 OR unit IS DISTINCT FROM ref->>'base_unit' OR reason IS NULL OR reason='' THEN RAISE EXCEPTION 'INVALID_WASTE'; END IF;
    IF body->>'classification'='PROCESS_ALREADY_CONSUMED' THEN
     IF NOT EXISTS(SELECT 1 FROM public.eco_production_consumptions WHERE execution_id=oldexecution AND line_id=related AND product_id=(body->>'product_id')::uuid AND eco_production_consumptions.unit=body->>'unit') THEN RAISE EXCEPTION 'PROCESS_WASTE_INPUT_REQUIRED'; END IF;
     IF location IS NOT NULL THEN RAISE EXCEPTION 'PROCESS_WASTE_NO_SECOND_STOCK_REMOVAL'; END IF;
    ELSIF body->>'classification'='OUTPUT_LOSS' THEN
     IF NOT EXISTS(SELECT 1 FROM public.eco_production_outputs WHERE execution_id=oldexecution AND line_id=related AND product_id=(body->>'product_id')::uuid AND destination_location_id=location AND eco_production_outputs.unit=body->>'unit') THEN RAISE EXCEPTION 'OUTPUT_WASTE_REFERENCE_REQUIRED'; END IF;
    ELSIF body->>'classification'='STOCK_REMOVAL' THEN
     IF related IS NOT NULL THEN RAISE EXCEPTION 'STOCK_REMOVAL_IS_SEPARATE_FROM_PROCESS_LOSS'; END IF;
     PERFORM public.production_require_reference(org,opunit,'LOCATION',location);
    ELSE RAISE EXCEPTION 'WASTE_CLASSIFICATION_REQUIRED'; END IF;
    INSERT INTO public.eco_production_wastes(id,batch_id,execution_id,organization_id,operational_unit_id,product_id,quantity,unit,classification,reason,related_line_id,location_id,actor_profile_id)
    VALUES((body->>'waste_id')::uuid,entity,oldexecution,org,opunit,(body->>'product_id')::uuid,qty,unit,body->>'classification',reason,related,location,actor);
   ELSIF command='confirm_waste' THEN
    IF batchstatus NOT IN ('CONFIRMED','CORRECTED') THEN RAISE EXCEPTION 'WASTE_REQUIRES_EXECUTION'; END IF;
    SELECT * INTO waste FROM public.eco_production_wastes WHERE id=(body->>'waste_id')::uuid AND batch_id=entity AND execution_id=oldexecution AND organization_id=org AND operational_unit_id=opunit;
    IF NOT FOUND THEN RAISE EXCEPTION 'WASTE_NOT_FOUND_OR_SUPERSEDED'; END IF;
    IF waste.related_line_id IS NOT NULL THEN
     SELECT coalesce(sum(w.quantity),0) INTO used FROM public.eco_production_wastes w JOIN public.eco_production_waste_confirmations c ON c.waste_id=w.id WHERE w.execution_id=oldexecution AND w.related_line_id=waste.related_line_id;
     IF waste.classification='PROCESS_ALREADY_CONSUMED' THEN SELECT quantity INTO capacity FROM public.eco_production_consumptions WHERE execution_id=oldexecution AND line_id=waste.related_line_id;
     ELSE SELECT normalized_quantity INTO capacity FROM public.eco_production_outputs WHERE execution_id=oldexecution AND line_id=waste.related_line_id; END IF;
     IF used+waste.quantity>capacity THEN RAISE EXCEPTION 'WASTE_EXCEEDS_DECLARED_MATERIAL'; END IF;
    END IF;
    INSERT INTO public.eco_production_waste_confirmations VALUES(waste.id,org,opunit,actor,clock_timestamp());
    IF waste.classification<>'PROCESS_ALREADY_CONSUMED' THEN
     INSERT INTO public.eco_production_outbox(event_type,organization_id,operational_unit_id,batch_id,execution_id,batch_revision,line_id,command_id,effective_date,actor_profile_id,correlation_id,payload)
     VALUES('STOCK_WASTE_CONFIRMED',org,opunit,entity,oldexecution,rev,waste.id,commandid,batch.effective_date,actor,entity,to_jsonb(waste));
    END IF;
   END IF;
   UPDATE public.eco_production_batches SET status=batchstatus,revision=rev,updated_at=clock_timestamp() WHERE id=entity;
  END IF;
  SELECT to_jsonb(b) INTO afterfact FROM public.eco_production_batches b WHERE id=entity;
  result:=jsonb_strip_nulls(jsonb_build_object('entity_id',entity,'revision',rev,'status',CASE command WHEN 'log_waste' THEN 'WASTE_LOGGED' WHEN 'confirm_waste' THEN 'WASTE_CONFIRMED' ELSE batchstatus END,'execution_id',execid));
 END IF;
 INSERT INTO public.eco_production_commands VALUES(commandid,org,opunit,actor,fingerprint,result,clock_timestamp());
 INSERT INTO public.eco_production_actions(organization_id,operational_unit_id,entity_id,command_id,action,before_fact,after_fact,actor_profile_id)
 VALUES(org,opunit,entity,commandid,command,beforefact,jsonb_build_object('entity',afterfact,'declaration',body,'result',result),actor);
 RETURN result;
END $$;

CREATE FUNCTION public.production_immutable_fact() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'PRODUCTION_FACT_IMMUTABLE'; END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['eco_production_batches','eco_production_policies','eco_production_commands','eco_production_executions','eco_production_outputs','eco_production_consumptions','eco_production_wastes','eco_production_waste_confirmations','eco_production_actions','eco_production_outbox'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  EXECUTE format('CREATE POLICY production_scoped_read ON public.%I FOR SELECT TO authenticated USING(public.can_execute_capability_for_org(organization_id,''production.view'',operational_unit_id))',t);
  IF t NOT IN ('eco_production_batches','eco_production_policies') THEN
   EXECUTE format('CREATE TRIGGER production_fact_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.production_immutable_fact()',t);
  ELSE
   EXECUTE format('CREATE TRIGGER production_no_delete BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.production_immutable_fact()',t);
  END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.production_owner_reference(uuid,uuid,text,uuid,uuid), public.production_require_reference(uuid,uuid,text,uuid,uuid), public.production_decimal(text), public.production_normalize_execution(uuid,uuid,jsonb), public.production_immutable_fact(), public.production_execute_command(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.production_execute_command(jsonb) TO authenticated;
COMMIT;
