-- WP-SALES-002-R1. Master-controlled deployment; no Core changes.
BEGIN;
ALTER TABLE public.sales_sync_runs DROP CONSTRAINT sales_sync_runs_status_check;
ALTER TABLE public.sales_sync_runs ADD CONSTRAINT sales_sync_runs_status_check
  CHECK(status IN ('PROCESSING','CONTINUABLE','COMPLETED','PARTIAL','FAILED'));
ALTER TABLE public.sales_sync_runs ADD COLUMN next_offset int NOT NULL DEFAULT 0 CHECK(next_offset>=0);
ALTER TABLE public.sales_sync_runs ADD COLUMN pending_tab_ids text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.sales_sync_runs ADD COLUMN source_exhausted boolean NOT NULL DEFAULT false;
ALTER TABLE public.sales_sync_runs ADD COLUMN continuation_version bigint NOT NULL DEFAULT 0 CHECK(continuation_version>=0);
ALTER TABLE public.sales_sync_runs ADD COLUMN slice_lease uuid;
ALTER TABLE public.sales_sync_runs ADD COLUMN slice_lease_until timestamptz;
ALTER TABLE public.sales_sync_runs ADD COLUMN checkpoint_enabled boolean NOT NULL DEFAULT true;
-- Pre-R1 observations have no trustworthy checkpoint; preserve their evidence and rerun as a new logical window.
UPDATE public.sales_sync_runs SET checkpoint_enabled=false;
-- Old terminal runs did not retain pending pages. Recover them by starting a new window.
UPDATE public.sales_sync_runs SET source_exhausted=true WHERE status IN ('COMPLETED','PARTIAL');

CREATE FUNCTION public.sales_sync_scope_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN
  IF ROW(NEW.organization_id,NEW.external_location_id,NEW.operational_unit_id,NEW.requested_start,NEW.requested_end,NEW.mode,NEW.event_id,NEW.checkpoint_enabled)
    IS DISTINCT FROM ROW(OLD.organization_id,OLD.external_location_id,OLD.operational_unit_id,OLD.requested_start,OLD.requested_end,OLD.mode,OLD.event_id,OLD.checkpoint_enabled)
  THEN RAISE EXCEPTION 'sync scope is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sales_sync_scope_immutable BEFORE UPDATE ON public.sales_sync_runs FOR EACH ROW EXECUTE FUNCTION public.sales_sync_scope_immutable();

