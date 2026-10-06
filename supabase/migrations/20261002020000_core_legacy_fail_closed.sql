-- Historical operational relations have no organization ownership column.
-- Membership/capability checks cannot safely infer a tenant for their rows.
-- Preserve all data; close browser access until each module has an owned contract.
BEGIN;
DO $$
DECLARE relation text;
BEGIN
 FOREACH relation IN ARRAY ARRAY['extractos','categorias','subcategorias','proveedores','empleados','fichajes','incidencias','recetas','produccion_registros'] LOOP
  IF to_regclass('public.'||relation) IS NOT NULL THEN
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',relation);
   EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated',relation);
   EXECUTE format('CREATE POLICY core_legacy_no_tenant_no_access ON public.%I AS RESTRICTIVE FOR ALL TO authenticated,anon USING(false) WITH CHECK(false)',relation);
  END IF;
 END LOOP;
END; $$;
COMMIT;
