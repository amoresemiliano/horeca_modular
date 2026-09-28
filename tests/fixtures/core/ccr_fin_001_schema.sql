-- Isolated test prerequisites, NOT a migration or a reconstruction of the live schema.
-- Core columns follow the 20260903/12/13 migrations. Organization/profile base DDL is
-- unversioned, so only their consumed contract is represented here. No Finance tables.
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
GRANT USAGE ON SCHEMA auth TO authenticated, anon;

CREATE TABLE public.eco_organizations (id uuid PRIMARY KEY, is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.eco_user_profiles (id uuid PRIMARY KEY, auth_user_id uuid UNIQUE NOT NULL, is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.eco_role_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL, is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.eco_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL, scope text NOT NULL,
  description text, is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.eco_role_template_capabilities (
  role_template_id uuid REFERENCES public.eco_role_templates(id),
  capability_id uuid REFERENCES public.eco_capabilities(id), UNIQUE(role_template_id, capability_id)
);
CREATE TABLE public.eco_organization_members (
  id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES public.eco_organizations(id),
  user_profile_id uuid NOT NULL REFERENCES public.eco_user_profiles(id), user_id uuid REFERENCES public.eco_user_profiles(id),
  role_template_id uuid REFERENCES public.eco_role_templates(id),
  is_active boolean NOT NULL DEFAULT true, is_organization_wide boolean NOT NULL DEFAULT true,
  UNIQUE(organization_id, user_profile_id)
);
CREATE TABLE public.eco_operational_units (
  id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES public.eco_organizations(id), is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.eco_membership_operational_unit_scopes (
  membership_id uuid REFERENCES public.eco_organization_members(id), operational_unit_id uuid REFERENCES public.eco_operational_units(id),
  UNIQUE(membership_id, operational_unit_id)
);
CREATE TABLE public.eco_member_capability_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), membership_id uuid REFERENCES public.eco_organization_members(id),
  capability_id uuid REFERENCES public.eco_capabilities(id), effect text CHECK(effect IN ('GRANT','REVOKE')),
  operational_unit_id uuid REFERENCES public.eco_operational_units(id),
  UNIQUE(membership_id, capability_id, operational_unit_id)
);
CREATE TABLE public.eco_organization_module_entitlements (
  organization_id uuid REFERENCES public.eco_organizations(id), module_key text NOT NULL, is_enabled boolean NOT NULL,
  UNIQUE(organization_id, module_key)
);
INSERT INTO public.eco_role_templates(code) VALUES
  ('OWNER'), ('MANAGER'), ('ADMINISTRATIVE'), ('EXTERNAL_ACCOUNTANT'), ('CONSULTANT'), ('VEGEN_PLATFORM_ADMIN'),
  ('HOLDING_OWNER'), ('HOLDING_ADMIN'), ('PURCHASING'), ('RECEPTION_FLOOR'), ('PRODUCTION'), ('COOK_COST_SHEET_MANAGER'), ('HR_PERSONNEL');
-- Reproduce the legacy permissive policy shape to prove the restrictive migration
-- stops self-escalation even when browser table/column write privileges exist.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eco_user_profiles, public.eco_organization_members TO authenticated;
CREATE POLICY legacy_profiles ON public.eco_user_profiles FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY legacy_memberships ON public.eco_organization_members FOR ALL TO authenticated USING(true) WITH CHECK(true);
