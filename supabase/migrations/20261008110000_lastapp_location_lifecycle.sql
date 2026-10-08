-- WP-SALES-007. Forward only; Master applies after review. No business data backfill.
BEGIN;
CREATE TABLE public.sales_lastapp_location_receipts (
  source_event_id text PRIMARY KEY CHECK(length(source_event_id) BETWEEN 1 AND 200),
  event_type text NOT NULL CHECK(event_type IN ('location:integrated','location:desintegrated')),
  source_created_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  external_location_id uuid NOT NULL, external_organization_id uuid,
  external_integration_id uuid, external_integrator_id uuid,
  location_name text CHECK(length(location_name)<=300), organization_name text CHECK(length(organization_name)<=300),
  payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$')
);
CREATE TABLE public.sales_lastapp_location_lifecycle (
  external_location_id uuid PRIMARY KEY, external_organization_id uuid,
  external_integration_id uuid, external_integrator_id uuid,
  location_name text, organization_name text,
  provider_state text NOT NULL CHECK(provider_state IN ('INTEGRATED','DESINTEGRATED')),
  review_state text NOT NULL CHECK(review_state IN ('PENDING_MAPPING','PAUSED')),
  last_source_created_at timestamptz NOT NULL,
  last_source_event_id text NOT NULL REFERENCES public.sales_lastapp_location_receipts(source_event_id),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX sales_location_receipts_history ON public.sales_lastapp_location_receipts(external_location_id,source_created_at);
ALTER TABLE public.sales_lastapp_location_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_lastapp_location_lifecycle ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sales_lastapp_location_receipts,public.sales_lastapp_location_lifecycle FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.sales_lastapp_location_receipts,public.sales_lastapp_location_lifecycle TO service_role;

CREATE FUNCTION public.sales_receive_lastapp_location_event(p_event jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog SET lock_timeout='2s' AS $$
DECLARE
  event_id text:=p_event->>'source_event_id'; kind text:=p_event->>'event_type';
  location_id uuid:=(p_event->>'external_location_id')::uuid;
  provider_org uuid:=(p_event->>'external_organization_id')::uuid;
  integration_id uuid:=(p_event->>'external_integration_id')::uuid;
  integrator_id uuid:=(p_event->>'external_integrator_id')::uuid;
  created_at timestamptz:=(p_event->>'source_created_at')::timestamptz;
  content_hash text:=p_event->>'payload_hash'; previous_hash text;
BEGIN
  IF jsonb_typeof(p_event)<>'object' OR event_id IS NULL OR length(event_id) NOT BETWEEN 1 AND 200
    OR event_id<>btrim(event_id) OR kind IS NULL OR kind NOT IN ('location:integrated','location:desintegrated')
    OR location_id IS NULL OR created_at IS NULL OR content_hash IS NULL OR content_hash !~ '^[a-f0-9]{64}$'
    OR (integrator_id IS NOT NULL AND integrator_id<>'ae7fb926-7f70-4bec-a9b7-1003121a4675'::uuid)
    OR length(p_event->>'location_name')>300 OR length(p_event->>'organization_name')>300 THEN
    RAISE EXCEPTION 'INVALID_LOCATION_EVENT';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('lastapp-location:'||location_id::text,0));
  SELECT payload_hash INTO previous_hash FROM public.sales_lastapp_location_receipts WHERE source_event_id=event_id;
  IF FOUND THEN
    IF previous_hash<>content_hash THEN RAISE EXCEPTION 'CONFLICTING_LOCATION_EVENT'; END IF;
    RETURN 'duplicate';
  END IF;
  IF provider_org IS NOT NULL AND EXISTS(SELECT 1 FROM public.sales_location_mappings
    WHERE external_location_id=location_id AND external_organization_id<>provider_org) THEN
    RAISE EXCEPTION 'LOCATION_ORGANIZATION_MISMATCH';
  END IF;
  INSERT INTO public.sales_lastapp_location_receipts(source_event_id,event_type,source_created_at,
    external_location_id,external_organization_id,external_integration_id,external_integrator_id,location_name,organization_name,payload_hash)
    VALUES(event_id,kind,created_at,location_id,provider_org,integration_id,integrator_id,p_event->>'location_name',p_event->>'organization_name',content_hash);
  INSERT INTO public.sales_lastapp_location_lifecycle AS existing(external_location_id,external_organization_id,
    external_integration_id,external_integrator_id,location_name,organization_name,provider_state,review_state,last_source_created_at,last_source_event_id)
    VALUES(location_id,provider_org,integration_id,integrator_id,p_event->>'location_name',p_event->>'organization_name',
      CASE WHEN kind='location:integrated' THEN 'INTEGRATED' ELSE 'DESINTEGRATED' END,
      CASE WHEN kind='location:integrated' THEN 'PENDING_MAPPING' ELSE 'PAUSED' END,created_at,event_id)
    ON CONFLICT(external_location_id) DO UPDATE SET
      external_organization_id=CASE WHEN (excluded.last_source_created_at,excluded.last_source_event_id)>(existing.last_source_created_at,existing.last_source_event_id) THEN excluded.external_organization_id ELSE existing.external_organization_id END,
      external_integration_id=CASE WHEN (excluded.last_source_created_at,excluded.last_source_event_id)>(existing.last_source_created_at,existing.last_source_event_id) THEN excluded.external_integration_id ELSE existing.external_integration_id END,
      external_integrator_id=CASE WHEN (excluded.last_source_created_at,excluded.last_source_event_id)>(existing.last_source_created_at,existing.last_source_event_id) THEN excluded.external_integrator_id ELSE existing.external_integrator_id END,
      location_name=CASE WHEN (excluded.last_source_created_at,excluded.last_source_event_id)>(existing.last_source_created_at,existing.last_source_event_id) THEN excluded.location_name ELSE existing.location_name END,
      organization_name=CASE WHEN (excluded.last_source_created_at,excluded.last_source_event_id)>(existing.last_source_created_at,existing.last_source_event_id) THEN excluded.organization_name ELSE existing.organization_name END,
      provider_state=CASE WHEN (excluded.last_source_created_at,excluded.last_source_event_id)>(existing.last_source_created_at,existing.last_source_event_id) THEN excluded.provider_state ELSE existing.provider_state END,
      review_state=CASE WHEN existing.review_state='PAUSED' OR excluded.review_state='PAUSED' THEN 'PAUSED' ELSE 'PENDING_MAPPING' END,
      last_source_created_at=greatest(existing.last_source_created_at,excluded.last_source_created_at),
      last_source_event_id=CASE WHEN (excluded.last_source_created_at,excluded.last_source_event_id)>(existing.last_source_created_at,existing.last_source_event_id) THEN excluded.last_source_event_id ELSE existing.last_source_event_id END,
      updated_at=clock_timestamp();
  IF kind='location:desintegrated' THEN
    UPDATE public.sales_location_mappings SET is_active=false WHERE external_location_id=location_id AND is_active;
  END IF;
  RETURN 'received';
END;
$$;
REVOKE ALL ON FUNCTION public.sales_receive_lastapp_location_event(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sales_receive_lastapp_location_event(jsonb) TO service_role;

-- Fence canonical commits from a sync already in flight when de-integration arrives.
-- Existing historical Sales, CSV ingestion and all canonical field contracts remain unchanged.
CREATE FUNCTION public.sales_guard_lastapp_location() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE state text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('lastapp-location:'||NEW.external_location_id::text,0));
  SELECT review_state INTO state FROM public.sales_lastapp_location_lifecycle
    WHERE external_location_id=NEW.external_location_id FOR SHARE;
  IF state='PAUSED' THEN RAISE EXCEPTION 'LASTAPP_LOCATION_PAUSED'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sales_guard_lastapp_location() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sales_lastapp_location_guard BEFORE INSERT OR UPDATE ON public.sales
  FOR EACH ROW WHEN (NEW.source_system='LAST_APP') EXECUTE FUNCTION public.sales_guard_lastapp_location();
COMMIT;
