# WP-FIN-004 — Operational density, pagination and insight UX

Branch: `module/finance`. Base: `026274e2aef21e94c6afe972f3c19674af3510e5` (`origin/dev`, including WP-FIN-003).

## Delivered behavior

- Consolidado uses six compact columns, category-first classification and literal accessible ✏️ ⚙️ ✂️ actions. Account remains a primary filter and is available in description metadata. Synthetic desktop verification at 1280 × 900 shows **14 complete rows from the top of the page**.
- Pagination defaults to 25, supports 50/100, and applies after all filters. Filter/search/account/currency/review changes reset the page. Footer banking count and amounts cover the full filtered dataset, independently of the current page. Rendering is bounded by the selected page size.
- Transfer review and its known candidate count sit above the table. The dedicated compact dialog presents paired accounts, amounts and Spanish statuses with explicit confirm/reject actions.
- Classification uses a narrow dialog, neutral initial interpretation, category/subcategory/provider/economic-type/note ordering, and existing quick creation. Shared dialogs retain focus trapping, Escape handling and focus restoration.
- Resumen prioritizes banking truth, review attention, confirmed operating results and separate nonoperating flows, followed by spending rankings and account/card detail. Métricas adds monthly flow bars, a net trend, economic composition and spending distributions. The internal `Gráficas` navigation key remains compatible; visible navigation, collapsed tooltip, heading and breadcrumb say Métricas.

## Conservative history assistance and explicit review

`operationalInsights.js` builds a deterministic index once per history change. Description normalization removes accents, punctuation, numeric references and generic bank words. A proposal requires at least two matching confirmed, meaningful, single-allocation examples in the same tenant, source account, currency and amount direction. Direction alone is never evidence. Historical disagreement in economic type, category, subcategory or counterparty suppresses the proposal. Existing conflicting counterparties, linked transfers, unclassified interpretations and all split examples are excluded.

This deliberately conservative matcher is exact after normalization, not fuzzy inference. It can miss spelling variants, cross-account recurrence and unambiguous split history; these remain available for manual classification. The interface explains the supporting example count. Opening a proposal does not fill the neutral draft automatically. Users can use/edit it, save it explicitly as `SUGGESTED`, or dismiss it locally for the current workspace session. No automatic writes or confirmations occur.

Groups can be reviewed locally. Optional rule creation starts from a confirmed example, previews pending matches for the edited pattern/account/direction, and requires explicit save. Applying rules uses the existing set-based RPC; it does not issue a classification request for each row. Persisted suggestions then use the existing explicit selection, review dialog and bulk-confirm RPC (maximum 100 allocations). Rule creation is not a prerequisite for individual proposal review.

## Amounts and percentage denominators

Canonical banking and economic calculations remain authoritative. Raw movements count once for bank flow; economic interpretation uses allocations and confirmed status. Financing, internal transfers and card settlements do not become operating performance. Accounts remain grouped by identity with institution and product metadata, preserving bank/card distinctions.

Category, subcategory and provider shares use **gross negative confirmed OPERATING_EXPENSE allocation amounts** as the denominator. Positive refunds are excluded from that distribution while remaining in canonical net operating results. Missing catalog values form explicit unassigned buckets. Economic composition and unresolved percentages use absolute allocation volume, including unresolved allocations in the denominator. Zero denominators return zero. Charts label these bases and keep the selected currency separate.

Filtered datasets, pages, full filtered metrics, similarity index/groups, movement lookup and review selection are memoized. No per-row history scan or backend call was introduced. Existing paginated data loading remains unchanged; UI pagination bounds rendering, not the amount of history fetched.

## Validation and scope

- `npm run lint`: zero errors; eight pre-existing warnings outside this change.
- `npm run typecheck`: pass.
- `npm run test:run -- --maxWorkers=1`: 375 passed; one existing hosted opt-in test skipped. Existing Finance SQL invariants run locally.
- `npm run build`: pass.
- `tests/browser/finance_workflow.mjs`: existing synthetic workflow regression pass, adapted from the removed inline editor to the classification dialog.
- `tests/browser/finance_insights.mjs`: pass on 137 synthetic movements; pagination, totals, 14 visible desktop rows, narrow neutral proposal dialog, suggestion-only persistence, local dismissal, optional set-based rule flow, separate bulk confirmation, Spanish transfer review, metrics and 390px mobile containment. No browser errors.

Browser reproduction: start `node node_modules/vite/bin/vite.js --config tests/browser/finance.vite.config.mjs`, then run each browser script with Playwright available (or `PLAYWRIGHT_MODULE` pointing to its module). Both scripts block non-localhost requests. Set `FINANCE_BROWSER_ARTIFACTS` to capture screenshots and JSON; the insight suite writes `insights-evidence.json` independently of the original workflow evidence.

No migrations, parser changes, imports changes, permissions/RLS changes, hosted requests, deployments or real-data mutations. Outside Finance, only the explicitly requested Finance navigation display labels changed in MainLayout. The existing PO dataset was not accessed or modified. Master/Development Captain retains integration authority; this branch is not merged into dev or main by this work.
