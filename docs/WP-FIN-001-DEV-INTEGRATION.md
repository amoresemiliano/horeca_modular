# Finance integration with authoritative DEV

The Bancos UI uses ImportModal -> BankStatementImportService -> SupabaseFinanceRepository -> rpc_confirm_bank_statement_import. The legacy importBankStatementData writer is absent from browser source. Canonical confirmation cannot send operation_type to eco_source_imports.

Integration base: b7e5e95df99d936566c63a509fa58909be010ea7 (origin/dev).
Reviewed Finance parent: c3838c54624f184c18b132d6c5d6bdeae5113947.
Workflow: merge dev into module/finance without rewriting either history; PR #2 remains draft and unmerged.

## Preservation checks

- AuthContext, tenantContext, MainLayout and Supabase configuration match authoritative dev exactly after integration. Core authentication, active organization, capability and entitlement fixes are retained.
- Finance domain, application, parsers, repository, UI and extractosService match the reviewed Finance parent exactly. This integration needs no additional runtime patch: the reviewed branch already replaces the legacy writer.
- All Supabase files match the reviewed Finance parent. No deployed migration was edited, reapplied or supplemented; no shared database operation was performed.
- ImportModal accepts .xls and .xlsx, previews accepted/rejected rows, resolves or requests the account, and confirms through the application service. Bancos routes through MainLayout to this modal.
- Import completion reloads canonical movements with allocations. Catalog, classification, counterparty, subcategory, rule and split handlers are preserved, including SUGGESTED versus CONFIRMED semantics.
- No get_auth_user_org_id, legacy BANK_IMPORT gate, holding_id reference or forbidden project reference occurs in the inspected Finance runtime/context paths. No new runtime source outside the dev merge is introduced.

## Remaining reference audit

Repository searches covered importBankStatementData, operation_type, eco_source_imports and browser .insert calls.

| Occurrences | Classification |
| --- | --- |
| importBankStatementData in this report and finance_import_wiring.test.ts | Documentation/test guard only; no runtime definition, import or call remains. |
| operation_type in finance_import_wiring.test.ts and finance_repository.test.ts | Regression guards against the legacy browser field and RPC payload. |
| operation_type in CCR-FIN-001-FINANCE-SCHEMA-AUDIT.md | Historical schema inventory, not active runtime. |
| operation_type in 20260928010000_finance_atomic_bank_import.sql | Canonical allowed generated column on eco_financial_movements; absent from eco_source_imports. Migration unchanged. |
| eco_source_imports in SupabaseFinanceRepository.ts | Canonical allowed read join for exact-file duplicate checks; no browser insert. |
| eco_source_imports in the canonical Finance migration | Canonical allowed table definition, references, server RPC persistence and RLS/grants. Direct authenticated INSERT remains denied. |
| eco_source_imports in supabase/audits/ccr_fin_001_finance_schema.sql | Read-only schema audit. |
| eco_source_imports in supabase/history/finance_drafts and supabase/history/pre_rebaseline | Archived, inactive SQL. |
| eco_source_imports in finance_repository.test.ts, finance_atomic_postgres.test.ts and WP-FIN-001-HOSTED-EVIDENCE.json | Mocked/embedded test coverage and inherited Master evidence, including direct-insert denial. |
| eco_source_imports in CANONICAL_DB_RECONSTRUCTION_PLAN, CCR-FIN-001-FINANCE-SCHEMA-AUDIT, DATABASE_DRIFT_REPORT, DOMAIN_MODEL and fase-2b-arquitectura documents | Documentation/history only. |
| .insert in extractosService.js | Canonical allowed classification-rule and account/category/subcategory catalog creation; dynamic catalog table map excludes import tables. Counterparty upsert also targets catalog data only. |
| .insert in HorariosApp.jsx and ProduccionApp.jsx | Unrelated non-Finance runtime; unchanged. |

No active browser canonical import insert or remaining defective legacy confirmation path was found. All occurrences in this report itself are documentation.

## Validation

- npm run lint: passed, 0 errors and 11 existing warnings.
- npm run typecheck: passed.
- npm run test:run -- --maxWorkers=1: 21 files passed; 262 tests passed, 1 hosted opt-in test skipped.
- npm run build: passed; warnings about stale Browserslist data, plugin timings and a bundle exceeding 500 kB remain.
- git diff --check: passed.

Added regression coverage verifies active UI wiring and absence of the legacy writer, exact allowed RPC argument keys without operation_type, and actual BIFF8 .xls / OOXML .xlsx workbooks for all four parser families. Existing embedded PostgreSQL coverage checks transaction rollback, authorization, persisted reload, classification, deterministic rules and balanced splits.

These results prove branch integration and local regression behavior, not a new hosted UAT run of the Product Owner's real statement. Shared deployment and Core provisioning evidence belongs to the inherited WP-FIN-001-MASTER-REVIEW.md and WP-FIN-001-HOSTED-EVIDENCE.json. Earlier deployment-request documents describe the previous review stage. Development Captain still owns PR #2 integration into dev and subsequent hosted UAT.
