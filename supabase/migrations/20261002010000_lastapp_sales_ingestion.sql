-- WP-SALES-002. Unapplied; Master owns shared DEV deployment.
BEGIN;
ALTER TABLE public.sales_imports ADD CONSTRAINT sales_imports_id_org UNIQUE(id,organization_id);
ALTER TABLE public.sales ADD CONSTRAINT sales_id_org UNIQUE(id,organization_id);
ALTER TABLE public.sales ADD CONSTRAINT sales_unit_tenant_fk FOREIGN KEY(operational_unit_id,organization_id)
  REFERENCES public.eco_operational_units(id,organization_id);
ALTER TABLE public.sales ADD CONSTRAINT sales_import_tenant_fk FOREIGN KEY(sales_import_id,organization_id)
  REFERENCES public.sales_imports(id,organization_id);
ALTER TABLE public.sale_lines ADD CONSTRAINT lines_sale_tenant_fk FOREIGN KEY(sale_id,organization_id)
  REFERENCES public.sales(id,organization_id) ON DELETE CASCADE;
ALTER TABLE public.sale_lines ADD COLUMN source_facts jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.sale_lines ADD CONSTRAINT lines_parent_scope UNIQUE(id,sale_id,organization_id);
ALTER TABLE public.sale_lines ADD CONSTRAINT lines_parent_scope_fk FOREIGN KEY(parent_line_id,sale_id,organization_id)
  REFERENCES public.sale_lines(id,sale_id,organization_id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE public.sales_location_mappings (
  organization_id uuid NOT NULL REFERENCES public.eco_organizations(id),
  external_location_id uuid NOT NULL, external_organization_id uuid NOT NULL,
  operational_unit_id uuid NOT NULL, currency text NOT NULL CHECK(currency='EUR'),
  is_active boolean NOT NULL DEFAULT true,
  PRIMARY KEY(organization_id,external_location_id),
  FOREIGN KEY(operational_unit_id,organization_id) REFERENCES public.eco_operational_units(id,organization_id)
);
CREATE TABLE public.sales_product_mappings (
  organization_id uuid NOT NULL REFERENCES public.eco_organizations(id),
  external_location_id uuid NOT NULL, external_product_id text NOT NULL,
  status text NOT NULL CHECK(status IN ('MAPPED','UNMAPPED','IGNORED')), product_id uuid,
  PRIMARY KEY(organization_id,external_location_id,external_product_id),
  FOREIGN KEY(organization_id,external_location_id) REFERENCES public.sales_location_mappings(organization_id,external_location_id),
  CHECK((status='MAPPED')=(product_id IS NOT NULL))
);
CREATE TABLE public.sales_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
  external_location_id uuid NOT NULL, operational_unit_id uuid NOT NULL,
  source_system text NOT NULL DEFAULT 'LAST_APP' CHECK(source_system='LAST_APP'),
  mode text NOT NULL CHECK(mode IN ('BACKFILL','RECONCILIATION','WEBHOOK')),
  requested_start timestamptz, requested_end timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
  pages_fetched int NOT NULL DEFAULT 0, records_fetched int NOT NULL DEFAULT 0,
  created int NOT NULL DEFAULT 0, updated int NOT NULL DEFAULT 0, unchanged int NOT NULL DEFAULT 0,
  rejected int NOT NULL DEFAULT 0, unmapped_products int NOT NULL DEFAULT 0,
  status text NOT NULL CHECK(status IN ('PROCESSING','COMPLETED','PARTIAL','FAILED')),
  error_summary text, event_id text,
  UNIQUE(id,organization_id),
  FOREIGN KEY(organization_id,external_location_id) REFERENCES public.sales_location_mappings(organization_id,external_location_id),
  FOREIGN KEY(operational_unit_id,organization_id) REFERENCES public.eco_operational_units(id,organization_id)
);
ALTER TABLE public.sales ADD COLUMN external_location_id uuid;
ALTER TABLE public.sales ADD COLUMN external_sale_id uuid;
ALTER TABLE public.sales ADD COLUMN sync_run_id uuid;
ALTER TABLE public.sales ADD COLUMN source_observed_at timestamptz;
ALTER TABLE public.sales ADD COLUMN source_adapter_version text;
ALTER TABLE public.sales ADD COLUMN source_fingerprint text;
ALTER TABLE public.sales ADD CONSTRAINT sales_sync_tenant_fk FOREIGN KEY(sync_run_id,organization_id) REFERENCES public.sales_sync_runs(id,organization_id);
ALTER TABLE public.sales ADD CONSTRAINT api_identity_complete CHECK(source_system<>'LAST_APP' OR
  (external_location_id IS NOT NULL AND external_sale_id IS NOT NULL AND sync_run_id IS NOT NULL AND sales_import_id IS NULL));
