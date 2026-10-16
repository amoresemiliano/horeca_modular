# CCR-PROD-001 — Scoped Production execution gates

Status: APPROVED by Master for the 2026-10-16 foundation integration. Owner: Core. Requesting stream: Production / WP-PROD-001. Deployment is authorized by the separate Master integration request; no tenant enablement is authorized.

The isolated proposal `supabase/ccr/CCR-PROD-001.sql` is retained as review history and must not be applied independently. The approved canonical implementation is `supabase/migrations/20261015090000_core_production_capabilities.sql`. It validates prerequisites and rejects unexpected preexisting capabilities before adding the approved grants. All seven Production capabilities require `produccion` entitlement and OPERATIONAL_UNIT scope. Existing log grants remain unchanged.

| Proposed code | Proposed role grants |
| --- | --- |
| production.view | OWNER, MANAGER, PRODUCTION, COOK_COST_SHEET_MANAGER, CONSULTANT |
| production.plan.manage | OWNER, MANAGER, COOK_COST_SHEET_MANAGER |
| production.batch.confirm | OWNER, MANAGER |
| production.batch.correct | OWNER, MANAGER |
| production.waste.confirm | OWNER, MANAGER |

Master approves this matrix as least privilege for the foundation. Member revoke precedence and the SQL evaluator remain unchanged. No platform/holding role grants are added. Confirm and correct remain separate capabilities even where a supervisor role receives both.

Master/Core adds the five constants to `src/domain/tenancy/authorization/capabilities.ts`, aligns role metadata, and includes `production.view` in navigation. Consultants receive no Production logging/confirmation authority. The client evaluator now requires explicit Production entitlement and selected unit, with organization-wide membership or an explicit matching unit scope. The server SQL evaluator remains authoritative. Core alignment is covered by `tests/unit/core_production_capabilities.test.ts` and the canonical migration is exercised by the embedded Production integration suite.

Hosted verification uses `tests/integration/production_hosted_authorization.sql` under Master control and always rolls back. No owner adapter is supplied and no Production facts are seeded. See `MASTER-PRODUCTION-FOUNDATION-INTEGRATION.md` for deployment evidence and remaining operational gates.
