-- Master/Core CCR-PROD-001. Registry and role grants only; no tenant enablement.
-- Orders before the unapplied Production foundation, after hosted Sales migrations.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.eco_capabilities WHERE code LIKE 'production.%' AND scope <> 'OPERATIONAL_UNIT') THEN
  RAISE EXCEPTION 'Production capability scope requires Core reconciliation';
 END IF;
 IF EXISTS(SELECT 1 FROM public.eco_capabilities WHERE code IN
  ('production.view','production.plan.manage','production.batch.confirm','production.batch.correct','production.waste.confirm')) THEN
  RAISE EXCEPTION 'CCR-PROD-001 requires review of unexpected preexisting capabilities';
 END IF;
 IF (SELECT count(*) FROM public.eco_role_templates WHERE is_active AND tier='ORGANIZATION'
  AND code IN ('OWNER','MANAGER','PRODUCTION','COOK_COST_SHEET_MANAGER','CONSULTANT')) <> 5 THEN
  RAISE EXCEPTION 'CCR-PROD-001 requires five active canonical organization roles';
 END IF;
 IF (SELECT count(*) FROM public.eco_capabilities WHERE is_active AND scope='OPERATIONAL_UNIT'
  AND code IN ('production.batch.log','production.waste.log')) <> 2 THEN
  RAISE EXCEPTION 'CCR-PROD-001 requires existing scoped logging capabilities';
 END IF;
END $$;
INSERT INTO public.eco_capabilities(code,scope,description,is_active,required_module_key) VALUES
 ('production.view','OPERATIONAL_UNIT','Read scoped Production facts',true,'produccion'),
 ('production.plan.manage','OPERATIONAL_UNIT','Manage Production replenishment policies',true,'produccion'),
 ('production.batch.confirm','OPERATIONAL_UNIT','Confirm immutable Production execution, distinct from logging',true,'produccion'),
 ('production.batch.correct','OPERATIONAL_UNIT','Append reasoned execution corrections and reversals',true,'produccion'),
 ('production.waste.confirm','OPERATIONAL_UNIT','Confirm classified waste, distinct from logging',true,'produccion');
UPDATE public.eco_capabilities SET required_module_key='produccion'
 WHERE code IN ('production.batch.log','production.waste.log');
INSERT INTO public.eco_role_template_capabilities(role_template_id,capability_id)
SELECT r.id,c.id FROM public.eco_role_templates r CROSS JOIN public.eco_capabilities c
WHERE r.is_active AND r.tier='ORGANIZATION' AND c.is_active AND (
 (c.code='production.view' AND r.code IN ('OWNER','MANAGER','PRODUCTION','COOK_COST_SHEET_MANAGER','CONSULTANT')) OR
 (c.code='production.plan.manage' AND r.code IN ('OWNER','MANAGER','COOK_COST_SHEET_MANAGER')) OR
 (c.code IN ('production.batch.confirm','production.batch.correct','production.waste.confirm') AND r.code IN ('OWNER','MANAGER'))
) ON CONFLICT DO NOTHING;
-- Preserve existing logging grants, member overrides, entitlements and the SQL evaluator.
COMMIT;