CREATE UNIQUE INDEX sales_api_identity ON public.sales(organization_id,source_system,external_location_id,external_sale_id) WHERE external_sale_id IS NOT NULL;
CREATE TABLE public.sales_source_bills (
  organization_id uuid NOT NULL, sale_id uuid NOT NULL, external_bill_id uuid NOT NULL,
  facts jsonb NOT NULL, PRIMARY KEY(sale_id,external_bill_id),
  FOREIGN KEY(sale_id,organization_id) REFERENCES public.sales(id,organization_id) ON DELETE CASCADE
);
CREATE TABLE public.sales_lastapp_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
  external_location_id uuid NOT NULL, source_event_id text NOT NULL,
  event_type text NOT NULL, external_tab_id uuid NOT NULL,
  source_created_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz, lease_until timestamptz, attempts int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'RECEIVED' CHECK(status IN ('RECEIVED','PROCESSING','PROCESSED','FAILED')),
  error_summary text, payload_hash text NOT NULL,
  UNIQUE(organization_id,source_event_id),
  FOREIGN KEY(organization_id,external_location_id) REFERENCES public.sales_location_mappings(organization_id,external_location_id)
);
CREATE INDEX sales_inbox_pending ON public.sales_lastapp_inbox(organization_id,status,received_at);
-- Durable Sales-local change feed; Analytics owns consumption/projections.
CREATE TABLE public.sales_changes (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id uuid NOT NULL,
  sale_id uuid NOT NULL, changed_at timestamptz NOT NULL DEFAULT now(), sync_run_id uuid,
  FOREIGN KEY(sale_id,organization_id) REFERENCES public.sales(id,organization_id)
);
DO $$ DECLARE t text; cap text; BEGIN
  FOREACH t IN ARRAY ARRAY['sales_location_mappings','sales_product_mappings','sales_sync_runs','sales_source_bills','sales_lastapp_inbox','sales_changes'] LOOP
    cap := CASE WHEN t IN ('sales_location_mappings','sales_product_mappings') THEN 'integrations.config.manage' ELSE 'sales.view' END;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated',t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
    EXECUTE format('CREATE POLICY sales_authorized_read ON public.%I FOR SELECT TO authenticated USING(public.can_execute_capability_for_org(organization_id,%L))',t,cap);
  END LOOP;
END $$;
GRANT USAGE,SELECT ON SEQUENCE public.sales_changes_sequence_seq TO service_role;

