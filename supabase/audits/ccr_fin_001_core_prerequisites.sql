-- Read-only catalog audit. Run only after verifying the CLI link is HORECA DEV
-- vmxjqwlfwnphorthhcwu (horeca_modular_staging). Does not bootstrap any schema.
SELECT name AS required_relation, to_regclass(name) IS NOT NULL AS present
FROM unnest(ARRAY[
  'public.eco_user_profiles',
  'public.eco_organizations',
  'public.eco_organization_members',
  'public.eco_capabilities',
  'public.eco_role_templates',
  'public.eco_role_template_capabilities',
  'public.eco_operational_units',
  'public.eco_organization_module_entitlements',
  'public.eco_member_capability_overrides',
  'public.eco_membership_operational_unit_scopes',
  'supabase_migrations.schema_migrations'
]) AS required(name)
ORDER BY name;