CREATE FUNCTION public.sales_claim_sync_slice(p_org uuid,p_run uuid,p_version bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r public.sales_sync_runs%ROWTYPE;
BEGIN
  IF p_version IS NULL OR p_version<0 THEN RAISE EXCEPTION 'invalid sync version'; END IF;
  SELECT * INTO r FROM public.sales_sync_runs WHERE id=p_run AND organization_id=p_org AND mode<>'WEBHOOK' AND checkpoint_enabled FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'sync not found'; END IF;
  IF r.continuation_version<>p_version OR r.status IN ('COMPLETED','PARTIAL') OR
    (r.slice_lease_until>now()) THEN RETURN jsonb_build_object('claimed',false,'run',to_jsonb(r)); END IF;
  UPDATE public.sales_sync_runs SET slice_lease=gen_random_uuid(),slice_lease_until=now()+interval '5 minutes',
    status='PROCESSING',error_summary=NULL,completed_at=NULL WHERE id=r.id RETURNING * INTO r;
  RETURN jsonb_build_object('claimed',true,'run',to_jsonb(r));
END $$;

CREATE FUNCTION public.sales_save_sync_page(p_org uuid,p_run uuid,p_lease uuid,p_ids text[],p_offset int,p_exhausted boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r public.sales_sync_runs%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.sales_sync_runs WHERE id=p_run AND organization_id=p_org FOR UPDATE;
  IF NOT FOUND OR p_lease IS NULL OR r.slice_lease_until IS NULL OR r.slice_lease IS DISTINCT FROM p_lease OR r.slice_lease_until<=now() OR r.status<>'PROCESSING' THEN RAISE EXCEPTION 'sync lease lost'; END IF;
  IF cardinality(r.pending_tab_ids)>0 OR r.source_exhausted OR p_ids IS NULL OR p_offset<>r.next_offset+cardinality(p_ids)
    OR cardinality(p_ids)>100 OR EXISTS(SELECT 1 FROM unnest(p_ids) id WHERE id IS NULL OR id='')
    OR cardinality(p_ids)<>(SELECT count(DISTINCT id) FROM unnest(p_ids) id)
  THEN RAISE EXCEPTION 'invalid sync page'; END IF;
  UPDATE public.sales_sync_runs SET pending_tab_ids=p_ids,next_offset=p_offset,source_exhausted=p_exhausted,
    pages_fetched=pages_fetched+1,continuation_version=continuation_version+1 WHERE id=r.id RETURNING * INTO r;
  RETURN to_jsonb(r);
END $$;

CREATE FUNCTION public.sales_commit_sync_tab(p_org uuid,p_run uuid,p_lease uuid,p_tab text,p_sale jsonb,p_lines jsonb,p_bills jsonb,p_unmapped int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r public.sales_sync_runs%ROWTYPE; outcome text;
BEGIN
  SELECT * INTO r FROM public.sales_sync_runs WHERE id=p_run AND organization_id=p_org FOR UPDATE;
  IF NOT FOUND OR p_lease IS NULL OR r.slice_lease_until IS NULL OR r.slice_lease IS DISTINCT FROM p_lease OR r.slice_lease_until<=now() OR r.status<>'PROCESSING' THEN RAISE EXCEPTION 'sync lease lost'; END IF;
  IF r.pending_tab_ids[1] IS DISTINCT FROM p_tab OR p_tab IS NULL OR p_unmapped<0 THEN RAISE EXCEPTION 'sync Tab mismatch'; END IF;
  IF p_sale IS NOT NULL THEN
    IF (p_sale->>'organizationId')::uuid IS DISTINCT FROM p_org OR (p_sale->>'syncRunId')::uuid IS DISTINCT FROM p_run
      OR (p_sale->>'externalLocationId')::uuid IS DISTINCT FROM r.external_location_id
      OR (p_sale->>'operationalUnitId')::uuid IS DISTINCT FROM r.operational_unit_id
      OR p_sale->>'externalSaleId' IS DISTINCT FROM p_tab THEN RAISE EXCEPTION 'sync observation scope mismatch'; END IF;
    outcome:=public.sales_persist_canonical(p_sale,p_lines,p_bills);
  ELSE outcome:='rejected'; END IF;
  UPDATE public.sales_sync_runs SET pending_tab_ids=coalesce(pending_tab_ids[2:cardinality(pending_tab_ids)],'{}'),
    records_fetched=records_fetched+1,created=created+CASE WHEN outcome='created' THEN 1 ELSE 0 END,
    updated=updated+CASE WHEN outcome='updated' THEN 1 ELSE 0 END,unchanged=unchanged+CASE WHEN outcome='unchanged' THEN 1 ELSE 0 END,
    rejected=rejected+CASE WHEN outcome='rejected' THEN 1 ELSE 0 END,unmapped_products=unmapped_products+coalesce(p_unmapped,0),
    continuation_version=continuation_version+1 WHERE id=r.id RETURNING * INTO r;
  RETURN to_jsonb(r);
END $$;

CREATE FUNCTION public.sales_finish_sync_slice(p_org uuid,p_run uuid,p_lease uuid,p_failed boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r public.sales_sync_runs%ROWTYPE; finished boolean;
BEGIN
  SELECT * INTO r FROM public.sales_sync_runs WHERE id=p_run AND organization_id=p_org FOR UPDATE;
  IF NOT FOUND OR p_lease IS NULL OR r.slice_lease_until IS NULL OR r.slice_lease IS DISTINCT FROM p_lease OR r.slice_lease_until<=now() OR r.status<>'PROCESSING' THEN RAISE EXCEPTION 'sync lease lost'; END IF;
  finished:=r.source_exhausted AND cardinality(r.pending_tab_ids)=0;
  UPDATE public.sales_sync_runs SET status=CASE WHEN p_failed THEN 'FAILED' WHEN NOT finished THEN 'CONTINUABLE'
      WHEN rejected>0 THEN 'PARTIAL' ELSE 'COMPLETED' END,
    completed_at=CASE WHEN finished AND NOT p_failed THEN now() ELSE NULL END,
    error_summary=CASE WHEN p_failed THEN 'SOURCE_SYNC_FAILED' ELSE NULL END,
    slice_lease=NULL,slice_lease_until=NULL,continuation_version=continuation_version+1
    WHERE id=r.id RETURNING * INTO r;
  RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.sales_sync_scope_immutable() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sales_claim_sync_slice(uuid,uuid,bigint),public.sales_save_sync_page(uuid,uuid,uuid,text[],int,boolean),
  public.sales_commit_sync_tab(uuid,uuid,uuid,text,jsonb,jsonb,jsonb,int),public.sales_finish_sync_slice(uuid,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sales_claim_sync_slice(uuid,uuid,bigint),public.sales_save_sync_page(uuid,uuid,uuid,text[],int,boolean),
  public.sales_commit_sync_tab(uuid,uuid,uuid,text,jsonb,jsonb,jsonb,int),public.sales_finish_sync_slice(uuid,uuid,uuid,boolean) TO service_role;
COMMIT;
