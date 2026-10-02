-- Finance-owned, Master-deployed after the two approved Core migrations.
-- Clean adoption: all ten eco_* Finance tables were absent in canonical DEV.
-- Fail if any table already exists; never guess/backfill an unknown legacy schema.
BEGIN;
CREATE TABLE public.eco_financial_accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.eco_organizations(id),
 code text NOT NULL, name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 100),
 institution text NOT NULL CHECK(institution IN('BBVA','SABADELL')),
 product_type text NOT NULL CHECK(product_type IN('BANK_ACCOUNT','CARD')),
 masked_identifier text NOT NULL CHECK(masked_identifier ~ '^[0-9]{4}$'),
 currency text NOT NULL DEFAULT 'EUR' CHECK(currency ~ '^[A-Z]{3}$'),
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,organization_id), UNIQUE(organization_id,code)
);
CREATE TABLE public.eco_tax_categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.eco_organizations(id),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 100),
 type text NOT NULL CHECK(type IN('INGRESO','GASTO')),
 UNIQUE(id,organization_id), UNIQUE(organization_id,name,type)
);
CREATE TABLE public.eco_tax_subcategories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.eco_organizations(id),
 category_id uuid NOT NULL, name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 100),
 FOREIGN KEY(category_id,organization_id) REFERENCES public.eco_tax_categories(id,organization_id),
 UNIQUE(id,category_id,organization_id), UNIQUE(category_id,name)
);
CREATE TABLE public.eco_counterparties (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.eco_organizations(id),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 200), type text NOT NULL DEFAULT 'PROVEEDOR',
 UNIQUE(id,organization_id), UNIQUE(organization_id,name)
);
CREATE TABLE public.eco_source_imports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.eco_organizations(id),
 bank_account_id uuid NOT NULL, file_sha256 text NOT NULL CHECK(file_sha256 ~ '^[a-f0-9]{64}$'),
 source_type text NOT NULL CHECK(source_type IN('BBVA_ACCOUNT','BBVA_CARD','SABADELL_ACCOUNT','SABADELL_CARD')),
 parser_version text NOT NULL DEFAULT 'WP-FIN-001-v2',
 status text NOT NULL CHECK(status IN('PROCESSING','COMPLETED')),
 total_rows integer NOT NULL CHECK(total_rows>0), accepted_rows integer NOT NULL DEFAULT 0 CHECK(accepted_rows>=0),
 rejected_rows integer NOT NULL DEFAULT 0 CHECK(rejected_rows>=0), duplicate_rows integer NOT NULL DEFAULT 0 CHECK(duplicate_rows>=0),
 created_by uuid NOT NULL REFERENCES public.eco_user_profiles(auth_user_id),
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 FOREIGN KEY(bank_account_id,organization_id) REFERENCES public.eco_financial_accounts(id,organization_id),
 UNIQUE(id,organization_id), UNIQUE(organization_id,file_sha256),
 CHECK(status<>'COMPLETED' OR (completed_at IS NOT NULL AND accepted_rows+rejected_rows=total_rows))
);
CREATE TABLE public.eco_source_files (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.eco_organizations(id),
 import_id uuid NOT NULL, original_name text NOT NULL,
 sha256_hash text NOT NULL CHECK(sha256_hash ~ '^[a-f0-9]{64}$'),
 source_type text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(import_id,organization_id) REFERENCES public.eco_source_imports(id,organization_id),
 UNIQUE(id,organization_id), UNIQUE(organization_id,sha256_hash), UNIQUE(import_id)
);
CREATE TABLE public.eco_import_rows (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.eco_organizations(id),
 file_id uuid NOT NULL, source_row_number integer NOT NULL CHECK(source_row_number>0),
 parse_status text NOT NULL CHECK(parse_status IN('ACCEPTED','REJECTED')),
 error_code text, reason text, raw_payload jsonb NOT NULL DEFAULT '{}',
 FOREIGN KEY(file_id,organization_id) REFERENCES public.eco_source_files(id,organization_id),
 UNIQUE(id,organization_id), UNIQUE(file_id,source_row_number)
);
CREATE TABLE public.eco_financial_movements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.eco_organizations(id),
 import_id uuid NOT NULL, row_id uuid NOT NULL, source_account_id uuid NOT NULL,
 fecha date NOT NULL, fecha_valor date, descripcion text NOT NULL CHECK(length(btrim(descripcion)) BETWEEN 1 AND 1000),
 monto numeric(14,2) NOT NULL, currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 running_balance numeric(14,2), external_reference text, bank_native_id text,
 source_row_number integer NOT NULL CHECK(source_row_number>0),
 financial_fingerprint text NOT NULL CHECK(financial_fingerprint ~ '^[a-f0-9]{64}$'),
 duplicate_status text NOT NULL CHECK(duplicate_status IN('UNIQUE','POTENTIAL_OVERLAP')),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','SOFT_DELETED')), deleted_at timestamptz,
 operation_type text GENERATED ALWAYS AS (CASE WHEN monto<0 THEN 'GASTO' ELSE 'INGRESO' END) STORED,
 normalized_payload jsonb NOT NULL, raw_payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(import_id,organization_id) REFERENCES public.eco_source_imports(id,organization_id),
 FOREIGN KEY(row_id,organization_id) REFERENCES public.eco_import_rows(id,organization_id),
 FOREIGN KEY(source_account_id,organization_id) REFERENCES public.eco_financial_accounts(id,organization_id),
 UNIQUE(id,organization_id), UNIQUE(row_id)
);
-- Deliberately NOT UNIQUE: economic resemblance does not establish duplicate identity.
CREATE INDEX ON public.eco_financial_movements(organization_id,financial_fingerprint);
CREATE TABLE public.eco_movement_allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.eco_organizations(id),
 movement_id uuid NOT NULL, monto numeric(14,2) NOT NULL,
 category_id uuid, subcategory_id uuid, counterparty_id uuid,
 classification_status text NOT NULL DEFAULT 'PENDING' CHECK(classification_status IN('PENDING','SUGGESTED','CONFIRMED')),
 classification_source text NOT NULL DEFAULT 'MANUAL' CHECK(classification_source IN('MANUAL','RULE')),
 reconciliation_status text NOT NULL DEFAULT 'UNMATCHED' CHECK(reconciliation_status IN('UNMATCHED','CONFIRMED')),
 reconciled_movement_id uuid, reconciliation_type text,
 is_internal_transfer boolean NOT NULL DEFAULT false, is_card_settlement boolean NOT NULL DEFAULT false,
 notes text CHECK(length(notes)<=500), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT eco_movement_allocations_movement_id_fkey FOREIGN KEY(movement_id,organization_id) REFERENCES public.eco_financial_movements(id,organization_id),
 FOREIGN KEY(category_id,organization_id) REFERENCES public.eco_tax_categories(id,organization_id),
 FOREIGN KEY(subcategory_id,category_id,organization_id) REFERENCES public.eco_tax_subcategories(id,category_id,organization_id),
 FOREIGN KEY(counterparty_id,organization_id) REFERENCES public.eco_counterparties(id,organization_id),
 FOREIGN KEY(reconciled_movement_id,organization_id) REFERENCES public.eco_financial_movements(id,organization_id),
 CHECK(subcategory_id IS NULL OR category_id IS NOT NULL)
);
CREATE TABLE public.eco_classification_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.eco_organizations(id),
 name text NOT NULL, pattern text NOT NULL CHECK(length(btrim(pattern)) BETWEEN 1 AND 200),
 match_sign text NOT NULL DEFAULT 'ALL' CHECK(match_sign IN('ALL','POSITIVE','NEGATIVE')),
 source_account_id uuid, target_category_id uuid, target_subcategory_id uuid, target_counterparty_id uuid,
 priority integer NOT NULL DEFAULT 100, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(source_account_id,organization_id) REFERENCES public.eco_financial_accounts(id,organization_id),
 FOREIGN KEY(target_category_id,organization_id) REFERENCES public.eco_tax_categories(id,organization_id),
 FOREIGN KEY(target_subcategory_id,target_category_id,organization_id) REFERENCES public.eco_tax_subcategories(id,category_id,organization_id),
 FOREIGN KEY(target_counterparty_id,organization_id) REFERENCES public.eco_counterparties(id,organization_id),
 CHECK(target_subcategory_id IS NULL OR target_category_id IS NOT NULL)
);

