# WP-FIN-003 — Daily classification and catalog workflow

Finance now supports classification directly in a movement row, a persistent catalog manager, and a dedicated attention-first summary. Implemented on `module/finance` after fast-forwarding the clean branch to the WP-FIN-002 integration commit `d3e193aaf32fcdd93ef92caa4783790f04f9f85c`.

## User workflow

- Classification starts with the persisted allocation or `UNCLASSIFIED`; banking sign never assigns an economic type. A generic save without a type stays `PENDING`. Suggestions remain visibly labeled until the user confirms them.
- Category, dependent subcategory, provider/counterparty, and economic type share the same field order. Changing category clears an incompatible subcategory; changing economic type preserves the catalog selections. Quick-create buttons refresh and select new entries without closing the dialog or losing the draft.
- A row opens only its own compact editor. Inline and modal saves use `classificationInput` and the existing `updateAllocationClassification` RPC adapter. Split movements open detailed editing; linked transfers remain protected.
- Catalog sections list existing accounts, categories, subcategories, and Finance counterparties. Saves keep the manager open and clear the form for another entry. Categories, subcategories and counterparties have name-only edits scoped by organization and ID. Account edits continue through the existing protected RPC. No deletion, new archive state, or Purchases Supplier ownership is introduced.
- Row icons have fixed compact sizes, stay on one horizontal line, and expose an explanation when disabled. A rule example requires exactly one meaningful confirmed generic allocation; ambiguous split examples and unclassified/transfer examples cannot seed a rule. Rule targets remain suggestions only.
- Primary filters cover search, account, status, and month. Economic type, category, counterparty and currency expand on demand. All filter changes clear bulk selections; confirming suggestions still requires the explicit selection dialog. Split interpretation filters must match the same allocation.
- Summary uses raw banking cards, one prominent attention state, confirmed operating figures only when present, smaller non-operating totals, and collapsed secondary analysis. Consolidado prioritizes filters, pending/suggested shortcuts and the table; banking totals are a compact footer. Gráficas retains detailed analytics.
- Switching tabs or active organization remounts the Finance workspace, discarding previous-context editors and selections. Small viewports scroll the table inside its container.

## Scope and invariants

**Migration count: zero.** WP-FIN-001/002 migration files, database policies, Core, Sales, parsers, imports and the canonical metric implementation are unchanged. No shared DEV mutation or Product Owner data access was performed for WP-FIN-003.

Internal transfers remain paired-review-only. Generic classification, rules and splits still exclude them, with unchanged server enforcement. Splits retain the exact-cents service and source movement immutability. Summary and analytics use the existing allocation-based `financeMetrics` function rather than interpreting bank signs.

## Validation

Local checks: lint has zero errors and eight existing warnings outside Finance; typecheck passes; 352 tests pass with one hosted opt-in test skipped across 27 files; production build passes. Existing bundle-size and Browserslist warnings remain.

The WP-FIN-001/002 SQL suites remain unchanged. Two prior UI wiring assertions were adapted to the shared field/submit helpers; the split option test now renders the actual component instead of checking a particular source-code expression. New tests cover neutral defaults, persisted suggestions, safe scoped renames, dependent catalog fields, filter combinations, and summary arithmetic for partially confirmed splits.

Synthetic Chrome browser verification passes at 1280×900 and checks contained scrolling at 390×844:

- positive/negative neutral initialization and no generic transfer option;
- one-line accessible action icons and disabled explanations;
- quick category/subcategory/counterparty creation preserving type, notes and selections;
- confirmed rule prefill and explicit save;
- inline classification using the same contract as the modal;
- repeated creation in all four catalog sections, all safe renames, account last4 and deactivate/reactivate;
- exact split balance, neutral new lines and category dependency;
- neutral and partially classified summaries, review CTA and minimized empty economics;
- all filters, cleared stale bulk selections and explicit confirmation;
- organization changes clearing an open editor; no console/page errors.

This is local/synthetic evidence, **not hosted Product Owner UAT**. Browser fixtures contain only invented movements and catalogs; Auth and Finance services are replaced and the browser blocks requests outside localhost.

## Reproduce the browser check

From the Finance worktree, start `node node_modules/vite/bin/vite.js --config tests/browser/finance.vite.config.mjs`. Then run `node tests/browser/finance_workflow.mjs` with Playwright available, or set `PLAYWRIGHT_MODULE` to an existing Playwright module file URL. Chrome is the default channel; `FINANCE_BROWSER_CHANNEL` can override it.

Screenshots and `evidence.json` go to ignored `.local-data/wp-fin-003-browser` (override with `FINANCE_BROWSER_ARTIFACTS`). No package dependency, hosted environment file or real banking fixture is needed. Integration into `dev` remains with Development Captain.
