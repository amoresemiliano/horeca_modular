-- Authored 2026-09-28. Version orders this prerequisite before the approved CCR.
-- Clean HORECA Core only. Intentionally fails if a Core relation already exists.
-- Does not alter auth.users or any legacy operational table; seeds no tenants.
BEGIN;

CREATE TABLE public.eco_user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  display_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.eco_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (length(btrim(code)) > 0),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  legal_name text,
  trade_name text,
  tax_id text,
  tax_id_type text NOT NULL DEFAULT 'CIF',
  country_code text NOT NULL DEFAULT 'ES' CHECK (country_code ~ '^[A-Z]{2}$'),
  currency text NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$'),
  timezone text NOT NULL DEFAULT 'Europe/Madrid',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.eco_role_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  tier text NOT NULL CHECK (tier IN ('PLATFORM','HOLDING','ORGANIZATION')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,tier)
);
CREATE TABLE public.eco_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (length(btrim(code)) > 0),
  scope text NOT NULL CHECK (scope IN ('PLATFORM','HOLDING','ORGANIZATION','OPERATIONAL_UNIT')),
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.eco_role_template_capabilities (
  role_template_id uuid NOT NULL REFERENCES public.eco_role_templates(id) ON DELETE RESTRICT,
  capability_id uuid NOT NULL REFERENCES public.eco_capabilities(id) ON DELETE RESTRICT,
  PRIMARY KEY (role_template_id,capability_id)
);
CREATE TABLE public.eco_operational_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.eco_organizations(id) ON DELETE RESTRICT,
  code text NOT NULL CHECK (length(btrim(code)) > 0),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  unit_type text NOT NULL CHECK (unit_type IN ('LOCAL','WAREHOUSE','PRODUCTION_CENTER','OTHER')),
  unit_subtype text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,code), UNIQUE (id,organization_id)
);
CREATE TABLE public.eco_organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.eco_organizations(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.eco_user_profiles(id) ON DELETE RESTRICT,
  -- Compatibility identity for the approved primitive; cannot contradict user_id.
  user_profile_id uuid GENERATED ALWAYS AS (user_id) STORED,
  role_template_id uuid,
  role_tier text NOT NULL DEFAULT 'ORGANIZATION' CHECK (role_tier = 'ORGANIZATION'),
  role text,
  operational_unit_id uuid,
  is_organization_wide boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (role_template_id,role_tier) REFERENCES public.eco_role_templates(id,tier) ON DELETE RESTRICT,
  FOREIGN KEY (operational_unit_id,organization_id) REFERENCES public.eco_operational_units(id,organization_id) ON DELETE RESTRICT,
  CHECK (NOT is_organization_wide OR operational_unit_id IS NULL),
  UNIQUE (organization_id,user_id), UNIQUE (id,organization_id)
);
CREATE TABLE public.eco_organization_module_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.eco_organizations(id) ON DELETE RESTRICT,
  module_key text NOT NULL CHECK (module_key ~ '^[a-z][a-z0-9_]*$'),
  is_enabled boolean NOT NULL DEFAULT false,
  plan_tier text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,module_key)
);
CREATE TABLE public.eco_member_capability_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  capability_id uuid NOT NULL REFERENCES public.eco_capabilities(id) ON DELETE RESTRICT,
  effect text NOT NULL CHECK (effect IN ('GRANT','REVOKE')),
  operational_unit_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (membership_id,organization_id) REFERENCES public.eco_organization_members(id,organization_id) ON DELETE RESTRICT,
  FOREIGN KEY (operational_unit_id,organization_id) REFERENCES public.eco_operational_units(id,organization_id) ON DELETE RESTRICT,
  UNIQUE NULLS NOT DISTINCT (membership_id,capability_id,effect,operational_unit_id)
);
CREATE TABLE public.eco_membership_operational_unit_scopes (
  membership_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  operational_unit_id uuid NOT NULL,
  PRIMARY KEY (membership_id,operational_unit_id),
  FOREIGN KEY (membership_id,organization_id) REFERENCES public.eco_organization_members(id,organization_id) ON DELETE RESTRICT,
  FOREIGN KEY (operational_unit_id,organization_id) REFERENCES public.eco_operational_units(id,organization_id) ON DELETE RESTRICT
);
-- Separate platform assignment is needed to represent/test platform authority
-- without fabricating tenant membership. It is never read by the tenant primitive.
CREATE TABLE public.eco_user_platform_role (
  user_profile_id uuid PRIMARY KEY REFERENCES public.eco_user_profiles(id) ON DELETE RESTRICT,
  role_template_id uuid NOT NULL,
  role_tier text NOT NULL DEFAULT 'PLATFORM' CHECK (role_tier = 'PLATFORM'),
  is_active boolean NOT NULL DEFAULT true,
  FOREIGN KEY (role_template_id,role_tier) REFERENCES public.eco_role_templates(id,tier) ON DELETE RESTRICT
);
CREATE INDEX ON public.eco_organization_members(user_id);
CREATE INDEX ON public.eco_member_capability_overrides(membership_id);

