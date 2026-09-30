# WP-FIN-002 — Classification, transfers and Finance metrics

Implementation baseline: `origin/dev` at `d368f0cd3af7932e0b92902ef0002a30d84deb78`. Finance was fast-forwarded after PR #2 merged. Work is confined to Finance; Core/Auth/runtime configuration, parser families, the canonical import service/repository and the deployed WP-FIN-001 migration remain unchanged.

## Behavior

Economic meaning lives on allocations, with the eight approved types. Existing allocations and existing rule targets default to `UNCLASSIFIED`, irrespective of sign or preexisting category. No historical semantic backfill is guessed. Existing rules should be reviewed and given an explicit target type before treating their results as economic suggestions.

Human classification supports economic type, category/subcategory, counterparty and note. Categories are optional, including for non-operating flows. Quick creation refreshes and selects the new catalog identity without discarding the form. Splits retain exact balance and carry separate economic types/notes. Rule management supports list/create/edit/activate/deactivate, an optional source account and sign condition, and creation from a confirmed example. Rules always produce `SUGGESTED`, including on import. Bulk confirmation requires a visible selection and a second confirmation; the RPC revalidates each selected allocation version and rolls the entire selection back if any item changed. Transfer-type suggestions require individual review instead of bulk approval.

Transfer detection uses exact opposite nonzero amounts, different own bank accounts, same currency and booking dates no more than three days apart. Matching references and transfer descriptions contribute deterministic evidence/score; no ML or automatic confirmation is used. The negative movement fixes pair orientation, and a unique tenant/pair constraint prevents repeated suggestions. Rejected pairs stay rejected on subsequent detection.

Confirmation locks both bank facts in ID order, revalidates the evidence and allocation state, then links both allocations to the reviewed candidate and sets their interpretation to `INTERNAL_TRANSFER`. Bank facts are unchanged; both remain visible. This is classification approval, not generic reconciliation approval: `reconciliation_status` is not changed. Overlapping confirmed pairs, foreign IDs, stale evidence, incompatible confirmed classification and linked splits are rejected. The initial pairing workflow handles whole unsplit bank-account movements; card products and split interpretation require individual classification. Reversal of a confirmed link is outside this implementation; linked interpretation/splitting/deletion is protected rather than silently unlinking a reviewed pair.

Account editing uses a tenant-authorized RPC that accepts only display name, four-digit masked identifier and active state. Browser UPDATE/DELETE privileges are revoked, preventing an alternate path to change institution/product or delete history. Account creation retains the existing authorized INSERT policy; deactivation preserves prior movements.

The consolidated table has seven columns and accessible icon-only row actions. The toolbar is Cuentas y categorías / Reglas / Cargar. Applying rules is inside rule management. Pending/suggested filters, description/catalog search and explicit review selection support daily classification.

## Metrics contract

`financeMetrics` uses exact integer cents and a selected currency; currencies are never combined. Raw banking cards, monthly flow and account flow use bank facts. Operating totals and category/subcategory/counterparty breakdowns use only confirmed allocation economic types. Financing, card settlement and other non-operating flows are separate. Suggested/unclassified lines remain visibly outside confirmed economic totals. Split allocations contribute once, without adding the parent movement again. Refunds keep their signed amount within the explicitly selected economic type.

Internal-transfer volume is the sum of absolute values of both bank legs and is labeled as allocation volume, alongside a net value. It is not represented as operating revenue/expense. Unclassified amount is absolute volume, so opposite unresolved amounts do not conceal one another. The summary and metrics views share the canonical aggregation; the old flattened data and required dateRange assumptions are gone.

## Deployment handoff — Master only

New migration: `supabase/migrations/20261001000000_finance_classification_workflow.sql`.

It adds the economic domain/columns, candidate table, tenant-safe foreign keys, indexes, candidate RLS and restricted RPCs. It replaces Finance function definitions within the new migration to extend import/rules/classification/split behavior. The already deployed WP-FIN-001 file is not edited or reapplied.

Master must review/apply the new migration to canonical HORECA DEV before deploying this frontend. No shared DEV migration, production deployment, Core redesign or real banking-data mutation was performed by this task. No hosted verification is claimed. After deployment, Master/Product Owner should review existing rule targets, classify existing allocations, verify candidate confirm/reject and validate metrics against their own records. Existing unclassified economic totals remaining unclassified is intentional.

## Local evidence

- Lint: zero errors; eight preexisting warnings outside the changed Finance components.
- TypeScript: passed.
- Tests: 315 passed; one explicitly opt-in hosted test skipped. Embedded PostgreSQL executes both the original Finance contract and its upgraded WP-FIN-002 version, including WP-FIN-001 regression cases.
- Build: passed. Existing stale Browserslist/bundle-size/plugin-timing warnings remain.
- Synthetic browser check: quick category/subcategory/counterparty creation and selection, classification save, rule creation/deactivation, account rename/last4 and metrics render passed; no page errors or desktop horizontal overflow at 1280 px. Services were simulated locally; this is UI evidence, not hosted authorization proof.
- SQL cases cover transfer confirmation/rejection, negative candidate cases, overlapping pairs, tenant/entitlement denial, protected linked facts, exact splits, account immutability, rule account/sign/active conditions, suggestion-only semantics, stale bulk review and all-or-nothing rollback.
- Synthetic fixtures cover transfer legs, financing in/out, supplier expense, operating sales income, capital, card settlement, mixed-type split and unclassified signs. They contain no real statements, credentials or Product Owner UAT totals.

No DEV merge is performed by the module agent. Development Captain owns final review and integration.