-- Called only by the authenticated server application after the current Core gate.
-- Serializes observations per identity, and commits header/lines/bills/change feed together.
CREATE FUNCTION public.sales_persist_canonical(p_sale jsonb, p_lines jsonb DEFAULT NULL, p_bills jsonb DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE org uuid := (p_sale->>'organizationId')::uuid; sale_uuid uuid;
  previous public.sales%ROWTYPE; l jsonb; b jsonb; outcome text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(org::text || ':' || (p_sale->>'externalIdentityKey'),0));
  SELECT * INTO previous FROM public.sales WHERE organization_id=org AND external_identity_key=p_sale->>'externalIdentityKey' FOR UPDATE;
  sale_uuid := coalesce(previous.id,(p_sale->>'id')::uuid);
  IF previous.id IS NOT NULL AND previous.source_observed_at > (p_sale->>'sourceObservedAt')::timestamptz THEN RETURN 'unchanged'; END IF;
  IF previous.id IS NOT NULL AND previous.source_fingerprint IS NOT NULL AND previous.source_fingerprint=p_sale->>'sourceFingerprint' THEN
    UPDATE public.sales SET source_observed_at=(p_sale->>'sourceObservedAt')::timestamptz,
      sync_run_id=(p_sale->>'syncRunId')::uuid WHERE id=sale_uuid;
    RETURN 'unchanged';
  END IF;
  outcome := CASE WHEN previous.id IS NULL THEN 'created' ELSE 'updated' END;
  INSERT INTO public.sales(id,organization_id,operational_unit_id,sales_import_id,source_system,export_type,
    source_location,external_ticket_code,external_invoice_number,external_identity_key,external_identity_algorithm,
    occurred_at,source_channel,source_payment_method,total,paid_amount,currency,status,raw_payload,
    external_location_id,external_sale_id,sync_run_id,source_observed_at,source_adapter_version,source_fingerprint)
  VALUES(sale_uuid,org,nullif(p_sale->>'operationalUnitId','')::uuid,nullif(p_sale->>'salesImportId','')::uuid,
    p_sale->>'sourceSystem',p_sale->>'exportType',p_sale->>'sourceLocation',p_sale->>'externalTicketCode',
    p_sale->>'externalInvoiceNumber',p_sale->>'externalIdentityKey',p_sale->>'externalIdentityAlgorithm',
    (p_sale->>'occurredAt')::timestamptz,p_sale->>'sourceChannel',p_sale->>'sourcePaymentMethod',
    (p_sale->>'total')::numeric,(p_sale->>'paidAmount')::numeric,p_sale->>'currency',p_sale->>'status',coalesce(p_sale->'rawPayload','{}'),
    (p_sale->>'externalLocationId')::uuid,(p_sale->>'externalSaleId')::uuid,(p_sale->>'syncRunId')::uuid,
    (p_sale->>'sourceObservedAt')::timestamptz,p_sale->>'sourceAdapterVersion',p_sale->>'sourceFingerprint')
  ON CONFLICT(organization_id,external_identity_key) DO UPDATE SET
    total=excluded.total,paid_amount=excluded.paid_amount,source_channel=excluded.source_channel,
    source_payment_method=excluded.source_payment_method,occurred_at=excluded.occurred_at,status=excluded.status,
    raw_payload=excluded.raw_payload,updated_at=now(),sync_run_id=excluded.sync_run_id,
    source_observed_at=excluded.source_observed_at,source_adapter_version=excluded.source_adapter_version,source_fingerprint=excluded.source_fingerprint;
  IF p_lines IS NOT NULL AND jsonb_typeof(p_lines)<>'null' THEN
    DELETE FROM public.sale_lines WHERE sale_id=sale_uuid AND organization_id=org;
    FOR l IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
      IF l->>'organizationId'<>org::text THEN RAISE EXCEPTION 'line tenant mismatch'; END IF;
      INSERT INTO public.sale_lines(id,organization_id,sale_id,line_index,depth,parent_line_id,raw_text,display_text,quantity,item_type,notes,catalog_product_id,source_facts)
      VALUES((l->>'id')::uuid,org,sale_uuid,(l->>'lineIndex')::int,(l->>'depth')::int,(l->>'parentLineId')::uuid,
        l->>'rawText',l->>'displayText',(l->>'quantity')::numeric,l->>'itemType',l->>'notes',
        (l->>'catalogProductId')::uuid,coalesce(l->'sourceFacts','{}'));
    END LOOP;
  END IF;
  IF p_bills IS NOT NULL THEN
    DELETE FROM public.sales_source_bills WHERE sale_id=sale_uuid;
    FOR b IN SELECT value FROM jsonb_array_elements(p_bills) LOOP
      INSERT INTO public.sales_source_bills VALUES(org,sale_uuid,(b->>'id')::uuid,b);
    END LOOP;
  END IF;
  INSERT INTO public.sales_changes(organization_id,sale_id,sync_run_id) VALUES(org,sale_uuid,(p_sale->>'syncRunId')::uuid);
  RETURN outcome;
END $$;
REVOKE ALL ON FUNCTION public.sales_persist_canonical(jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sales_persist_canonical(jsonb,jsonb,jsonb) TO service_role;

CREATE FUNCTION public.sales_claim_lastapp_event(p_org uuid,p_id uuid)
RETURNS SETOF public.sales_lastapp_inbox LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
  UPDATE public.sales_lastapp_inbox SET status='PROCESSING',lease_until=now()+interval '5 minutes',attempts=attempts+1
  WHERE id=p_id AND organization_id=p_org AND
    (status IN ('RECEIVED','FAILED') OR (status='PROCESSING' AND lease_until<now())) RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.sales_claim_lastapp_event(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sales_claim_lastapp_event(uuid,uuid) TO service_role;
COMMIT;
