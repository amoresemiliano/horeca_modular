-- Read-only evidence collector for the Finance owner. No data rows or auth records.
-- Execute against an explicitly selected HORECA database using a metadata-readable role.
-- Results must be reviewed/redacted before committing a schema snapshot.
WITH targets(name) AS (VALUES
 ('eco_financial_accounts'), ('eco_source_imports'), ('eco_source_files'), ('eco_import_rows'),
 ('eco_financial_movements'), ('eco_movement_allocations'), ('eco_tax_categories'),
 ('eco_tax_subcategories'), ('eco_counterparties'), ('eco_classification_rules'))
SELECT t.name, c.oid IS NOT NULL AS exists_in_database, c.relkind,
       pg_catalog.pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity, c.relforcerowsecurity, c.relacl
FROM targets t LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=t.name ORDER BY t.name;

SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default, numeric_precision, numeric_scale
FROM information_schema.columns WHERE table_schema='public' AND table_name IN (
 'eco_financial_accounts','eco_source_imports','eco_source_files','eco_import_rows','eco_financial_movements',
 'eco_movement_allocations','eco_tax_categories','eco_tax_subcategories','eco_counterparties','eco_classification_rules')
ORDER BY table_name, ordinal_position;

SELECT c.relname AS table_name, con.conname, con.contype, con.convalidated,
       pg_catalog.pg_get_constraintdef(con.oid, true) AS definition
FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class c ON c.oid=con.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN (
 'eco_financial_accounts','eco_source_imports','eco_source_files','eco_import_rows','eco_financial_movements',
 'eco_movement_allocations','eco_tax_categories','eco_tax_subcategories','eco_counterparties','eco_classification_rules')
ORDER BY c.relname, con.contype, con.conname;

SELECT tablename, indexname, indexdef FROM pg_catalog.pg_indexes WHERE schemaname='public' AND tablename IN (
 'eco_financial_accounts','eco_source_imports','eco_source_files','eco_import_rows','eco_financial_movements',
 'eco_movement_allocations','eco_tax_categories','eco_tax_subcategories','eco_counterparties','eco_classification_rules')
ORDER BY tablename,indexname;

SELECT tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_catalog.pg_policies
WHERE schemaname='public' AND tablename IN (
 'eco_financial_accounts','eco_source_imports','eco_source_files','eco_import_rows','eco_financial_movements',
 'eco_movement_allocations','eco_tax_categories','eco_tax_subcategories','eco_counterparties','eco_classification_rules')
ORDER BY tablename,policyname;

SELECT table_name, grantor, grantee, privilege_type, is_grantable FROM information_schema.table_privileges
WHERE table_schema='public' AND table_name IN (
 'eco_financial_accounts','eco_source_imports','eco_source_files','eco_import_rows','eco_financial_movements',
 'eco_movement_allocations','eco_tax_categories','eco_tax_subcategories','eco_counterparties','eco_classification_rules')
ORDER BY table_name,grantee,privilege_type;

SELECT table_name, column_name, grantee, privilege_type FROM information_schema.column_privileges
WHERE table_schema='public' AND table_name IN (
 'eco_financial_accounts','eco_source_imports','eco_source_files','eco_import_rows','eco_financial_movements',
 'eco_movement_allocations','eco_tax_categories','eco_tax_subcategories','eco_counterparties','eco_classification_rules')
ORDER BY table_name,column_name,grantee,privilege_type;

SELECT c.relname AS table_name, t.tgname, pg_catalog.pg_get_triggerdef(t.oid, true) AS definition
FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND NOT t.tgisinternal AND c.relname IN (
 'eco_financial_accounts','eco_source_imports','eco_source_files','eco_import_rows','eco_financial_movements',
 'eco_movement_allocations','eco_tax_categories','eco_tax_subcategories','eco_counterparties','eco_classification_rules')
ORDER BY c.relname,t.tgname;
