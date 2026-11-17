-- WP-FIN-005 PROPOSAL ONLY. Master reviews/applies; never executed against shared DEV here.
-- Existing tables, catalog FKs, movement immutability and RLS remain unchanged.
BEGIN;
CREATE FUNCTION public.finance_merchant_pattern(description text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path=pg_catalog AS $$
 SELECT btrim(regexp_replace(regexp_replace(string_agg(regexp_replace(btrim(regexp_replace(upper(translate(part,
 'áéíóúüñàèìòùäëïöâêîôûçÁÉÍÓÚÜÑÀÈÌÒÙÄËÏÖÂÊÎÔÛÇ',
 'aeiouunaeiouaeioaeioucAEIOUUNAEIOUAEIOAEIOUC')),'[^A-Z0-9]+',' ','g')),
 '(?: (?:REF|REFERENCIA))? [0-9]{3,}(?: [0-9]{3,})*$',''),' ' ORDER BY ordinal),
 ' +',' ','g'),'^(?:(?:PAGO|PAGOS|COMPRA|COMPRAS|TARJETA|POS) )+',''))
 FROM regexp_split_to_table(description,'[·\n]') WITH ORDINALITY AS pieces(part,ordinal)
$$;
REVOKE ALL ON FUNCTION public.finance_merchant_pattern(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finance_merchant_pattern(text) TO authenticated;
CREATE FUNCTION public.rpc_review_finance_patterns(requested_organization_id uuid,operation text,reviews jsonb DEFAULT '[]',interpretation jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n integer; expected integer; keys integer; changed integer; bank public.eco_financial_movements; card public.eco_financial_movements; ba public.eco_movement_allocations; ca public.eco_movement_allocations;
BEGIN
 IF auth.uid() IS NULL OR NOT public.finance_can_classify(requested_organization_id) THEN RAISE EXCEPTION 'Classification denied' USING ERRCODE='42501';END IF;
 IF operation IS NULL OR operation NOT IN ('REVIEW','RECOGNIZE','SETTLEMENT') OR jsonb_typeof(reviews) IS DISTINCT FROM 'array' OR jsonb_typeof(interpretation) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid pattern request';END IF;
 -- The same movement lock is used by existing manual classification/split RPCs.
 -- Lock history before evaluating it, so concurrent human edits cannot introduce a hidden conflict.
 PERFORM 1 FROM public.eco_financial_movements m WHERE m.organization_id=requested_organization_id AND m.status='ACTIVE' ORDER BY m.id FOR UPDATE;
 IF operation='RECOGNIZE' THEN
  WITH sizes AS MATERIALIZED(SELECT movement_id,count(*) n FROM public.eco_movement_allocations WHERE organization_id=requested_organization_id GROUP BY movement_id),
  base AS MATERIALIZED(
   SELECT m.id mid,m.currency,m.source_account_id,m.monto,m.duplicate_status,m.financial_fingerprint,
    a.id aid,a.classification_status,a.classification_source,a.economic_type,a.category_id,a.subcategory_id,a.counterparty_id,
    jsonb_build_array(m.currency,upper(acc.institution),acc.product_type,sign(m.monto),public.finance_merchant_pattern(m.descripcion)) key
   FROM public.eco_financial_movements m JOIN public.eco_financial_accounts acc ON acc.id=m.source_account_id AND acc.organization_id=m.organization_id AND acc.is_active
   JOIN public.eco_movement_allocations a ON a.movement_id=m.id AND a.organization_id=m.organization_id JOIN sizes ON sizes.movement_id=m.id AND sizes.n=1
   WHERE m.organization_id=requested_organization_id AND m.status='ACTIVE' AND a.transfer_candidate_id IS NULL AND a.reconciliation_status='UNMATCHED'
   AND upper(m.descripcion) !~ '^(PAGO (DE )?(TARJETAS?|VISA|MASTERCARD)|INGRESO DESDE CUENTA|ABONO CUENTA|CARGO CUENTA)\M'
   AND length(public.finance_merchant_pattern(m.descripcion))>=3
   AND public.finance_merchant_pattern(m.descripcion) !~ '\m(TRANSFERENCIA|TRASPASO|PRESTAMO|FINANCIACION|CREDITO|LIQUIDACION|INGRESO DESDE CUENTA|PAGO DE TARJETA)\M'),
  history AS MATERIALIZED(
   SELECT key,count(DISTINCT financial_fingerprint) examples,count(DISTINCT jsonb_build_array(economic_type,category_id,subcategory_id,counterparty_id)) tuples,
    (jsonb_agg(jsonb_build_object('type',economic_type,'category',category_id,'subcategory',subcategory_id,'party',counterparty_id))->0) tuple
   FROM base WHERE classification_status='CONFIRMED' AND classification_source='MANUAL' AND economic_type NOT IN ('UNCLASSIFIED','INTERNAL_TRANSFER','CARD_SETTLEMENT') AND duplicate_status='UNIQUE' GROUP BY key),
  eligible AS MATERIALIZED(
   SELECT b.aid,h.tuple,CASE WHEN h.examples>=2 AND h.tuple->>'type' IN ('OPERATING_INCOME','OPERATING_EXPENSE','OTHER_NON_OPERATING')
    AND h.tuple->>'category' IS NOT NULL AND h.tuple->>'subcategory' IS NOT NULL AND h.tuple->>'party' IS NOT NULL AND b.duplicate_status='UNIQUE' THEN 'CONFIRMED' ELSE 'SUGGESTED' END status
   FROM base b JOIN history h ON h.key=b.key AND h.tuples=1 WHERE ((b.classification_status='PENDING' AND b.economic_type='UNCLASSIFIED' AND b.category_id IS NULL AND b.subcategory_id IS NULL AND b.counterparty_id IS NULL) OR (b.classification_status='SUGGESTED' AND b.classification_source='RULE' AND h.examples>=2 AND h.tuple->>'type' IN ('OPERATING_INCOME','OPERATING_EXPENSE','OTHER_NON_OPERATING') AND h.tuple->>'category' IS NOT NULL AND h.tuple->>'subcategory' IS NOT NULL AND h.tuple->>'party' IS NOT NULL AND b.duplicate_status='UNIQUE' AND jsonb_build_object('type',b.economic_type,'category',b.category_id,'subcategory',b.subcategory_id,'party',b.counterparty_id)=h.tuple)) ORDER BY b.mid LIMIT 2000),
  updated AS(UPDATE public.eco_movement_allocations a SET economic_type=(e.tuple->>'type')::public.finance_economic_type,
   category_id=(e.tuple->>'category')::uuid,subcategory_id=(e.tuple->>'subcategory')::uuid,counterparty_id=(e.tuple->>'party')::uuid,
   classification_status=e.status,classification_source='RULE',updated_at=clock_timestamp()
   FROM eligible e WHERE a.id=e.aid AND a.organization_id=requested_organization_id RETURNING a.classification_status)
  SELECT jsonb_build_object('suggested',count(*) FILTER(WHERE classification_status='SUGGESTED'),'recognized',count(*) FILTER(WHERE classification_status='CONFIRMED'),'limit',2000) INTO interpretation FROM updated;
  RETURN interpretation;
 END IF;
 expected:=jsonb_array_length(reviews);
 IF expected NOT BETWEEN 1 AND 1000 OR (SELECT count(DISTINCT r->>'id') FROM jsonb_array_elements(reviews) r)<>expected THEN RAISE EXCEPTION 'Select 1 to 1000 distinct current allocations';END IF;
 WITH sizes AS MATERIALIZED(SELECT movement_id,count(*) n FROM public.eco_movement_allocations WHERE organization_id=requested_organization_id GROUP BY movement_id)
 SELECT count(*),count(DISTINCT jsonb_build_array(m.currency,acc.institution,acc.product_type,sign(m.monto),public.finance_merchant_pattern(m.descripcion))) INTO n,keys
 FROM public.eco_movement_allocations a JOIN public.eco_financial_movements m ON m.id=a.movement_id AND m.organization_id=a.organization_id
 JOIN public.eco_financial_accounts acc ON acc.id=m.source_account_id AND acc.organization_id=m.organization_id AND acc.is_active
 JOIN sizes ON sizes.movement_id=m.id AND sizes.n=1
 JOIN jsonb_array_elements(reviews) r ON a.id=(r->>'id')::uuid AND a.updated_at=(r->>'updated_at')::timestamptz
 WHERE a.organization_id=requested_organization_id AND m.status='ACTIVE' AND a.classification_status IN ('PENDING','SUGGESTED') AND a.transfer_candidate_id IS NULL AND a.reconciliation_status='UNMATCHED';
 IF n<>expected THEN RAISE EXCEPTION 'Group changed or requires individual review; reload';END IF;
 IF operation='REVIEW' THEN
  IF keys<>1 OR interpretation->>'economic_type' NOT IN ('OPERATING_INCOME','OPERATING_EXPENSE','FINANCING_INFLOW','FINANCING_OUTFLOW','OTHER_NON_OPERATING') OR interpretation->>'economic_type' IS NULL THEN RAISE EXCEPTION 'Review one coherent pattern and select its economic type';END IF;
  UPDATE public.eco_movement_allocations a SET economic_type=(interpretation->>'economic_type')::public.finance_economic_type,
   category_id=nullif(interpretation->>'category_id','')::uuid,subcategory_id=nullif(interpretation->>'subcategory_id','')::uuid,counterparty_id=nullif(interpretation->>'counterparty_id','')::uuid,
   classification_status='CONFIRMED',classification_source='MANUAL',is_card_settlement=false,is_internal_transfer=false,updated_at=clock_timestamp()
   FROM jsonb_array_elements(reviews) r WHERE a.id=(r->>'id')::uuid AND a.organization_id=requested_organization_id;
  GET DIAGNOSTICS changed=ROW_COUNT;RETURN jsonb_build_object('confirmed',changed);
 END IF;
 IF expected<>2 OR NOT public.can_execute_capability_for_org(requested_organization_id,'financial.reconciliation.confirm') THEN RAISE EXCEPTION 'Paired settlement review denied' USING ERRCODE='42501';END IF;
 SELECT m.* INTO STRICT bank FROM public.eco_financial_movements m JOIN public.eco_financial_accounts acc ON acc.id=m.source_account_id JOIN public.eco_movement_allocations a ON a.movement_id=m.id JOIN jsonb_array_elements(reviews) r ON a.id=(r->>'id')::uuid WHERE m.organization_id=requested_organization_id AND acc.product_type='BANK_ACCOUNT' AND m.monto<0;
 SELECT m.* INTO STRICT card FROM public.eco_financial_movements m JOIN public.eco_financial_accounts acc ON acc.id=m.source_account_id JOIN public.eco_movement_allocations a ON a.movement_id=m.id JOIN jsonb_array_elements(reviews) r ON a.id=(r->>'id')::uuid WHERE m.organization_id=requested_organization_id AND acc.product_type='CARD' AND m.monto>0;
 IF bank.monto<>-card.monto OR bank.currency<>card.currency OR abs(bank.fecha-card.fecha)>5 OR bank.duplicate_status<>'UNIQUE' OR card.duplicate_status<>'UNIQUE'
 OR (SELECT institution FROM public.eco_financial_accounts WHERE id=bank.source_account_id)<>(SELECT institution FROM public.eco_financial_accounts WHERE id=card.source_account_id)
 OR upper(bank.descripcion) !~ '\m(PAGO|LIQUIDACI.N|CARGO|RECIBO|CUOTA)\M.*\m(TARJETAS?|VISA|MASTERCARD)\M' OR upper(card.descripcion) !~ '(INGRESO DESDE CUENTA|PAGO DE TARJETA|ABONO CUENTA|CARGO CUENTA)' THEN RAISE EXCEPTION 'Insufficient settlement evidence';END IF;
 -- Explicit reciprocal links reuse the existing reconciliation model; never fabricate transfer candidates.
 UPDATE public.eco_movement_allocations a SET category_id=NULL,subcategory_id=NULL,counterparty_id=NULL,economic_type='CARD_SETTLEMENT',classification_status='CONFIRMED',classification_source='MANUAL',reconciliation_status='CONFIRMED',reconciliation_type='CARD_SETTLEMENT',is_card_settlement=true,is_internal_transfer=false,
 reconciled_movement_id=CASE WHEN a.movement_id=bank.id THEN card.id ELSE bank.id END,updated_at=clock_timestamp()
 WHERE a.organization_id=requested_organization_id AND a.movement_id IN (bank.id,card.id);
 RETURN jsonb_build_object('settled',2);
END $$;
REVOKE ALL ON FUNCTION public.rpc_review_finance_patterns(uuid,text,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_review_finance_patterns(uuid,text,jsonb,jsonb) TO authenticated;
-- Optional documentary metadata; canonical identity inputs stay byte-for-byte unchanged.
CREATE FUNCTION public.finance_import_provenance(p jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $provenance$
DECLARE k text;
BEGIN
 IF p IS NULL THEN RETURN '{}';END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) x WHERE x NOT IN ('bankCode','office','originalCurrency','originalFxAmount','fxDetail')) THEN RAISE EXCEPTION 'Invalid minimized provenance';END IF;
 FOR k IN SELECT jsonb_object_keys(p) LOOP
  IF k='originalFxAmount' THEN
   IF jsonb_typeof(p->k)<>'number' OR public.finance_money(p->>k)<0 THEN RAISE EXCEPTION 'Invalid original FX amount';END IF;
  ELSIF jsonb_typeof(p->k)<>'string' OR length(p->>k)>(CASE WHEN k='fxDetail' THEN 400 ELSE 40 END) THEN RAISE EXCEPTION 'Invalid minimized provenance value';
  END IF;
 END LOOP;
 IF p ? 'originalCurrency' AND p->>'originalCurrency' !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Invalid original currency';END IF;
 RETURN p;
END $provenance$;
REVOKE ALL ON FUNCTION public.finance_import_provenance(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finance_import_provenance(jsonb) TO authenticated;
DO $extend_import$
DECLARE definition text;anchor text:='jsonb_build_object(''sourceRowNumber'',(m->>''sourceRowNumber'')::integer)';
BEGIN
 SELECT pg_get_functiondef('public.rpc_confirm_bank_statement_import(uuid,uuid,text,text,jsonb,jsonb)'::regprocedure) INTO definition;
 IF (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>2 OR position('finance_import_provenance' IN definition)>0 THEN RAISE EXCEPTION 'FINANCE_IMPORT_CONTRACT_MISMATCH';END IF;
 EXECUTE replace(definition,anchor,anchor||' || public.finance_import_provenance(m->''provenance'')');
END $extend_import$;
-- Protect reciprocal card-settlement links through the existing mutation APIs too.
CREATE FUNCTION public.finance_settlement_locked(org uuid,mid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $locked$
 SELECT public.finance_can_read(org) AND EXISTS(
  SELECT 1 FROM public.eco_movement_allocations a JOIN public.eco_movement_allocations b ON b.movement_id=a.reconciled_movement_id AND b.organization_id=a.organization_id AND b.reconciled_movement_id=a.movement_id
  WHERE a.organization_id=org AND a.movement_id=mid AND a.economic_type='CARD_SETTLEMENT' AND b.economic_type='CARD_SETTLEMENT' AND a.reconciliation_status='CONFIRMED' AND b.reconciliation_status='CONFIRMED')
$locked$;
REVOKE ALL ON FUNCTION public.finance_settlement_locked(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finance_settlement_locked(uuid,uuid) TO authenticated;
DO $protect_pairs$
DECLARE signature text;definition text;anchor text:=' IF EXISTS(SELECT 1 FROM public.eco_movement_allocations';guard text;
BEGIN
 FOREACH signature IN ARRAY ARRAY['public.rpc_update_bank_allocation(uuid,uuid,jsonb)','public.rpc_finance_reconcile(uuid,uuid,uuid,text)','public.rpc_finance_soft_delete(uuid,uuid)'] LOOP
  SELECT pg_get_functiondef(signature::regprocedure) INTO definition;
  IF position(anchor IN definition)=0 OR position('finance_settlement_locked' IN definition)>0 THEN RAISE EXCEPTION 'FINANCE_PAIR_CONTRACT_MISMATCH';END IF;
  guard:=' IF public.finance_settlement_locked(requested_organization_id, '||CASE WHEN signature LIKE '%soft_delete%' THEN 'rpc_finance_soft_delete.movement_id' ELSE 'mid' END||') THEN RAISE EXCEPTION ''Linked card settlement interpretation is protected''; END IF;'||chr(10);
  -- Insert once, immediately after the existing movement lock, before existing guards.
  definition:=overlay(definition placing guard from position(anchor IN definition) for 0);
  EXECUTE definition;
 END LOOP;
END $protect_pairs$;
COMMIT;
