-- WP-FIN-002. Finance-owned; Master must deploy before the matching frontend.
BEGIN;
CREATE DOMAIN public.finance_economic_type AS text CHECK(VALUE IN (
 'UNCLASSIFIED','OPERATING_INCOME','OPERATING_EXPENSE','INTERNAL_TRANSFER',
 'FINANCING_INFLOW','FINANCING_OUTFLOW','CARD_SETTLEMENT','OTHER_NON_OPERATING'));
ALTER TABLE public.eco_movement_allocations ADD COLUMN economic_type public.finance_economic_type NOT NULL DEFAULT 'UNCLASSIFIED';
ALTER TABLE public.eco_classification_rules ADD COLUMN target_economic_type public.finance_economic_type NOT NULL DEFAULT 'UNCLASSIFIED',
 ADD CONSTRAINT finance_rule_no_internal_transfer CHECK(target_economic_type <> 'INTERNAL_TRANSFER');
-- No sign-based or speculative semantic backfill.
CREATE TABLE public.eco_finance_match_candidates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.eco_organizations(id),
 candidate_type text NOT NULL DEFAULT 'INTERNAL_TRANSFER' CHECK(candidate_type='INTERNAL_TRANSFER'),
 source_movement_id uuid NOT NULL, target_movement_id uuid NOT NULL,
 evidence jsonb NOT NULL, score integer NOT NULL CHECK(score BETWEEN 0 AND 100),
 status text NOT NULL DEFAULT 'SUGGESTED' CHECK(status IN('SUGGESTED','CONFIRMED','REJECTED')),
 created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz, reviewed_by uuid REFERENCES public.eco_user_profiles(auth_user_id),
 UNIQUE(id,organization_id), UNIQUE(organization_id,source_movement_id,target_movement_id),
 CHECK(source_movement_id<>target_movement_id),
 FOREIGN KEY(source_movement_id,organization_id) REFERENCES public.eco_financial_movements(id,organization_id),
 FOREIGN KEY(target_movement_id,organization_id) REFERENCES public.eco_financial_movements(id,organization_id)
);
ALTER TABLE public.eco_movement_allocations ADD COLUMN transfer_candidate_id uuid,
 ADD FOREIGN KEY(transfer_candidate_id,organization_id) REFERENCES public.eco_finance_match_candidates(id,organization_id);
-- Only the paired review RPC can populate this protected relationship.
ALTER TABLE public.eco_movement_allocations ADD CONSTRAINT finance_internal_transfer_requires_pair
 CHECK ((economic_type <> 'INTERNAL_TRANSFER' AND transfer_candidate_id IS NULL)
 OR (economic_type = 'INTERNAL_TRANSFER' AND classification_status = 'CONFIRMED' AND transfer_candidate_id IS NOT NULL));
CREATE INDEX ON public.eco_finance_match_candidates(organization_id,status);
CREATE INDEX ON public.eco_financial_movements(organization_id,monto,fecha) WHERE status='ACTIVE';
CREATE INDEX ON public.eco_movement_allocations(organization_id,classification_status);
ALTER TABLE public.eco_finance_match_candidates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eco_finance_match_candidates FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.eco_finance_match_candidates TO authenticated;
GRANT ALL ON public.eco_finance_match_candidates TO service_role;
CREATE POLICY finance_tenant_read ON public.eco_finance_match_candidates FOR SELECT TO authenticated USING(public.finance_can_read(organization_id));

