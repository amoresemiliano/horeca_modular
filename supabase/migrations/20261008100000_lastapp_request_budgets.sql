-- WP-SALES-006. MASTER-CONTROLLED: prepare here; do not apply from the module WP.
BEGIN;
CREATE TABLE public.sales_lastapp_request_budgets (
  token_hash text NOT NULL CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  bucket_kind text NOT NULL CHECK (bucket_kind IN ('location','organization','organizations')),
  entity_key text NOT NULL,
  next_allowed_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (token_hash,bucket_kind,entity_key)
);
ALTER TABLE public.sales_lastapp_request_budgets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sales_lastapp_request_budgets FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.sales_reserve_lastapp_request(p_token_hash text,p_kind text,p_entity text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public SET lock_timeout = '500ms' AS $$
DECLARE current_time_value timestamptz; eligible timestamptz; spacing interval;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' OR p_kind IS NULL
    OR p_kind NOT IN ('location','organization','organizations') OR p_entity IS NULL
    OR (p_kind='organizations' AND p_entity<>'*')
    OR (p_kind<>'organizations' AND p_entity !~ '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$') THEN
    RAISE EXCEPTION 'INVALID_RATE_BUCKET';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sales_lastapp_request_budgets WHERE token_hash=p_token_hash AND bucket_kind=p_kind AND entity_key=p_entity) THEN
    -- Serialize only creation/eviction; independent existing entities use row locks.
    PERFORM pg_advisory_xact_lock(20261008,1000);
    current_time_value := clock_timestamp();
    DELETE FROM public.sales_lastapp_request_budgets WHERE (token_hash,bucket_kind,entity_key) IN
      (SELECT token_hash,bucket_kind,entity_key FROM public.sales_lastapp_request_budgets
       WHERE updated_at < current_time_value - interval '10 minutes' LIMIT 128);
    IF (SELECT count(*) FROM public.sales_lastapp_request_budgets)>=4096
      AND NOT EXISTS (SELECT 1 FROM public.sales_lastapp_request_budgets WHERE token_hash=p_token_hash AND bucket_kind=p_kind AND entity_key=p_entity) THEN
      RAISE EXCEPTION 'RATE_BUCKET_CAPACITY';
    END IF;
    INSERT INTO public.sales_lastapp_request_budgets VALUES(p_token_hash,p_kind,p_entity,current_time_value,current_time_value)
      ON CONFLICT DO NOTHING;
  END IF;
  SELECT next_allowed_at INTO eligible FROM public.sales_lastapp_request_budgets
    WHERE token_hash=p_token_hash AND bucket_kind=p_kind AND entity_key=p_entity FOR UPDATE;
  current_time_value := clock_timestamp();
  IF eligible > current_time_value THEN
    RETURN jsonb_build_object('allowed',false,'retry_after_ms',ceil(extract(epoch FROM eligible-current_time_value)*1000));
  END IF;
  -- Permits expire at the client within 1000ms, including RPC round-trip.
  -- 402ms pacing: at most 5 starts/second and 1496/rolling 10min even with 1s dispatch jitter.
  -- 2000ms discovery pacing: actual /organizations starts remain >=1000ms apart.
  spacing := CASE WHEN p_kind='organizations' THEN interval '2000 milliseconds' ELSE interval '402 milliseconds' END;
  UPDATE public.sales_lastapp_request_budgets SET next_allowed_at=current_time_value+spacing,updated_at=current_time_value
    WHERE token_hash=p_token_hash AND bucket_kind=p_kind AND entity_key=p_entity;
  RETURN jsonb_build_object('allowed',true,'retry_after_ms',0);
END;
$$;
REVOKE ALL ON FUNCTION public.sales_reserve_lastapp_request(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sales_reserve_lastapp_request(text,text,text) TO service_role;
COMMIT;
