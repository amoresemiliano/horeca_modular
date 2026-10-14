# Production gap matrix and implementation plan

Date: 2026-10-14. Audit only. Source findings: [legacy audit](PRODUCTION-LEGACY-AUDIT-2026-10.md). Proposed behavior: [target design](PRODUCTION-TARGET-DESIGN.md). Branch assessed: `module/production` at `b710bb9`; DEV at `89abfb0`. Historical migration is NOT_REQUIRED.

## Gap matrix

| ID | Legacy value / evidence | Current HORECA | Minimum target / disposition | Priority / work package |
| --- | --- | --- | --- | --- |
| G01 | Role-aware kitchen entry (F01/F02) | Current Core available on DEV, Production branch 59 commits behind | Resync approved DEV; reuse scoped Core, no legacy auth | P0 / WP-PROD-001 |
| G02 | Simple package receipt entry (F04) | Free-text product and quantity/unit legacy-table insert | Canonical references, packages and immutable output facts; retain short form | P0 / 001–002 |
| G03 | Kg view across mixed formats (E08/E15) | Inventory localStorage conversion with 1 kg fallback; Production accepts arbitrary unit | Versioned Catalog conversion snapshot, validated dimensions, kg + count display | P0 / 001–003 |
| G04 | Min/max urgency and replenish-to-max (F13/F14) | Local Inventory planning only; no canonical Production planning | Unit-scoped durable policy + Inventory projection; approved equality/rounding behavior | P1 / 001–003 |
| G05 | Production separate from circulation (F11/F12) | Two overlapping Production views; legacy classifications | Explicit confirmed output facts; Inventory owns receipts/transfers/issues | P0 / 002–003 |
| G06 | Date filters and late recording intent (E15) | Date form exists but no immutable audit split | Effective business date vs server recorded timestamp, authorized correction | P1 / 001–002 |
| G07 | User corrections (F07/F08) | No canonical correction; legacy hard edits/deletes | Append-only correction/reversal, reason, concurrency guard and compensations | P0 / 001–003 |
| G08 | Adjustment review (F10) | Browser inventory edits; no canonical ledger | Move entirely to Inventory; no stock edits in Production | P0 / 003 |
| G09 | Frozen-stock availability (F09) | Competing browser balances and legacy mutable stock table | Inventory-owned freshness/versioned availability contract | P0 / 003 |
| G10 | No linked transfer (legacy requirement only) | No demonstrated canonical transfer contract | Inventory-owned atomic/linked transfer; no artificial production at destination | P0 boundary / 003 |
| G11 | No ingredient/recipe execution in legacy | Escandallos mock; local untracked Production types | Optional immutable recipe refs; actual input declarations, no invented BOM | P0 dependency / 003 |
| G12 | No waste flow in legacy | Basic HORECA merma number, mixed-unit summaries | Classified actual waste, log vs confirm, no duplicate input deduction | P1 / 001–003 |
| G13 | Recent history/trends (F06/F18) | 500-row limit, mixed-unit/name summaries | Scoped cursor queries and corrected fact projections, all catalog products | P1 / 002–003 |
| G14 | Fast familiar UX (F03/F04) | Responsive shell, incomplete operational screens | Today/Needs/Detail/History with mobile cards and touch controls | P1 / 002 |
| G15 | User/catalog maintenance (F15–F17) | Core admin exists; Catalog/HR references not published for Production | Reuse owners; no Production master/user administration | P0 boundary / 001–003 |
| G16 | No reliable retry/concurrency | Draft random event IDs, no transactional outbox | Unique command+payload, expected revision, stable event delivery/receipt | P0 / 001–003 |
| G17 | Historical records intentionally excluded | Legacy/sample records present in source | No historical ETL, no reseeding; optional reviewed config only | P0 / all WPs |
| G18 | Source snapshot has internal PHP mismatches | Current source is not live legacy deployment proof | PO identifies actual active variant and confirms contested semantics during planning | Planning input / 002 |
| G19 | No export/import production flow found | No canonical feature to preserve | Exclude historical import/export and labels from MVP; add only by separate need | Scope control / all WPs |
| G20 | No tenant boundary in legacy | DEV denies access to unsafe legacy tables | Org/unit FKs + trusted gate + child RLS; never reopen old tables | P0 / 001 |

## Work packages — four substantial deliveries

### WP-PROD-001 — Canonical execution foundation and Core alignment

Entry: Master agrees implementation scope; preserve local drafts separately and resync `module/production` from approved DEV. This audit does not merge anything. At the audited refs a fast-forward is possible; recheck refs and untracked collisions at execution time.

Deliver Production-owned model and server transaction contracts for planning policy, batch drafts, immutable confirmation, classified waste and correction chains. Resolve `CCR-PROD-001` with Core; use actual `eco_organizations`/`eco_operational_units` and owner-approved master refs, not nonexistent draft references. Master reviews migration ordering against the active rebaseline chain. Protect children and parents consistently, preserve disabled legacy tables, and implement command idempotency/version guards and a durable outbox. Select a canonical employee lookup with HR/Core owner rather than reading denied legacy employee rows.