CREATE FUNCTION public.core_is_org_member(target_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT EXISTS (
  SELECT 1 FROM public.eco_organization_members m
  JOIN public.eco_user_profiles p ON p.id=m.user_id
  JOIN public.eco_organizations o ON o.id=m.organization_id
  JOIN public.eco_role_templates r ON r.id=m.role_template_id
  WHERE p.auth_user_id=auth.uid() AND m.organization_id=target_org
    AND p.is_active AND o.is_active AND m.is_active AND r.is_active AND r.tier='ORGANIZATION'
 );
$$;
CREATE FUNCTION public.core_can_read_unit(target_org uuid, target_unit uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT public.core_is_org_member(target_org) AND EXISTS (
  SELECT 1 FROM public.eco_organization_members m
  JOIN public.eco_user_profiles p ON p.id=m.user_id
  JOIN public.eco_operational_units u ON u.organization_id=m.organization_id AND u.id=target_unit
  WHERE p.auth_user_id=auth.uid() AND p.is_active AND m.is_active AND u.is_active
    AND m.organization_id=target_org AND (m.is_organization_wide OR EXISTS (
      SELECT 1 FROM public.eco_membership_operational_unit_scopes s
      WHERE s.membership_id=m.id AND s.operational_unit_id=u.id
    ))
 );
$$;
REVOKE ALL ON FUNCTION public.core_is_org_member(uuid), public.core_can_read_unit(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.core_is_org_member(uuid), public.core_can_read_unit(uuid,uuid) TO authenticated;

-- Explicit grants override permissive hosted default privileges. No browser writes.
DO $security$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['eco_user_profiles','eco_organizations','eco_role_templates',
  'eco_capabilities','eco_role_template_capabilities','eco_operational_units',
  'eco_organization_members','eco_organization_module_entitlements',
  'eco_member_capability_overrides','eco_membership_operational_unit_scopes','eco_user_platform_role']
 LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated',t);
  EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated',t);
  EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role',t);
 END LOOP;
END;
$security$;
CREATE POLICY core_profile_self_read ON public.eco_user_profiles FOR SELECT TO authenticated
 USING (auth_user_id=auth.uid() AND is_active);
CREATE POLICY core_org_member_read ON public.eco_organizations FOR SELECT TO authenticated
 USING (public.core_is_org_member(id));
CREATE POLICY core_membership_self_read ON public.eco_organization_members FOR SELECT TO authenticated
 USING (is_active AND public.core_is_org_member(organization_id) AND EXISTS (
  SELECT 1 FROM public.eco_user_profiles p WHERE p.id=user_id AND p.auth_user_id=auth.uid() AND p.is_active));
CREATE POLICY core_unit_scoped_read ON public.eco_operational_units FOR SELECT TO authenticated
 USING (public.core_can_read_unit(organization_id,id));
CREATE POLICY core_role_registry_read ON public.eco_role_templates FOR SELECT TO authenticated USING (is_active);
CREATE POLICY core_capability_registry_read ON public.eco_capabilities FOR SELECT TO authenticated USING (is_active);
CREATE POLICY core_role_grants_read ON public.eco_role_template_capabilities FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.eco_role_templates r WHERE r.id=role_template_id AND r.is_active)
 AND EXISTS (SELECT 1 FROM public.eco_capabilities c WHERE c.id=capability_id AND c.is_active));
CREATE POLICY core_entitlements_member_read ON public.eco_organization_module_entitlements FOR SELECT TO authenticated
 USING (public.core_is_org_member(organization_id));
CREATE POLICY core_overrides_self_read ON public.eco_member_capability_overrides FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.eco_organization_members m WHERE m.id=membership_id));
CREATE POLICY core_scopes_self_read ON public.eco_membership_operational_unit_scopes FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.eco_organization_members m WHERE m.id=membership_id));
CREATE POLICY core_platform_self_read ON public.eco_user_platform_role FOR SELECT TO authenticated
 USING (is_active AND EXISTS (SELECT 1 FROM public.eco_user_profiles p WHERE p.id=user_profile_id AND p.auth_user_id=auth.uid() AND p.is_active));

