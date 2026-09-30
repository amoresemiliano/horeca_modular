# Current status — 2026-09-29

CCR-FIN-001 is RESOLVED and hosted-verified by Core. Finance now consumes the approved server authorization primitive. The historical blocked report below is retained for audit; its containment code has been replaced by the atomic RPC. Finance deployment and UAT prerequisites are tracked in [WP-FIN-001-ATOMIC-DEPLOYMENT.md](WP-FIN-001-ATOMIC-DEPLOYMENT.md).

---

# CCR-FIN-001 — Bank import authorization and database contract

Status: BLOCKED. Owner: Core / Development Captain. Work package: WP-FIN-001.

Bank parsing and preview are available. Production confirmation is deliberately unavailable:
`SupabaseFinanceRepository.requireConfirmationAuthorization` and direct persistence fail closed
with `FinanceCoreContractUnavailableError`. This is containment, not completed bank ingestion.
Do not deploy the Finance migration until the contracts below are resolved.

## Evidence and required Core decisions

1. `CONFIRM_BANK_STATEMENT_IMPORT` is absent from the versioned Core capability registry,
   SQL grants and TypeScript capability catalog. The Core migration
   `20260913000000_wp002_contract_remediation.sql` describes `BANK_IMPORT` as upload/parse.
   No approved equivalence to confirmation exists. `STATEMENTS_IMPORT_PROCESS` is also
   a separate capability and its existing unit test does not prove confirmation authority.
   Core must register the canonical confirmation gate and approve its role grants.
2. The versioned SQL exposes membership helpers, but no effective-capability evaluator for
   a supplied organization and `auth.uid()`. Core must expose an authoritative server contract
   incorporating active identity, organization/membership, role grants, grant/revoke overrides,
   operational scope and Finance entitlement. Platform administration must confer no tenant access.
   Finance must consume this contract, not reproduce Core authorization rules in its RPC.
3. `get_auth_user_org_id()` selects the earliest membership, not the browser's selected
   organization. The original Finance draft migration uses this legacy helper. Core must clarify
   the multi-organization server context contract before Finance policies are finalized.
4. `docs/CANONICAL_DB_RECONSTRUCTION_PLAN.md` identifies the four `eco_*` tables as Financial /
   Extractos structures, but the branch contains no base CREATE TABLE definitions for them.
   The Finance migration only ALTERs them. Provide the canonical schema/ownership contract,
   including existing identity uniqueness, NOT NULL columns, enums, foreign keys, RLS and grants.
   Do not infer these from legacy frontend inserts or copy unrelated database state.

No Core migrations, role grants or tenancy contracts were changed by this remediation.
No shared DEV migrations were applied. No new PR was created and PR #2 must remain unmerged.

## Required Finance work after resolution

- Replace the containment error with the approved server authorization contract. Keep the UI
  capability check as an affordance, not the security boundary.
- Implement a single transactional persistence RPC using the validated schema. Revalidate caller,
  organization, active account, bank and product inside the transaction. Prefer SECURITY INVOKER;
  if DEFINER is required, use a safe search_path, explicit caller authorization and restricted grants.
- Restrict direct canonical writes so clients cannot bypass the confirmation gate/RPC.
- Generate final-account fingerprints and re-evaluate overlap at the trusted persistence boundary.
  References/remittance IDs in these fixtures have no proven Level B uniqueness and must not be
  used for automatic suppression. Fingerprint matches remain POTENTIAL_OVERLAP.
- Persist import, source/hash provenance, relationships, accepted/rejected counters and movements
  atomically. Use organization/file SHA-256 uniqueness with deterministic concurrent loser handling.
  Never use generic fingerprint uniqueness or fingerprint-derived unique identity keys.
- Preserve exact decimal money, nullable value date, currency, direction, balance, references,
  row provenance and duplicate status through repository reload. Current UI number adapters are
  constrained to two decimals and bounded exact cents; persist decimal strings/SQL numeric.
- Replace the draft migration's swallowed constraint errors; audit inherited constraints and
  RLS rather than silently assuming they are compatible. Do not add allocation-table dependencies.
- Run isolated PostgreSQL integration tests for rollback at each required persistence step,
  concurrent same-file confirmation, direct-write denial, cross-tenant rejection, revocation,
  and canonical persist/reload (including SQL NULL valueDate).

The current tests exercise application ordering, mocked repository errors, canonical mapping and
parsing. They do NOT prove transaction atomicity, race safety, live RLS, or a persisted round trip.
Those acceptance criteria remain open; WP-FIN-001 must not be marked COMPLETE.
