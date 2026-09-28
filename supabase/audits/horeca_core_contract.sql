-- Deterministic, data-free Core schema/registry contract. Compare hosted results
-- with an embedded PostgreSQL replay of the same two canonical migrations.
WITH core AS (
 SELECT c.oid,c.relname,c.relrowsecurity FROM pg_class c
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r' AND c.relname LIKE 'eco_%'
), sections AS (
 SELECT 'tables' AS section, jsonb_agg(jsonb_build_object('name',relname,'rls',relrowsecurity) ORDER BY relname) AS value FROM core
 UNION ALL SELECT 'columns', jsonb_agg(to_jsonb(x) ORDER BY table_name,ordinal_position) FROM (
  SELECT table_name,ordinal_position,column_name,udt_name,is_nullable,column_default,is_generated,generation_expression
  FROM information_schema.columns WHERE table_schema='public' AND table_name IN(SELECT relname FROM core)
 ) x
 UNION ALL SELECT 'constraints', jsonb_agg(to_jsonb(x) ORDER BY table_name,name) FROM (
  SELECT c.relname AS table_name,k.conname AS name,k.contype::text AS type,pg_get_constraintdef(k.oid) AS definition
  -- PG18 catalogs NOT NULL as constraints; PG17 exposes it in columns only.
  -- Nullability is already compared above, so normalize that catalog difference.
  FROM pg_constraint k JOIN core c ON c.oid=k.conrelid WHERE k.contype <> 'n'
 ) x
 UNION ALL SELECT 'policies', jsonb_agg(to_jsonb(x) ORDER BY tablename,policyname) FROM (
  SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies
  WHERE schemaname='public' AND tablename IN(SELECT relname FROM core)
 ) x
 UNION ALL SELECT 'grants',jsonb_agg(to_jsonb(x) ORDER BY table_name,grantee,privilege_type) FROM (
  SELECT table_name,grantee,privilege_type FROM information_schema.role_table_grants
  WHERE table_schema='public' AND table_name IN(SELECT relname FROM core)
   AND grantee IN('anon','authenticated','PUBLIC','service_role')
 ) x
 UNION ALL SELECT 'functions',jsonb_agg(to_jsonb(x) ORDER BY name) FROM (
  SELECT p.proname AS name,pg_get_function_identity_arguments(p.oid) AS args,
   p.prosecdef AS security_definer,p.provolatile::text AS volatility,p.proconfig AS settings,p.prosrc AS body
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
   AND p.proname IN('core_is_org_member','core_can_read_unit','can_execute_capability_for_org')
 ) x
 UNION ALL SELECT 'roles',jsonb_agg(to_jsonb(x) ORDER BY code COLLATE "C") FROM (
  SELECT code,name,tier,is_active FROM public.eco_role_templates
 ) x
 -- Explicit collation keeps mixed-case wire codes identical across server locales.
 UNION ALL SELECT 'capabilities',jsonb_agg(to_jsonb(x) ORDER BY code COLLATE "C") FROM (
  SELECT code,scope,is_active,to_jsonb(c)->>'required_module_key' AS required_module_key FROM public.eco_capabilities c
 ) x
 UNION ALL SELECT 'role_defaults',jsonb_agg(to_jsonb(x) ORDER BY role COLLATE "C",capability COLLATE "C") FROM (
  SELECT r.code AS role,c.code AS capability FROM public.eco_role_template_capabilities rc
  JOIN public.eco_role_templates r ON r.id=rc.role_template_id JOIN public.eco_capabilities c ON c.id=rc.capability_id
 ) x
)
SELECT jsonb_object_agg(section,value) AS contract FROM sections;