CREATE FUNCTION public.finance_money(value text) RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
BEGIN
 IF value IS NULL OR value !~ '^-?[0-9]+(\.[0-9]{1,2})?$' OR abs(value::numeric)>999999999999.99
 THEN RAISE EXCEPTION 'Invalid or missing money' USING ERRCODE='22023'; END IF;
 RETURN value::numeric(14,2);
END; $$;
CREATE FUNCTION public.finance_fingerprint(account_id uuid, booking_date date, value_date date,
 amount numeric, description text, balance numeric, native_id text, reference text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT encode(sha256(convert_to(array_to_string(ARRAY[
  to_jsonb(account_id::text)::text,to_jsonb(to_char(booking_date,'YYYY-MM-DD'))::text,
  to_jsonb(coalesce(to_char(value_date,'YYYY-MM-DD'),''))::text,
  to_jsonb(amount::numeric(14,2)::text)::text,
  to_jsonb(regexp_replace(upper(btrim(description)),'\s+',' ','g'))::text,
  to_jsonb(coalesce(balance::numeric(14,2)::text,''))::text,
  to_jsonb(coalesce(native_id,''))::text,to_jsonb(coalesce(reference,''))::text
 ],'|'),'UTF8')),'hex');
$$;
CREATE FUNCTION public.finance_can_classify(org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT public.can_execute_capability_for_org(org,'financial.allocation.edit') AND EXISTS(
 SELECT 1 FROM public.eco_organization_module_entitlements WHERE organization_id=org AND module_key='bancos' AND is_enabled);
$$;
CREATE FUNCTION public.rpc_confirm_bank_statement_import(requested_organization_id uuid, bank_account_id uuid,
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
  SELECT * INTO matched FROM public.eco_classification_rules r WHERE r.organization_id=requested_organization_id AND r.is_active
   AND (r.source_account_id IS NULL OR r.source_account_id=acc.id)
   AND (r.match_sign='ALL' OR (r.match_sign='POSITIVE' AND amt>0) OR (r.match_sign='NEGATIVE' AND amt<0))
   AND strpos(upper(m->>'description'),upper(btrim(r.pattern)))>0 ORDER BY r.priority,r.created_at,r.id LIMIT 1;
  INSERT INTO public.eco_movement_allocations(organization_id,movement_id,monto,category_id,subcategory_id,counterparty_id,classification_status,classification_source)
  VALUES(requested_organization_id,mid,amt,matched.target_category_id,matched.target_subcategory_id,matched.target_counterparty_id,
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

CREATE FUNCTION public.rpc_update_bank_allocation(requested_organization_id uuid, allocation_id uuid, patch jsonb)
RETURNS public.eco_movement_allocations LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result public.eco_movement_allocations%ROWTYPE; mid uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.finance_can_classify(requested_organization_id) THEN RAISE EXCEPTION 'Classification denied' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(patch) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(patch) k WHERE k NOT IN('category_id','subcategory_id','counterparty_id','notes','classification_status')) THEN RAISE EXCEPTION 'Invalid classification patch'; END IF;
 SELECT movement_id INTO STRICT mid FROM public.eco_movement_allocations WHERE id=allocation_id AND organization_id=requested_organization_id;
 PERFORM 1 FROM public.eco_financial_movements WHERE id=mid AND organization_id=requested_organization_id AND status='ACTIVE' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Movement unavailable'; END IF;
 UPDATE public.eco_movement_allocations a SET
 category_id=CASE WHEN patch ? 'category_id' THEN (patch->>'category_id')::uuid ELSE a.category_id END,
 subcategory_id=CASE WHEN patch ? 'subcategory_id' THEN (patch->>'subcategory_id')::uuid WHEN patch ? 'category_id' THEN NULL ELSE a.subcategory_id END,
 counterparty_id=CASE WHEN patch ? 'counterparty_id' THEN (patch->>'counterparty_id')::uuid ELSE a.counterparty_id END,
 notes=CASE WHEN patch ? 'notes' THEN patch->>'notes' ELSE a.notes END,
 classification_status=coalesce(patch->>'classification_status','CONFIRMED'),classification_source='MANUAL',updated_at=now()
 WHERE a.id=allocation_id AND a.organization_id=requested_organization_id RETURNING * INTO STRICT result;
 RETURN result;
END; $$;
CREATE FUNCTION public.rpc_split_bank_movement(requested_organization_id uuid, movement_id uuid, allocations jsonb)
RETURNS SETOF public.eco_movement_allocations LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE original numeric; total numeric:=0; item jsonb; amount numeric;
BEGIN
 IF auth.uid() IS NULL OR NOT public.finance_can_classify(requested_organization_id) THEN RAISE EXCEPTION 'Split denied' USING ERRCODE='42501'; END IF;
 SELECT monto INTO STRICT original FROM public.eco_financial_movements m WHERE m.id=movement_id AND m.organization_id=requested_organization_id AND m.status='ACTIVE' FOR UPDATE;
 IF jsonb_typeof(allocations) IS DISTINCT FROM 'array' OR jsonb_array_length(allocations) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid allocations'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(allocations) LOOP
  amount:=public.finance_money(item->>'monto');
  IF (original<0 AND amount>0) OR (original>0 AND amount<0) OR (original=0 AND amount<>0) THEN RAISE EXCEPTION 'Allocation sign mismatch'; END IF;
  total:=total+amount;
 END LOOP;
 IF total<>original THEN RAISE EXCEPTION 'Unbalanced split'; END IF;
 IF EXISTS(SELECT 1 FROM public.eco_movement_allocations a WHERE a.movement_id=rpc_split_bank_movement.movement_id AND a.organization_id=requested_organization_id AND a.reconciliation_status='CONFIRMED') THEN RAISE EXCEPTION 'Reconciled allocations require review before splitting'; END IF;
 DELETE FROM public.eco_movement_allocations a WHERE a.movement_id=rpc_split_bank_movement.movement_id AND a.organization_id=requested_organization_id;
 FOR item IN SELECT value FROM jsonb_array_elements(allocations) LOOP
  RETURN QUERY INSERT INTO public.eco_movement_allocations(organization_id,movement_id,monto,category_id,subcategory_id,counterparty_id,notes,classification_status,classification_source)
  VALUES(requested_organization_id,movement_id,public.finance_money(item->>'monto'),nullif(item->>'category_id','')::uuid,nullif(item->>'subcategory_id','')::uuid,nullif(item->>'counterparty_id','')::uuid,item->>'notes','CONFIRMED','MANUAL') RETURNING *;
 END LOOP;
END; $$;
CREATE FUNCTION public.rpc_apply_finance_rules(requested_organization_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a record; r public.eco_classification_rules%ROWTYPE; changed integer:=0;
BEGIN
 IF auth.uid() IS NULL OR NOT public.finance_can_classify(requested_organization_id) THEN RAISE EXCEPTION 'Rule application denied' USING ERRCODE='42501'; END IF;
 -- Lock facts first, as do the split/classification operations, to avoid stale suggestions.
 FOR a IN SELECT m.id,m.monto,m.descripcion,m.source_account_id FROM public.eco_financial_movements m
  WHERE m.organization_id=requested_organization_id AND m.status='ACTIVE' ORDER BY m.id FOR UPDATE LOOP
  IF (SELECT count(*) FROM public.eco_movement_allocations x WHERE x.movement_id=a.id)<>1 THEN CONTINUE; END IF;
  SELECT * INTO r FROM public.eco_classification_rules x WHERE x.organization_id=requested_organization_id AND x.is_active
   AND (x.source_account_id IS NULL OR x.source_account_id=a.source_account_id)
   AND (x.match_sign='ALL' OR (x.match_sign='POSITIVE' AND a.monto>0) OR (x.match_sign='NEGATIVE' AND a.monto<0))
   AND strpos(upper(a.descripcion),upper(btrim(x.pattern)))>0 ORDER BY x.priority,x.created_at,x.id LIMIT 1;
  IF r.id IS NOT NULL THEN
   UPDATE public.eco_movement_allocations SET category_id=r.target_category_id,subcategory_id=r.target_subcategory_id,counterparty_id=r.target_counterparty_id,
    classification_status='SUGGESTED',classification_source='RULE',updated_at=now()
   WHERE organization_id=requested_organization_id AND movement_id=a.id AND classification_status='PENDING' AND reconciliation_status='UNMATCHED';
   IF FOUND THEN changed:=changed+1; END IF;
  END IF;
 END LOOP;
 RETURN changed;
END; $$;
CREATE FUNCTION public.rpc_finance_soft_delete(requested_organization_id uuid, movement_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.finance_can_read(requested_organization_id) OR NOT public.can_execute_capability_for_org(requested_organization_id,'data.records.delete_soft') THEN RAISE EXCEPTION 'Delete denied' USING ERRCODE='42501'; END IF;
 UPDATE public.eco_financial_movements m SET status='SOFT_DELETED',deleted_at=now() WHERE m.id=movement_id AND m.organization_id=requested_organization_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Movement unavailable'; END IF;
END; $$;
CREATE FUNCTION public.rpc_finance_reconcile(requested_organization_id uuid, allocation_id uuid, target_movement_id uuid, reconciliation_type text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE mid uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.finance_can_read(requested_organization_id) OR NOT public.can_execute_capability_for_org(requested_organization_id,'financial.reconciliation.confirm') THEN RAISE EXCEPTION 'Reconciliation denied' USING ERRCODE='42501'; END IF;
 SELECT movement_id INTO STRICT mid FROM public.eco_movement_allocations WHERE id=allocation_id AND organization_id=requested_organization_id;
 PERFORM 1 FROM public.eco_financial_movements WHERE id=mid AND organization_id=requested_organization_id AND status='ACTIVE' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Movement unavailable'; END IF;
 IF reconciliation_type IS NOT NULL AND reconciliation_type NOT IN('INTERNAL_TRANSFER','CARD_SETTLEMENT') THEN RAISE EXCEPTION 'Invalid reconciliation type'; END IF;
 UPDATE public.eco_movement_allocations a SET reconciliation_status=CASE WHEN rpc_finance_reconcile.reconciliation_type IS NULL THEN 'UNMATCHED' ELSE 'CONFIRMED' END,
 reconciled_movement_id=target_movement_id,reconciliation_type=rpc_finance_reconcile.reconciliation_type,
 is_internal_transfer=coalesce(rpc_finance_reconcile.reconciliation_type='INTERNAL_TRANSFER',false),is_card_settlement=coalesce(rpc_finance_reconcile.reconciliation_type='CARD_SETTLEMENT',false),updated_at=now()
 WHERE a.id=allocation_id AND a.organization_id=requested_organization_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Allocation unavailable'; END IF;
END; $$;
CREATE FUNCTION public.finance_can_read(org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT public.core_is_org_member(org) AND EXISTS(SELECT 1 FROM public.eco_organization_module_entitlements WHERE organization_id=org AND module_key='bancos' AND is_enabled);
$$;

ALTER TABLE public.eco_financial_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eco_financial_accounts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.eco_financial_accounts TO authenticated;
GRANT ALL ON public.eco_financial_accounts TO service_role;
CREATE POLICY finance_tenant_read ON public.eco_financial_accounts FOR SELECT TO authenticated USING(public.finance_can_read(organization_id));

ALTER TABLE public.eco_tax_categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eco_tax_categories FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.eco_tax_categories TO authenticated;
GRANT ALL ON public.eco_tax_categories TO service_role;
CREATE POLICY finance_tenant_read ON public.eco_tax_categories FOR SELECT TO authenticated USING(public.finance_can_read(organization_id));

ALTER TABLE public.eco_tax_subcategories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eco_tax_subcategories FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.eco_tax_subcategories TO authenticated;
GRANT ALL ON public.eco_tax_subcategories TO service_role;
CREATE POLICY finance_tenant_read ON public.eco_tax_subcategories FOR SELECT TO authenticated USING(public.finance_can_read(organization_id));

ALTER TABLE public.eco_counterparties ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eco_counterparties FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.eco_counterparties TO authenticated;
GRANT ALL ON public.eco_counterparties TO service_role;
CREATE POLICY finance_tenant_read ON public.eco_counterparties FOR SELECT TO authenticated USING(public.finance_can_read(organization_id));

ALTER TABLE public.eco_source_imports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eco_source_imports FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.eco_source_imports TO authenticated;
GRANT ALL ON public.eco_source_imports TO service_role;
CREATE POLICY finance_tenant_read ON public.eco_source_imports FOR SELECT TO authenticated USING(public.finance_can_read(organization_id));

ALTER TABLE public.eco_source_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eco_source_files FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.eco_source_files TO authenticated;
GRANT ALL ON public.eco_source_files TO service_role;
CREATE POLICY finance_tenant_read ON public.eco_source_files FOR SELECT TO authenticated USING(public.finance_can_read(organization_id));

ALTER TABLE public.eco_import_rows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eco_import_rows FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.eco_import_rows TO authenticated;
GRANT ALL ON public.eco_import_rows TO service_role;
CREATE POLICY finance_tenant_read ON public.eco_import_rows FOR SELECT TO authenticated USING(public.finance_can_read(organization_id));

ALTER TABLE public.eco_financial_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eco_financial_movements FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.eco_financial_movements TO authenticated;
GRANT ALL ON public.eco_financial_movements TO service_role;
CREATE POLICY finance_tenant_read ON public.eco_financial_movements FOR SELECT TO authenticated USING(public.finance_can_read(organization_id));

ALTER TABLE public.eco_movement_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eco_movement_allocations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.eco_movement_allocations TO authenticated;
GRANT ALL ON public.eco_movement_allocations TO service_role;
CREATE POLICY finance_tenant_read ON public.eco_movement_allocations FOR SELECT TO authenticated USING(public.finance_can_read(organization_id));

ALTER TABLE public.eco_classification_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eco_classification_rules FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.eco_classification_rules TO authenticated;
GRANT ALL ON public.eco_classification_rules TO service_role;
CREATE POLICY finance_tenant_read ON public.eco_classification_rules FOR SELECT TO authenticated USING(public.finance_can_read(organization_id));
GRANT INSERT,UPDATE,DELETE ON public.eco_financial_accounts TO authenticated;
CREATE POLICY finance_catalog_write ON public.eco_financial_accounts FOR ALL TO authenticated USING(public.can_execute_capability_for_org(organization_id,'STATEMENTS_IMPORT_CONFIRM')) WITH CHECK(public.can_execute_capability_for_org(organization_id,'STATEMENTS_IMPORT_CONFIRM'));
GRANT INSERT,UPDATE,DELETE ON public.eco_tax_categories TO authenticated;
CREATE POLICY finance_catalog_write ON public.eco_tax_categories FOR ALL TO authenticated USING(public.finance_can_classify(organization_id)) WITH CHECK(public.finance_can_classify(organization_id));
GRANT INSERT,UPDATE,DELETE ON public.eco_tax_subcategories TO authenticated;
CREATE POLICY finance_catalog_write ON public.eco_tax_subcategories FOR ALL TO authenticated USING(public.finance_can_classify(organization_id)) WITH CHECK(public.finance_can_classify(organization_id));
GRANT INSERT,UPDATE,DELETE ON public.eco_counterparties TO authenticated;
CREATE POLICY finance_catalog_write ON public.eco_counterparties FOR ALL TO authenticated USING(public.finance_can_classify(organization_id)) WITH CHECK(public.finance_can_classify(organization_id));
GRANT INSERT,UPDATE,DELETE ON public.eco_classification_rules TO authenticated;
CREATE POLICY finance_catalog_write ON public.eco_classification_rules FOR ALL TO authenticated USING(public.finance_can_classify(organization_id)) WITH CHECK(public.finance_can_classify(organization_id));
REVOKE ALL ON FUNCTION public.finance_money(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finance_fingerprint(uuid,date,date,numeric,text,numeric,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finance_can_classify(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_can_classify(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.finance_can_read(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_can_read(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_confirm_bank_statement_import(uuid,uuid,text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_confirm_bank_statement_import(uuid,uuid,text,text,jsonb,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_update_bank_allocation(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_update_bank_allocation(uuid,uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_split_bank_movement(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_split_bank_movement(uuid,uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_apply_finance_rules(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_apply_finance_rules(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_finance_soft_delete(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_finance_soft_delete(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_finance_reconcile(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_finance_reconcile(uuid,uuid,uuid,text) TO authenticated;

COMMIT;