-- Canonical registry and role defaults are appended below from the reviewed
-- current TypeScript contract, using its exact wire codes (no legacy SQL aliases).

INSERT INTO public.eco_role_templates(code,name,tier) VALUES
('VEGEN_PLATFORM_ADMIN','Vegen Platform Admin','PLATFORM'),
('HOLDING_OWNER','Holding Owner','HOLDING'),
('HOLDING_ADMIN','Holding Admin','HOLDING'),
('OWNER','Owner','ORGANIZATION'),
('MANAGER','Manager','ORGANIZATION'),
('ADMINISTRATIVE','Administrative','ORGANIZATION'),
('PURCHASING','Purchasing','ORGANIZATION'),
('RECEPTION_FLOOR','Reception Floor','ORGANIZATION'),
('PRODUCTION','Production','ORGANIZATION'),
('COOK_COST_SHEET_MANAGER','Cook Cost Sheet Manager','ORGANIZATION'),
('HR_PERSONNEL','Hr Personnel','ORGANIZATION'),
('EXTERNAL_ACCOUNTANT','External Accountant','ORGANIZATION'),
('CONSULTANT','Consultant','ORGANIZATION');

INSERT INTO public.eco_capabilities(code,scope,description) VALUES
('platform.tenants.provision','PLATFORM','Platform tenants provision'),
('platform.system.monitor','PLATFORM','Platform system monitor'),
('platform.migrations.apply','PLATFORM','Platform migrations apply'),
('org.config.read','ORGANIZATION','Org config read'),
('org.config.write','ORGANIZATION','Org config write'),
('membership.users.invite','ORGANIZATION','Membership users invite'),
('membership.roles.assign','ORGANIZATION','Membership roles assign'),
('membership.users.remove','ORGANIZATION','Membership users remove'),
('opunit.manage','ORGANIZATION','Opunit manage'),
('opunit.assign_scope','ORGANIZATION','Opunit assign scope'),
('sales.view','ORGANIZATION','Sales view'),
('sales.tickets.read','ORGANIZATION','Sales tickets read'),
('sales.import.upload','ORGANIZATION','Sales import upload'),
('sales.import.process','ORGANIZATION','Sales import process'),
('suppliers.manage','ORGANIZATION','Suppliers manage'),
('purchases.order.create','ORGANIZATION','Purchases order create'),
('purchases.order.approve','ORGANIZATION','Purchases order approve'),
('purchases.reception.confirm','ORGANIZATION','Purchases reception confirm'),
('purchases.invoices.manage','ORGANIZATION','Purchases invoices manage'),
('catalog.products.read','ORGANIZATION','Catalog products read'),
('catalog.products.write','ORGANIZATION','Catalog products write'),
('catalog.pricing.manage','ORGANIZATION','Catalog pricing manage'),
('recipes.view','ORGANIZATION','Recipes view'),
('costsheets.view','ORGANIZATION','Costsheets view'),
('costsheets.edit','ORGANIZATION','Costsheets edit'),
('production.batch.log','OPERATIONAL_UNIT','Production batch log'),
('production.waste.log','OPERATIONAL_UNIT','Production waste log'),
('inventory.stock.view','OPERATIONAL_UNIT','Inventory stock view'),
('inventory.count.run','OPERATIONAL_UNIT','Inventory count run'),
('inventory.adjustment.confirm','OPERATIONAL_UNIT','Inventory adjustment confirm'),
('statements.import.upload','ORGANIZATION','Statements import upload'),
('statements.import.process','ORGANIZATION','Statements import process'),
('financial.reconciliation.review','ORGANIZATION','Financial reconciliation review'),
('financial.reconciliation.confirm','ORGANIZATION','Financial reconciliation confirm'),
('financial.allocation.edit','ORGANIZATION','Financial allocation edit'),
('documents.upload','ORGANIZATION','Documents upload'),
('documents.ocr.process','ORGANIZATION','Documents ocr process'),
('documents.ocr.verify','ORGANIZATION','Documents ocr verify'),
('personnel.employees.manage','ORGANIZATION','Personnel employees manage'),
('personnel.fichajes.write','ORGANIZATION','Personnel fichajes write'),
('personnel.fichajes.audit','ORGANIZATION','Personnel fichajes audit'),
('personnel.incidencias.manage','ORGANIZATION','Personnel incidencias manage'),
('reporting.operational.view','ORGANIZATION','Reporting operational view'),
('reporting.pnl.view','ORGANIZATION','Reporting pnl view'),
('reporting.tax_summary.view','ORGANIZATION','Reporting tax summary view'),
('integrations.config.manage','ORGANIZATION','Integrations config manage'),
('integrations.sync.trigger','ORGANIZATION','Integrations sync trigger'),
('data.records.delete_soft','ORGANIZATION','Data records delete soft'),
('data.records.purge_hard','PLATFORM','Data records purge hard'),
('data.records.restore','ORGANIZATION','Data records restore'),
('sensitivedata.salaries.read','ORGANIZATION','Sensitivedata salaries read'),
('sensitivedata.banking.read','ORGANIZATION','Sensitivedata banking read');

