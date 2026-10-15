# CCR-PROD-001 — Scoped Production execution gates

Status: READY_FOR_MASTER. Owner: Core. Requesting stream: Production / WP-PROD-001. No shared deployment authorized by this request.

Review the isolated SQL proposal at `supabase/ccr/CCR-PROD-001.sql`. It uses the existing Core registry and role bundle pattern; it does not replace the authorization evaluator or provision tenants. All seven Production capabilities require `produccion` entitlement and OPERATIONAL_UNIT scope. Existing log grants remain unchanged.

| Proposed code | Proposed role grants |
| --- | --- |
| production.view | OWNER, MANAGER, PRODUCTION, COOK_COST_SHEET_MANAGER, CONSULTANT |
| production.plan.manage | OWNER, MANAGER, COOK_COST_SHEET_MANAGER |
| production.batch.confirm | OWNER, MANAGER |
| production.batch.correct | OWNER, MANAGER |
| production.waste.confirm | OWNER, MANAGER |

Core must approve this matrix, preserve explicit member revoke precedence, and schedule a Core-owned forward migration separately from the Production schema. No platform/holding role grants are proposed. Confirm and correct remain separate capabilities even where a reviewed supervisor role receives both.

Core source follow-up after approval: add the five constants to `src/domain/tenancy/authorization/capabilities.ts` and align `src/application/tenancy/accessNavigation.js` so `production.view` enables read-only Production navigation in the selected operational unit. Current navigation only checks batch/waste logging; consultants must not be granted write permissions to make navigation visible. Align role metadata and associated Core tests with the approved matrix. These protected Core files were deliberately not edited by Production.

Embedded Production tests apply the proposal only inside a disposable PostgreSQL instance and use the actual canonical Core evaluator to prove operator logging cannot confirm, waste logging cannot confirm, entitlement and revoke denials, unit scope and platform isolation. Hosted enablement, grant approval and navigation activation remain Master responsibilities. The Production schema fails closed if the proposed capabilities are absent.
