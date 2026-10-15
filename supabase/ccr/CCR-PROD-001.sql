-- CORE-OWNED PROPOSAL: READY FOR MASTER REVIEW. Not in the auto-apply chain.
-- Apply only after approval; no tenant provisioning or entitlement enablement.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.eco_capabilities WHERE code LIKE 'production.%' AND scope <> 'OPERATIONAL_UNIT') THEN
  RAISE EXCEPTION 'Production capability scope requires Core reconciliation';
 END IF;
END $$;
INSERT INTO public.eco_capabilities(code,scope,description,is_active,required_module_key) VALUES
 ('production.view','OPERATIONAL_UNIT','Read scoped Production facts',true,'produccion'),
 ('production.plan.manage','OPERATIONAL_UNIT','Manage Production replenishment policies',true,'produccion'),
 ('production.batch.confirm','OPERATIONAL_UNIT','Confirm immutable Production execution, distinct from logging',true,'produccion'),
 ('production.batch.correct','OPERATIONAL_UNIT','Append reasoned execution corrections and reversals',true,'produccion'),
 ('production.waste.confirm','OPERATIONAL_UNIT','Confirm classified waste, distinct from logging',true,'produccion')
ON CONFLICT(code) DO NOTHING;
UPDATE public.eco_capabilities SET required_module_key='produccion'
 WHERE code IN ('production.batch.log','production.waste.log','production.view','production.plan.manage',
 'production.batch.confirm','production.batch.correct','production.waste.confirm');
INSERT INTO public.eco_role_template_capabilities(role_template_id,capability_id)
SELECT r.id,c.id FROM public.eco_role_templates r CROSS JOIN public.eco_capabilities c
WHERE r.is_active AND c.is_active AND (
 (c.code='production.view' AND r.code IN ('OWNER','MANAGER','PRODUCTION','COOK_COST_SHEET_MANAGER','CONSULTANT')) OR
 (c.code='production.plan.manage' AND r.code IN ('OWNER','MANAGER','COOK_COST_SHEET_MANAGER')) OR
 (c.code IN ('production.batch.confirm','production.batch.correct','production.waste.confirm') AND r.code IN ('OWNER','MANAGER'))
) ON CONFLICT DO NOTHING;
-- Existing batch.log/waste.log grants are preserved. No platform/holding bypass.
COMMIT;