-- No browser UPDATE/DELETE route around the account RPC. INSERT retains the existing tenant policy.
REVOKE UPDATE,DELETE ON public.eco_financial_accounts FROM authenticated;
CREATE FUNCTION public.rpc_update_finance_account(requested_organization_id uuid, account_id uuid, patch jsonb)
RETURNS public.eco_financial_accounts LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result public.eco_financial_accounts%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT public.finance_can_read(requested_organization_id) OR NOT public.can_execute_capability_for_org(requested_organization_id,'STATEMENTS_IMPORT_CONFIRM') THEN RAISE EXCEPTION 'Account edit denied' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(patch) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(patch) k WHERE k NOT IN('name','masked_identifier','is_active')) THEN RAISE EXCEPTION 'Only name, last4 and active state are mutable'; END IF;
 UPDATE public.eco_financial_accounts a SET name=CASE WHEN patch ? 'name' THEN btrim(patch->>'name') ELSE a.name END,
 masked_identifier=CASE WHEN patch ? 'masked_identifier' THEN patch->>'masked_identifier' ELSE a.masked_identifier END,
 is_active=CASE WHEN patch ? 'is_active' THEN (patch->>'is_active')::boolean ELSE a.is_active END,updated_at=clock_timestamp()
 WHERE a.id=account_id AND a.organization_id=requested_organization_id RETURNING * INTO STRICT result;
 RETURN result;
END; $$;

