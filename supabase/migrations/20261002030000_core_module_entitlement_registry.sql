-- Complete required-module metadata for the existing module capabilities.
-- Shared Core identity/scope/catalog/data-lifecycle capabilities remain module-neutral;
-- individual business RPCs must also guard their owning module.
BEGIN;
UPDATE public.eco_capabilities SET required_module_key=CASE
 WHEN code LIKE 'sales.%' THEN 'ventas'
 WHEN code LIKE 'purchases.%' OR code='suppliers.manage' THEN 'compras'
 WHEN code LIKE 'recipes.%' OR code LIKE 'costsheets.%' THEN 'escandallos'
 WHEN code LIKE 'production.%' THEN 'produccion'
 WHEN code LIKE 'inventory.%' THEN 'inventario'
 WHEN code LIKE 'personnel.%' OR code='sensitivedata.salaries.read' THEN 'personal'
 WHEN code LIKE 'reporting.%' THEN 'reporting'
 WHEN code LIKE 'documents.%' THEN 'documentos'
 WHEN code LIKE 'integrations.%' THEN 'integraciones'
 ELSE required_module_key END
WHERE scope IN('ORGANIZATION','OPERATIONAL_UNIT');
COMMIT;