Acceptance: isolated disposable tests prove no foreign tenant/unit reads or writes, absent/inactive membership denial, explicit revoke precedence, entitlement denial, platform-admin-without-tenant denial, unknown product/package rejection, stale revision rejection and same-key/same-payload repeat behavior. Same-key/different-payload conflicts. Confirmation atomically persists facts/outbox; rollback leaves neither. No direct Inventory/master writes. Canonical migrations remain unapplied to shared environments until reviewed. Ready contracts are distinct from deployed features.

### WP-PROD-002 — Legacy-equivalent operational UX

Entry: 001 read/write contracts available in isolated fixtures; resolve actual legacy variant and threshold/count boundary intent with Product Owner. Do not claim PHP snapshot parity without that decision.

Deliver Today, Needs, batch detail/review and history/summary using mobile cards, package count/kg presentation, explicit date and optional shift/notes, dynamic products, accessible filters and visible execution/posting states. Remove competing Production navigation from Inventory only after replacement is accepted; this is a coordinated owner change. Keep logs separate from transfers/stock issues. Replace current legacy-table Production calls rather than broadening privileges. Use unavailable/loading states for missing Inventory/Recipe dependencies, never example rows in an operational tenant.

Acceptance: touch-only and keyboard-only scenarios at 360/390/768/1440 px; 20 × 1.5 kg = 30 kg, mixed format display, unknown format rejection, exact threshold boundaries, late effective-date entry, pending/completed distinction, unit context reset, accessible errors and safe back navigation. No horizontal page scroll for critical actions. No edit-to-stock operation. A repeated click cannot create another batch. Chart queries include eligible products and use correct units; drafts do not count as output.

### WP-PROD-003 — Inventory, Catalog and Escandallos integration

Entry: each owner publishes/approves its canonical references and contracts. Current localStorage Inventory and static Escandallos mock are not sufficient providers. This package does not authorize Production to implement other modules' stock ledgers or recipe masters.

Deliver versioned Catalog package resolution; approved recipe/version lookup and actual-input declarations where applicable; durable confirmed output/consumption/waste/correction delivery to Inventory with acknowledgements and deduplication. Agree output-only manual execution mode explicitly if recipes are unavailable. Planning consumes authorized freshness-stamped stock; Analytics consumes corrected facts. Purchases/Sales are optional read/signal integrations only, with no cross-domain writes. Preserve no-double-posting semantics across sales withdrawals, transfers, ingredient issues and process waste.

Acceptance: same event delivered repeatedly produces one ledger effect; failed delivery retries retain event identity; atomic multi-line acceptance/rejection is documented; forbidden cross-unit/tenant refs reject; transfer receipt never increments Production output; waste already consumed is not deducted twice; recipe version changes do not alter confirmed facts; correction references original posting and prevents duplicate compensations. Inventory unavailability leaves durable visible pending/failed state; stale/missing availability is not zero. All testing uses isolated synthetic tenants and owner-provided adapters until hosted approval.

### WP-PROD-004 — Hosted DEV UAT and release hardening

Entry: current auth/infrastructure incident resolved, 001–003 accepted, Master approves migrations/deployment, and a disposable synthetic tenant has explicitly enabled reviewed Production and dependency entitlements/scopes. DEV and PROD share the HORECA database; El Criollo and other real tenants are not disposable.

Deliver hosted role/unit matrix, mobile kitchen walkthrough, posting/retry/correction UAT, source-to-target functional signoff and a concrete release/rollback record. Product Owner validates operational language, active legacy flow parity and stock effects. No historical import, real-tenant fixtures, global cleanup or legacy-source changes. Production promotion is separate from DEV UAT and requires reviewed evidence.

Acceptance: actual allowed kitchen actor can complete workflow and a read-only actor cannot confirm; wrong unit/tenant and revoked capability deny on server; expected context visible; disposable-tenant output is reflected exactly once in Inventory and traceable back; technical failures remain recoverable; user confirms simplicity and mobile usability. Confirm real-business data was not targeted by setup/tests. No claim of PROD validation until its separate release checks complete.

## Dependencies and decisions

| Item | Owner | Status / consequence |
| --- | --- | --- |
| Current module branch resync / shared migration scheduling | Master | Required before implementation; no textual tracked conflict at audited refs |
| `CCR-PROD-001` capability/entitlement/navigation registry | Core | Proposed, not applied; one formal Core change request |
| Product/package/base-unit IDs and conversion versions | Catalog | Contract not demonstrated; cannot confirm against arbitrary names |
| Availability/location/ledger posting and compensation API | Inventory | Contract needs review; current module is browser legacy embedding |
| Approved recipe/version/yield API | Escandallos | Contract needs review; current DEV screen is a mock |
| Employee identity/reference read | HR/Core owner | Reuse canonical read path; old employee relation remains denied |
| Active legacy revision, planning aggregate scope and equality/rounding behavior | Product Owner | Resolve during planning/UAT; source variants differ |
| Auth and shared hosted environment availability | Master / infrastructure | Hosted UAT prerequisite; this read-only audit did not change or re-test it |

Boundary ownership is clear by design. Inventory and Escandallos **integration contracts still need review**; neither is an implemented dependency. Readiness for implementation planning: YES. Readiness to apply migrations, enable real stock effects, merge module code or release: NO. Audit blockers: none; the listed decisions and contracts are prerequisites for subsequent implementation.