INSERT INTO public.eco_role_template_capabilities(role_template_id,capability_id)
SELECT r.id,c.id FROM (VALUES
('VEGEN_PLATFORM_ADMIN','platform.tenants.provision'),
('VEGEN_PLATFORM_ADMIN','platform.system.monitor'),
('VEGEN_PLATFORM_ADMIN','platform.migrations.apply'),
('VEGEN_PLATFORM_ADMIN','integrations.config.manage'),
('VEGEN_PLATFORM_ADMIN','data.records.purge_hard'),
('VEGEN_PLATFORM_ADMIN','data.records.restore'),
('HOLDING_OWNER','org.config.read'),
('HOLDING_OWNER','org.config.write'),
('HOLDING_OWNER','membership.users.invite'),
('HOLDING_OWNER','membership.roles.assign'),
('HOLDING_OWNER','reporting.operational.view'),
('HOLDING_OWNER','reporting.pnl.view'),
('HOLDING_OWNER','reporting.tax_summary.view'),
('HOLDING_OWNER','sales.view'),
('HOLDING_OWNER','sensitivedata.salaries.read'),
('HOLDING_OWNER','sensitivedata.banking.read'),
('HOLDING_ADMIN','org.config.read'),
('HOLDING_ADMIN','membership.users.invite'),
('HOLDING_ADMIN','reporting.operational.view'),
('HOLDING_ADMIN','reporting.pnl.view'),
('HOLDING_ADMIN','integrations.config.manage'),
('OWNER','org.config.read'),
('OWNER','org.config.write'),
('OWNER','membership.users.invite'),
('OWNER','membership.roles.assign'),
('OWNER','membership.users.remove'),
('OWNER','opunit.manage'),
('OWNER','opunit.assign_scope'),
('OWNER','sales.view'),
('OWNER','sales.tickets.read'),
('OWNER','sales.import.upload'),
('OWNER','sales.import.process'),
('OWNER','suppliers.manage'),
('OWNER','purchases.order.create'),
('OWNER','purchases.order.approve'),
('OWNER','purchases.reception.confirm'),
('OWNER','purchases.invoices.manage'),
('OWNER','catalog.products.read'),
('OWNER','catalog.products.write'),
('OWNER','catalog.pricing.manage'),
('OWNER','recipes.view'),
('OWNER','costsheets.view'),
('OWNER','costsheets.edit'),
('OWNER','production.batch.log'),
('OWNER','production.waste.log'),
('OWNER','inventory.stock.view'),
('OWNER','inventory.count.run'),
('OWNER','inventory.adjustment.confirm'),
('OWNER','statements.import.upload'),
('OWNER','statements.import.process'),
('OWNER','financial.reconciliation.review'),
('OWNER','financial.reconciliation.confirm'),
('OWNER','financial.allocation.edit'),
('OWNER','documents.upload'),
('OWNER','documents.ocr.process'),
('OWNER','documents.ocr.verify'),
('OWNER','personnel.employees.manage'),
('OWNER','personnel.fichajes.write'),
('OWNER','personnel.fichajes.audit'),
('OWNER','personnel.incidencias.manage'),
('OWNER','reporting.operational.view'),
('OWNER','reporting.pnl.view'),
('OWNER','reporting.tax_summary.view'),
('OWNER','integrations.config.manage'),
('OWNER','integrations.sync.trigger'),
('OWNER','data.records.delete_soft'),
('OWNER','data.records.purge_hard'),
('OWNER','data.records.restore'),
('OWNER','sensitivedata.salaries.read'),
('OWNER','sensitivedata.banking.read'),
('MANAGER','org.config.read'),
('MANAGER','sales.view'),
('MANAGER','sales.tickets.read'),
('MANAGER','sales.import.upload'),
('MANAGER','sales.import.process'),
('MANAGER','suppliers.manage'),
('MANAGER','purchases.order.create'),
('MANAGER','purchases.order.approve'),
('MANAGER','purchases.reception.confirm'),
('MANAGER','catalog.products.read'),
('MANAGER','catalog.products.write'),
('MANAGER','recipes.view'),
('MANAGER','costsheets.view'),
('MANAGER','production.batch.log'),
('MANAGER','production.waste.log'),
('MANAGER','inventory.stock.view'),
('MANAGER','inventory.count.run'),
('MANAGER','inventory.adjustment.confirm'),
('MANAGER','statements.import.upload'),
('MANAGER','financial.allocation.edit'),
('MANAGER','documents.upload'),
('MANAGER','documents.ocr.process'),
('MANAGER','personnel.employees.manage'),
('MANAGER','personnel.fichajes.write'),
('MANAGER','personnel.fichajes.audit'),
('MANAGER','personnel.incidencias.manage'),
('MANAGER','reporting.operational.view'),
('MANAGER','data.records.delete_soft'),
('ADMINISTRATIVE','org.config.read'),
('ADMINISTRATIVE','sales.view'),
('ADMINISTRATIVE','suppliers.manage'),
('ADMINISTRATIVE','purchases.order.create'),
('ADMINISTRATIVE','purchases.invoices.manage'),
('ADMINISTRATIVE','catalog.products.read'),
('ADMINISTRATIVE','statements.import.upload'),
('ADMINISTRATIVE','statements.import.process'),
('ADMINISTRATIVE','financial.allocation.edit'),
('ADMINISTRATIVE','documents.upload'),
('ADMINISTRATIVE','documents.ocr.process'),
('ADMINISTRATIVE','documents.ocr.verify'),
('ADMINISTRATIVE','personnel.fichajes.write'),
('ADMINISTRATIVE','reporting.operational.view'),
('ADMINISTRATIVE','reporting.tax_summary.view'),
('PURCHASING','suppliers.manage'),
('PURCHASING','purchases.order.create'),
('PURCHASING','purchases.order.approve'),
('PURCHASING','purchases.reception.confirm'),
('PURCHASING','purchases.invoices.manage'),
('PURCHASING','catalog.products.read'),
('PURCHASING','catalog.pricing.manage'),
('PURCHASING','recipes.view'),
('PURCHASING','inventory.stock.view'),
('PURCHASING','documents.upload'),
('RECEPTION_FLOOR','purchases.reception.confirm'),
('RECEPTION_FLOOR','catalog.products.read'),
('RECEPTION_FLOOR','inventory.count.run'),
('RECEPTION_FLOOR','documents.upload'),
('RECEPTION_FLOOR','personnel.fichajes.write'),
('PRODUCTION','catalog.products.read'),
('PRODUCTION','recipes.view'),
('PRODUCTION','production.batch.log'),
('PRODUCTION','production.waste.log'),
('PRODUCTION','inventory.count.run'),
('PRODUCTION','personnel.fichajes.write'),
('COOK_COST_SHEET_MANAGER','catalog.products.read'),
('COOK_COST_SHEET_MANAGER','catalog.products.write'),
('COOK_COST_SHEET_MANAGER','catalog.pricing.manage'),
('COOK_COST_SHEET_MANAGER','recipes.view'),
('COOK_COST_SHEET_MANAGER','costsheets.view'),
('COOK_COST_SHEET_MANAGER','costsheets.edit'),
('COOK_COST_SHEET_MANAGER','production.batch.log'),
('COOK_COST_SHEET_MANAGER','production.waste.log'),
('COOK_COST_SHEET_MANAGER','inventory.stock.view'),
('COOK_COST_SHEET_MANAGER','personnel.fichajes.write'),
('COOK_COST_SHEET_MANAGER','reporting.operational.view'),
('HR_PERSONNEL','personnel.employees.manage'),
('HR_PERSONNEL','personnel.fichajes.write'),
('HR_PERSONNEL','personnel.fichajes.audit'),
('HR_PERSONNEL','personnel.incidencias.manage'),
('HR_PERSONNEL','documents.upload'),
('HR_PERSONNEL','reporting.operational.view'),
('HR_PERSONNEL','sensitivedata.salaries.read'),
('EXTERNAL_ACCOUNTANT','sales.view'),
('EXTERNAL_ACCOUNTANT','sales.tickets.read'),
('EXTERNAL_ACCOUNTANT','purchases.invoices.manage'),
('EXTERNAL_ACCOUNTANT','catalog.products.read'),
('EXTERNAL_ACCOUNTANT','recipes.view'),
('EXTERNAL_ACCOUNTANT','inventory.stock.view'),
('EXTERNAL_ACCOUNTANT','statements.import.upload'),
('EXTERNAL_ACCOUNTANT','financial.reconciliation.review'),
('EXTERNAL_ACCOUNTANT','financial.allocation.edit'),
('EXTERNAL_ACCOUNTANT','documents.upload'),
('EXTERNAL_ACCOUNTANT','reporting.pnl.view'),
('EXTERNAL_ACCOUNTANT','reporting.tax_summary.view'),
('CONSULTANT','sales.view'),
('CONSULTANT','catalog.products.read'),
('CONSULTANT','recipes.view'),
('CONSULTANT','costsheets.view'),
('CONSULTANT','inventory.stock.view'),
('CONSULTANT','reporting.operational.view')
) AS defaults(role_code,capability_code)
JOIN public.eco_role_templates r ON r.code=defaults.role_code
JOIN public.eco_capabilities c ON c.code=defaults.capability_code;

COMMIT;