-- A semantic transfer is separate from generic reconciliation approval.
CREATE FUNCTION public.rpc_detect_finance_transfers(requested_organization_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE changed integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.finance_can_classify(requested_organization_id) THEN RAISE EXCEPTION 'Transfer detection denied' USING ERRCODE='42501'; END IF;
 INSERT INTO public.eco_finance_match_candidates(organization_id,source_movement_id,target_movement_id,evidence,score)
 SELECT requested_organization_id,s.id,t.id,
 jsonb_build_object('equalOppositeAmounts',true,'differentOwnAccounts',true,'currency',s.currency,'dayDistance',abs(s.fecha-t.fecha),
 'referenceMatch',coalesce(s.external_reference<>'' AND s.external_reference=t.external_reference,false),
 'descriptionHint',(s.descripcion||' '||t.descripcion) ~* '(traspas|transfer)'),
 60 + CASE WHEN s.fecha=t.fecha THEN 10 ELSE 0 END + CASE WHEN s.external_reference<>'' AND s.external_reference=t.external_reference THEN 20 ELSE 0 END + CASE WHEN (s.descripcion||' '||t.descripcion) ~* '(traspas|transfer)' THEN 10 ELSE 0 END
 FROM public.eco_financial_movements s JOIN public.eco_financial_movements t
 ON t.organization_id=s.organization_id AND t.monto=-s.monto AND t.fecha BETWEEN s.fecha-3 AND s.fecha+3
 JOIN public.eco_financial_accounts sa ON sa.id=s.source_account_id AND sa.organization_id=s.organization_id
 JOIN public.eco_financial_accounts ta ON ta.id=t.source_account_id AND ta.organization_id=t.organization_id
 WHERE s.organization_id=requested_organization_id AND s.monto<0 AND s.status='ACTIVE' AND t.status='ACTIVE'
 AND s.source_account_id<>t.source_account_id AND s.currency=t.currency AND sa.product_type='BANK_ACCOUNT' AND ta.product_type='BANK_ACCOUNT'
 AND (SELECT count(*) FROM public.eco_movement_allocations a WHERE a.movement_id=s.id AND a.organization_id=requested_organization_id)=1
 AND (SELECT count(*) FROM public.eco_movement_allocations a WHERE a.movement_id=t.id AND a.organization_id=requested_organization_id)=1
 AND NOT EXISTS(SELECT 1 FROM public.eco_movement_allocations a WHERE a.organization_id=requested_organization_id AND a.movement_id IN(s.id,t.id)
  AND (a.transfer_candidate_id IS NOT NULL OR a.reconciliation_status='CONFIRMED' OR (a.classification_status='CONFIRMED' AND a.economic_type NOT IN('UNCLASSIFIED','INTERNAL_TRANSFER'))))
 ON CONFLICT(organization_id,source_movement_id,target_movement_id) DO NOTHING;
 GET DIAGNOSTICS changed=ROW_COUNT; RETURN changed;
END; $$;

CREATE FUNCTION public.rpc_review_finance_transfer(requested_organization_id uuid, candidate_id uuid, decision text)
RETURNS public.eco_finance_match_candidates LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.eco_finance_match_candidates%ROWTYPE; s public.eco_financial_movements%ROWTYPE; t public.eco_financial_movements%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT public.finance_can_classify(requested_organization_id) THEN RAISE EXCEPTION 'Transfer review denied' USING ERRCODE='42501'; END IF;
 IF decision IS NULL OR decision NOT IN('CONFIRMED','REJECTED') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
 SELECT * INTO STRICT c FROM public.eco_finance_match_candidates WHERE id=candidate_id AND organization_id=requested_organization_id;
 -- All interpretation writers lock the bank facts first in a stable order.
 PERFORM 1 FROM public.eco_financial_movements WHERE organization_id=requested_organization_id AND id IN(c.source_movement_id,c.target_movement_id) ORDER BY id FOR UPDATE;
 SELECT * INTO STRICT c FROM public.eco_finance_match_candidates WHERE id=candidate_id AND organization_id=requested_organization_id FOR UPDATE;
 IF c.status=decision THEN RETURN c; END IF;
 IF c.status<>'SUGGESTED' THEN RAISE EXCEPTION 'Candidate already reviewed'; END IF;
 IF decision='CONFIRMED' THEN
  SELECT * INTO STRICT s FROM public.eco_financial_movements WHERE id=c.source_movement_id AND organization_id=requested_organization_id;
  SELECT * INTO STRICT t FROM public.eco_financial_movements WHERE id=c.target_movement_id AND organization_id=requested_organization_id;
  IF s.status<>'ACTIVE' OR t.status<>'ACTIVE' OR s.monto>=0 OR t.monto<>-s.monto OR s.currency<>t.currency OR s.source_account_id=t.source_account_id OR abs(s.fecha-t.fecha)>3
   OR (SELECT count(*) FROM public.eco_financial_accounts WHERE organization_id=requested_organization_id AND id IN(s.source_account_id,t.source_account_id) AND product_type='BANK_ACCOUNT')<>2
  THEN RAISE EXCEPTION 'Transfer evidence no longer valid'; END IF;
  IF (SELECT count(*) FROM public.eco_movement_allocations WHERE organization_id=requested_organization_id AND movement_id=s.id AND monto=s.monto)<>1
   OR (SELECT count(*) FROM public.eco_movement_allocations WHERE organization_id=requested_organization_id AND movement_id=t.id AND monto=t.monto)<>1
   OR (SELECT count(*) FROM public.eco_movement_allocations WHERE organization_id=requested_organization_id AND movement_id IN(s.id,t.id))<>2
   OR EXISTS(SELECT 1 FROM public.eco_movement_allocations WHERE organization_id=requested_organization_id AND movement_id IN(s.id,t.id)
    AND (transfer_candidate_id IS NOT NULL OR reconciliation_status='CONFIRMED' OR (classification_status='CONFIRMED' AND economic_type NOT IN('UNCLASSIFIED','INTERNAL_TRANSFER'))))
  THEN RAISE EXCEPTION 'Allocations changed or already linked; review individually'; END IF;
  UPDATE public.eco_movement_allocations SET economic_type='INTERNAL_TRANSFER',classification_status='CONFIRMED',classification_source='MANUAL',
   category_id=NULL,subcategory_id=NULL,transfer_candidate_id=c.id,is_internal_transfer=true,is_card_settlement=false,updated_at=clock_timestamp()
   WHERE organization_id=requested_organization_id AND movement_id IN(s.id,t.id);
 END IF;
 UPDATE public.eco_finance_match_candidates SET status=decision,reviewed_at=clock_timestamp(),reviewed_by=auth.uid()
 WHERE id=c.id AND organization_id=requested_organization_id RETURNING * INTO c;
 RETURN c;
END; $$;

CREATE FUNCTION public.rpc_confirm_finance_suggestions(requested_organization_id uuid, reviews jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE item jsonb; changed integer:=0;
BEGIN
 IF auth.uid() IS NULL OR NOT public.finance_can_classify(requested_organization_id) THEN RAISE EXCEPTION 'Review denied' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(reviews) IS DISTINCT FROM 'array' OR jsonb_array_length(reviews) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Select between 1 and 100 suggestions'; END IF;
 PERFORM 1 FROM public.eco_financial_movements m WHERE m.organization_id=requested_organization_id AND m.status='ACTIVE' AND m.id IN(
 SELECT a.movement_id FROM public.eco_movement_allocations a JOIN jsonb_array_elements(reviews) r ON a.id=(r->>'id')::uuid WHERE a.organization_id=requested_organization_id) ORDER BY m.id FOR UPDATE;
 FOR item IN SELECT value FROM jsonb_array_elements(reviews) LOOP
  UPDATE public.eco_movement_allocations a SET classification_status='CONFIRMED',classification_source='MANUAL',updated_at=clock_timestamp()
  WHERE a.id=(item->>'id')::uuid AND a.organization_id=requested_organization_id AND a.updated_at=(item->>'updated_at')::timestamptz
   AND a.classification_status='SUGGESTED' AND a.economic_type NOT IN('UNCLASSIFIED','INTERNAL_TRANSFER') AND a.transfer_candidate_id IS NULL AND a.reconciliation_status='UNMATCHED'
   AND EXISTS(SELECT 1 FROM public.eco_financial_movements m WHERE m.id=a.movement_id AND m.organization_id=requested_organization_id AND m.status='ACTIVE');
  IF NOT FOUND THEN RAISE EXCEPTION 'Suggestion changed or requires individual review; reload'; END IF;
  changed:=changed+1;
 END LOOP;
 RETURN changed;
END; $$;

REVOKE ALL ON FUNCTION public.rpc_update_finance_account(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_update_finance_account(uuid,uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_detect_finance_transfers(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_detect_finance_transfers(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_review_finance_transfer(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_review_finance_transfer(uuid,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_confirm_finance_suggestions(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_confirm_finance_suggestions(uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_confirm_bank_statement_import(requested_organization_id uuid, bank_account_id uuid,
 file_hash text, source_format text, movements jsonb, rejected_rows jsonb DEFAULT '[]')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE acc public.eco_financial_accounts%ROWTYPE; imp public.eco_source_imports%ROWTYPE;
 fid uuid; rid uuid; mid uuid; m jsonb; amt numeric; bal numeric; booking date; valdate date;
 fp text; overlap boolean; overlap_count integer:=0; accepted integer:=0; rejected integer:=0;
 matched public.eco_classification_rules%ROWTYPE; rejected_code text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_execute_capability_for_org(requested_organization_id,'STATEMENTS_IMPORT_CONFIRM')
 THEN RAISE EXCEPTION 'Bank confirmation denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO acc FROM public.eco_financial_accounts a WHERE a.id=bank_account_id AND a.organization_id=requested_organization_id FOR SHARE;
 IF NOT FOUND OR NOT acc.is_active OR source_format NOT IN('BBVA_ACCOUNT','BBVA_CARD','SABADELL_ACCOUNT','SABADELL_CARD') OR source_format IS NULL
 OR acc.institution<>split_part(source_format,'_',1)
 OR acc.product_type<>(CASE WHEN source_format LIKE '%_CARD' THEN 'CARD' ELSE 'BANK_ACCOUNT' END)
 THEN RAISE EXCEPTION 'Invalid target account or source' USING ERRCODE='22023'; END IF;
 IF file_hash IS NULL OR file_hash !~ '^[a-f0-9]{64}$' OR jsonb_typeof(movements) IS DISTINCT FROM 'array'
 OR jsonb_typeof(rejected_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid import payload'; END IF;
 IF jsonb_array_length(movements)<1 OR jsonb_array_length(movements)+jsonb_array_length(rejected_rows)>20000
 THEN RAISE EXCEPTION 'Invalid import row count'; END IF;
 -- A conflict waits for the other transaction to commit/rollback; no fingerprint deduplication.
 INSERT INTO public.eco_source_imports(organization_id,bank_account_id,file_sha256,source_type,status,total_rows,created_by)
 VALUES(requested_organization_id,acc.id,file_hash,source_format,'PROCESSING',jsonb_array_length(movements)+jsonb_array_length(rejected_rows),auth.uid())
 ON CONFLICT(organization_id,file_sha256) DO NOTHING RETURNING * INTO imp;
 IF NOT FOUND THEN
  SELECT * INTO STRICT imp FROM public.eco_source_imports i WHERE i.organization_id=requested_organization_id AND i.file_sha256=file_hash;
  IF imp.status<>'COMPLETED' THEN RAISE EXCEPTION 'Incomplete prior import'; END IF;
  RETURN jsonb_build_object('importId',imp.id,'bankAccountId',imp.bank_account_id,'totalParsed',imp.accepted_rows,
   'persistedCount',0,'potentialOverlapCount',0,'duplicateSuppressedCount',imp.accepted_rows,'status','COMPLETED');
 END IF;
 INSERT INTO public.eco_source_files(organization_id,import_id,original_name,sha256_hash,source_type)
 VALUES(requested_organization_id,imp.id,source_format||'.statement',file_hash,source_format) RETURNING id INTO fid;
 FOR m IN SELECT value FROM jsonb_array_elements(movements) LOOP
  amt:=public.finance_money(m->>'amount'); bal:=CASE WHEN m->>'runningBalance' IS NULL THEN NULL ELSE public.finance_money(m->>'runningBalance') END;
  IF m->>'bookingDate' IS NULL OR m->>'bookingDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
   OR NOT (m ? 'valueDate') OR (m->>'valueDate' IS NOT NULL AND m->>'valueDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
   OR m->>'currency' IS DISTINCT FROM acc.currency
   OR m->>'direction' IS DISTINCT FROM (CASE WHEN amt<0 THEN 'DEBIT' ELSE 'CREDIT' END)
   OR length(coalesce(m->>'bankNativeId',''))>128 OR length(coalesce(m->>'externalReference',''))>128
  THEN RAISE EXCEPTION 'Invalid canonical row'; END IF;
  booking:=(m->>'bookingDate')::date; valdate:=(m->>'valueDate')::date;
  fp:=public.finance_fingerprint(acc.id,booking,valdate,amt,m->>'description',bal,m->>'bankNativeId',m->>'externalReference');
  SELECT EXISTS(SELECT 1 FROM public.eco_financial_movements x WHERE x.organization_id=requested_organization_id AND x.financial_fingerprint=fp) INTO overlap;
  INSERT INTO public.eco_import_rows(organization_id,file_id,source_row_number,parse_status,raw_payload)
  VALUES(requested_organization_id,fid,(m->>'sourceRowNumber')::integer,'ACCEPTED',jsonb_build_object('sourceRowNumber',(m->>'sourceRowNumber')::integer)) RETURNING id INTO rid;
  INSERT INTO public.eco_financial_movements(organization_id,import_id,row_id,source_account_id,fecha,fecha_valor,descripcion,monto,currency,
   running_balance,external_reference,bank_native_id,source_row_number,financial_fingerprint,duplicate_status,normalized_payload,raw_payload)
  VALUES(requested_organization_id,imp.id,rid,acc.id,booking,valdate,m->>'description',amt,acc.currency,
   bal,m->>'externalReference',m->>'bankNativeId',(m->>'sourceRowNumber')::integer,fp,CASE WHEN overlap THEN 'POTENTIAL_OVERLAP' ELSE 'UNIQUE' END,
   jsonb_build_object('currency',acc.currency,'direction',CASE WHEN amt<0 THEN 'DEBIT' ELSE 'CREDIT' END,'running_balance',bal,'external_reference',m->>'externalReference'),
   jsonb_build_object('sourceRowNumber',(m->>'sourceRowNumber')::integer)) RETURNING id INTO mid;
  SELECT * INTO matched FROM public.eco_classification_rules r WHERE r.organization_id=requested_organization_id AND r.is_active AND r.target_economic_type <> 'INTERNAL_TRANSFER'
   AND (r.source_account_id IS NULL OR r.source_account_id=acc.id)
   AND (r.match_sign='ALL' OR (r.match_sign='POSITIVE' AND amt>0) OR (r.match_sign='NEGATIVE' AND amt<0))
   AND strpos(upper(m->>'description'),upper(btrim(r.pattern)))>0 ORDER BY r.priority,r.created_at,r.id LIMIT 1;
  INSERT INTO public.eco_movement_allocations(organization_id,movement_id,monto,category_id,subcategory_id,counterparty_id,economic_type,classification_status,classification_source)
  VALUES(requested_organization_id,mid,amt,matched.target_category_id,matched.target_subcategory_id,matched.target_counterparty_id,coalesce(matched.target_economic_type,'UNCLASSIFIED'),
   CASE WHEN matched.id IS NULL THEN 'PENDING' ELSE 'SUGGESTED' END,CASE WHEN matched.id IS NULL THEN 'MANUAL' ELSE 'RULE' END);
  accepted:=accepted+1; IF overlap THEN overlap_count:=overlap_count+1; END IF;
 END LOOP;
 FOR m IN SELECT value FROM jsonb_array_elements(rejected_rows) LOOP
  rejected_code:=m->>'code';
  IF rejected_code IS NULL OR rejected_code NOT IN('INVALID_AMOUNT','INVALID_DATE','INVALID_VALUE_DATE','INVALID_BALANCE') THEN RAISE EXCEPTION 'Invalid rejection code'; END IF;
  INSERT INTO public.eco_import_rows(organization_id,file_id,source_row_number,parse_status,error_code,reason,raw_payload)
  VALUES(requested_organization_id,fid,(m->>'sourceRowNumber')::integer,'REJECTED',rejected_code,'Source row failed validation',jsonb_build_object('sourceFormat',source_format));
  rejected:=rejected+1;
 END LOOP;
 UPDATE public.eco_source_imports SET status='COMPLETED',accepted_rows=accepted,rejected_rows=rejected,duplicate_rows=overlap_count,completed_at=now() WHERE id=imp.id;
 RETURN jsonb_build_object('importId',imp.id,'bankAccountId',acc.id,'totalParsed',accepted,'persistedCount',accepted,
  'potentialOverlapCount',overlap_count,'duplicateSuppressedCount',0,'status','COMPLETED');
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_update_bank_allocation(requested_organization_id uuid, allocation_id uuid, patch jsonb)
RETURNS public.eco_movement_allocations LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result public.eco_movement_allocations%ROWTYPE; mid uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.finance_can_classify(requested_organization_id) THEN RAISE EXCEPTION 'Classification denied' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(patch) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(patch) k WHERE k NOT IN('economic_type','category_id','subcategory_id','counterparty_id','notes','classification_status')) THEN RAISE EXCEPTION 'Invalid classification patch'; END IF;
 SELECT movement_id INTO STRICT mid FROM public.eco_movement_allocations WHERE id=allocation_id AND organization_id=requested_organization_id;
 PERFORM 1 FROM public.eco_financial_movements WHERE id=mid AND organization_id=requested_organization_id AND status='ACTIVE' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Movement unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM public.eco_movement_allocations WHERE id=allocation_id AND organization_id=requested_organization_id AND transfer_candidate_id IS NOT NULL) THEN RAISE EXCEPTION 'Linked transfer interpretation is protected'; END IF;
 IF patch->>'economic_type' = 'INTERNAL_TRANSFER' OR EXISTS(SELECT 1 FROM public.eco_movement_allocations WHERE id=allocation_id AND organization_id=requested_organization_id AND economic_type='INTERNAL_TRANSFER')
 THEN RAISE EXCEPTION 'Internal transfer requires paired transfer review' USING ERRCODE='22023'; END IF;
 UPDATE public.eco_movement_allocations a SET
 economic_type=CASE WHEN patch ? 'economic_type' THEN (patch->>'economic_type')::public.finance_economic_type ELSE a.economic_type END,
 is_internal_transfer=CASE WHEN patch ? 'economic_type' THEN patch->>'economic_type'='INTERNAL_TRANSFER' ELSE a.is_internal_transfer END,
 is_card_settlement=CASE WHEN patch ? 'economic_type' THEN patch->>'economic_type'='CARD_SETTLEMENT' ELSE a.is_card_settlement END,
 category_id=CASE WHEN patch ? 'category_id' THEN (patch->>'category_id')::uuid ELSE a.category_id END,
 subcategory_id=CASE WHEN patch ? 'subcategory_id' THEN (patch->>'subcategory_id')::uuid WHEN patch ? 'category_id' THEN NULL ELSE a.subcategory_id END,
 counterparty_id=CASE WHEN patch ? 'counterparty_id' THEN (patch->>'counterparty_id')::uuid ELSE a.counterparty_id END,
 notes=CASE WHEN patch ? 'notes' THEN patch->>'notes' ELSE a.notes END,
 classification_status=coalesce(patch->>'classification_status','CONFIRMED'),classification_source='MANUAL',updated_at=clock_timestamp()
 WHERE a.id=allocation_id AND a.organization_id=requested_organization_id RETURNING * INTO STRICT result;
 RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_split_bank_movement(requested_organization_id uuid, movement_id uuid, allocations jsonb)
RETURNS SETOF public.eco_movement_allocations LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE original numeric; total numeric:=0; item jsonb; amount numeric;
BEGIN
 IF auth.uid() IS NULL OR NOT public.finance_can_classify(requested_organization_id) THEN RAISE EXCEPTION 'Split denied' USING ERRCODE='42501'; END IF;
 SELECT monto INTO STRICT original FROM public.eco_financial_movements m WHERE m.id=movement_id AND m.organization_id=requested_organization_id AND m.status='ACTIVE' FOR UPDATE;
 IF jsonb_typeof(allocations) IS DISTINCT FROM 'array' OR jsonb_array_length(allocations) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid allocations'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(allocations) LOOP
  IF item->>'economic_type' = 'INTERNAL_TRANSFER' THEN RAISE EXCEPTION 'Internal transfer requires paired transfer review' USING ERRCODE='22023'; END IF;
  amount:=public.finance_money(item->>'monto');
  IF (original<0 AND amount>0) OR (original>0 AND amount<0) OR (original=0 AND amount<>0) THEN RAISE EXCEPTION 'Allocation sign mismatch'; END IF;
  total:=total+amount;
 END LOOP;
 IF total<>original THEN RAISE EXCEPTION 'Unbalanced split'; END IF;
 IF EXISTS(SELECT 1 FROM public.eco_movement_allocations a WHERE a.movement_id=rpc_split_bank_movement.movement_id AND a.organization_id=requested_organization_id AND (a.reconciliation_status='CONFIRMED' OR a.transfer_candidate_id IS NOT NULL)) THEN RAISE EXCEPTION 'Reconciled allocations require review before splitting'; END IF;
 DELETE FROM public.eco_movement_allocations a WHERE a.movement_id=rpc_split_bank_movement.movement_id AND a.organization_id=requested_organization_id;
 FOR item IN SELECT value FROM jsonb_array_elements(allocations) LOOP
  RETURN QUERY INSERT INTO public.eco_movement_allocations(organization_id,movement_id,monto,category_id,subcategory_id,counterparty_id,notes,economic_type,classification_status,classification_source)
  VALUES(requested_organization_id,movement_id,public.finance_money(item->>'monto'),nullif(item->>'category_id','')::uuid,nullif(item->>'subcategory_id','')::uuid,nullif(item->>'counterparty_id','')::uuid,item->>'notes',coalesce(item->>'economic_type','UNCLASSIFIED')::public.finance_economic_type,'CONFIRMED','MANUAL') RETURNING *;
 END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_apply_finance_rules(requested_organization_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a record; r public.eco_classification_rules%ROWTYPE; changed integer:=0;
BEGIN
 IF auth.uid() IS NULL OR NOT public.finance_can_classify(requested_organization_id) THEN RAISE EXCEPTION 'Rule application denied' USING ERRCODE='42501'; END IF;
 -- Lock facts first, as do the split/classification operations, to avoid stale suggestions.
 FOR a IN SELECT m.id,m.monto,m.descripcion,m.source_account_id FROM public.eco_financial_movements m
  WHERE m.organization_id=requested_organization_id AND m.status='ACTIVE' ORDER BY m.id FOR UPDATE LOOP
  IF (SELECT count(*) FROM public.eco_movement_allocations x WHERE x.movement_id=a.id)<>1 THEN CONTINUE; END IF;
  SELECT * INTO r FROM public.eco_classification_rules x WHERE x.organization_id=requested_organization_id AND x.is_active AND x.target_economic_type <> 'INTERNAL_TRANSFER'
   AND (x.source_account_id IS NULL OR x.source_account_id=a.source_account_id)
   AND (x.match_sign='ALL' OR (x.match_sign='POSITIVE' AND a.monto>0) OR (x.match_sign='NEGATIVE' AND a.monto<0))
   AND strpos(upper(a.descripcion),upper(btrim(x.pattern)))>0 ORDER BY x.priority,x.created_at,x.id LIMIT 1;
  IF r.id IS NOT NULL THEN
   UPDATE public.eco_movement_allocations SET economic_type=r.target_economic_type,category_id=r.target_category_id,subcategory_id=r.target_subcategory_id,counterparty_id=r.target_counterparty_id,
    classification_status='SUGGESTED',classification_source='RULE',updated_at=clock_timestamp()
   WHERE organization_id=requested_organization_id AND movement_id=a.id AND classification_status='PENDING' AND reconciliation_status='UNMATCHED' AND transfer_candidate_id IS NULL;
   IF FOUND THEN changed:=changed+1; END IF;
  END IF;
 END LOOP;
 RETURN changed;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_finance_reconcile(requested_organization_id uuid, allocation_id uuid, target_movement_id uuid, reconciliation_type text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE mid uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.finance_can_read(requested_organization_id) OR NOT public.can_execute_capability_for_org(requested_organization_id,'financial.reconciliation.confirm') THEN RAISE EXCEPTION 'Reconciliation denied' USING ERRCODE='42501'; END IF;
 SELECT movement_id INTO STRICT mid FROM public.eco_movement_allocations WHERE id=allocation_id AND organization_id=requested_organization_id;
 PERFORM 1 FROM public.eco_financial_movements WHERE id=mid AND organization_id=requested_organization_id AND status='ACTIVE' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Movement unavailable'; END IF;
 IF reconciliation_type IS NOT NULL AND reconciliation_type NOT IN('INTERNAL_TRANSFER','CARD_SETTLEMENT') THEN RAISE EXCEPTION 'Invalid reconciliation type'; END IF;
 IF EXISTS(SELECT 1 FROM public.eco_movement_allocations WHERE id=allocation_id AND organization_id=requested_organization_id AND transfer_candidate_id IS NOT NULL) THEN RAISE EXCEPTION 'Linked transfer interpretation is protected'; END IF;
 UPDATE public.eco_movement_allocations a SET reconciliation_status=CASE WHEN rpc_finance_reconcile.reconciliation_type IS NULL THEN 'UNMATCHED' ELSE 'CONFIRMED' END,
 reconciled_movement_id=target_movement_id,reconciliation_type=rpc_finance_reconcile.reconciliation_type,
 is_internal_transfer=coalesce(rpc_finance_reconcile.reconciliation_type='INTERNAL_TRANSFER',false),is_card_settlement=coalesce(rpc_finance_reconcile.reconciliation_type='CARD_SETTLEMENT',false),updated_at=now()
 WHERE a.id=allocation_id AND a.organization_id=requested_organization_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Allocation unavailable'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_finance_soft_delete(requested_organization_id uuid, movement_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.finance_can_read(requested_organization_id) OR NOT public.can_execute_capability_for_org(requested_organization_id,'data.records.delete_soft') THEN RAISE EXCEPTION 'Delete denied' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.eco_financial_movements m WHERE m.id=movement_id AND m.organization_id=requested_organization_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.eco_movement_allocations a WHERE a.movement_id=rpc_finance_soft_delete.movement_id AND a.organization_id=requested_organization_id AND a.transfer_candidate_id IS NOT NULL) THEN RAISE EXCEPTION 'Linked transfer movements must remain visible'; END IF;
 UPDATE public.eco_financial_movements m SET status='SOFT_DELETED',deleted_at=now() WHERE m.id=movement_id AND m.organization_id=requested_organization_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Movement unavailable'; END IF;
END; $$;
COMMIT;
