# WP-PROD-002 — Operational Production UX and scoped reads

Branch: `module/production`. Approved DEV base: `e9423023a656244fb2d30b65920c6091fd48784f`. The initial remote DEV and Production heads matched this base. No merge into DEV/main, hosted migration, hosted fixture or business-data operation is part of this WP.

## Delivered workflow

| Area | Behavior |
| --- | --- |
| Today | Selected effective date, planning needs, draft cards and recorded Production cards; no mixed-unit totals or fabricated stock |
| Entry | One manual finished output per batch, canonical product/package/destination selectors, positive integer package count, visible exact normalized quantity, optional approved loose quantity, shift and notes |
| Review | Separate review of date, product, package/conversion, quantity, destination, mode and notes before saving a draft |
| Confirmation | Separate review and explicit acknowledgement before the confirm command; logging permission alone never enables confirmation |
| Planning | Scoped min/max policies, optional capability-gated policy editing, approved boundary states and replenishment suggestions; unavailable/invalid stock remains UNKNOWN |
| History | Effective date/status/current-output product filters, stable 20-item keyset pages, timestamps, actor profile reference, revision and pending posting |
| Detail | Current outputs and actual consumptions, immutable execution chain, classified waste and durable pending outbox events |
| Correction/reversal | Capability-gated explicit paths, required reason, original/replacement values for correction and retained history with pending compensation for reversal |

The existing Production entry now mounts the canonical module. It no longer reads/writes `produccion_registros`, `empleados` or `recetas`. Existing Core navigation remains unchanged and supports read-only `production.view`. Outer Registro/Resumen entries open Today; Historial opens history, with module-local Today/Planning/History controls.

The first kitchen entry deliberately retains the legacy simplicity of one product/output per batch. Multi-output and recipe-reference batches remain readable, with explicit editing restrictions rather than silently discarding lines or inventing recipe context. A full reversal remains available to authorized users. Existing explicitly declared consumptions are preserved during supported draft edits/corrections; this WP does not introduce consumption entry or theoretical ingredient deductions.

## Application/read boundary

`ProductionReadService` creates scoped projections over SELECT-only Production tables. Every parent/child request includes organization and operational unit; batch children also filter the batch, and waste confirmations filter the bounded waste IDs. RLS is authoritative. No service credential, direct mutation, global dataset fetch or Core-profile join is used. Actor IDs come from authorized Production facts; no employee identity is substituted.

History embeds the current execution snapshot through the named current-execution FK. Product filtering uses two bounded server-filtered streams: draft/cancelled normalized draft outputs and current immutable outputs, merged before keyset pagination at PostgreSQL microsecond precision. Reversed batches have no current output and therefore do not match a current-output product filter; they remain visible without that filter. History orders recorded timestamp + UUID, retaining recorded audit time separately from effective date. Prior execution consumptions remain expandable after correction/reversal; an empty current reversal never conceals those original declarations.

Planning policies page 20 at a time. Detail reads at most 50 execution snapshots, 100 waste declarations and 100 outbox events, with an explicit truncation notice if more exist. These immutable snapshots supply normalized outputs/actual inputs from the same server confirmation transaction. Waste confirmations are combined inside the read service. Numeric policy/waste fields are requested as text to avoid binary-number loss; historical output quantities/conversions remain the server's frozen decimal strings.

Typed owner read ports describe approved scoped products, current eligible package/conversion versions, allowed loose mode, locations, optional recipe versions and versioned/timestamped stock availability. The installed runtime port returns unavailable with empty collections. It is not a Catalog/Inventory/Recipe adapter. Owner-approved options are scope-filtered; payloads send canonical IDs, counts and explicit declarations, never client-authored authoritative conversion snapshots.

## Quantities and planning

Package preview reuses the canonical fixed-point helper: 20 × 1.5 kg displays 30 kg. It appears immediately after quantity entry, with an accessible live update. Unknown conversion, fractional/nonpositive count, unsupported dimension or unapproved loose mode blocks review/save. No package-name parsing, 1 kg fallback or volume-to-weight guess exists. Server normalization remains authoritative and confirmation revalidates references.

Effective dates default to Europe/Madrid, including UTC-midnight boundaries. Recording timestamps retain server audit time. Manual-output wording explicitly explains that finished output is declared without inferred ingredients or ingredient traceability.

Planning calls the existing canonical boundary helper. Equality cases 30, 47.5 and 100 retain their approved states for min=30/max=100. Suggestions appear only for CRITICAL/NECESSARY. Missing or malformed stock, incompatible units or absent availability metadata remain UNKNOWN; missing stock is never zero. The UI displays observed time/version when a future owner port supplies a usable projection. Freshness policy and canonical availability acquisition remain owner-contract work.

## Capabilities, commands and failures

The runtime combines current entitlement, selected unit and Core `can(...)`; components never infer authority from role names. `production.view` permits consultation. Logging, confirmation, correction, policy management, waste logging and waste confirmation each use their own capability. The application command session checks current permission before dispatch or cache return; the existing server RPC rechecks full canonical authorization.

Each exact command intent retains its UUID, in-flight promise and successful result in the mounted scope session. Duplicate clicks coalesce; uncertain retries reuse the same identity, while changed intent receives a new one. A new entry keeps its entity UUID through retries. This is a session guard, not a replacement for durable server idempotency. Full page reload discards the local intent cache; users should inspect canonical drafts/history after an uncertain result before starting a new batch.

Stale revisions and confirmation mismatches block further submission until explicit refresh/review, without displaying a false in-flight state. Known server business codes map to safe Spanish messages; raw SQL diagnostics are not exposed. Owner-contract unavailability produces an understandable error and never triggers fallback reference creation. Successful commands refresh canonical detail; a subsequent read failure is presented separately from command success.

Context keys include auth identity, organization and unit. Read effects discard superseded responses, and scope changes remount the command/editor state. Losing permission cannot authorize a cached retry. Read failures support explicit refresh and do not substitute test data.

## Waste and posting

Waste registration and confirmation remain separate. Process loss selects an explicitly declared input and sends no second removal location; output loss selects an output/destination; stock removal selects an approved material/source. Quantity, reason and classification remain explicit. Only current-execution unconfirmed waste exposes confirmation to the appropriate capability. Superseded declarations remain visible as history.

Confirmed Production never appears as stock-on-hand. Outbox types are translated into readable pending output/actual-consumption/waste/compensation entries. No delivery worker, posted-success state, override or Inventory write is introduced. Reversal conserves execution facts and explains the pending compensation.

## Mobile and verification

Cards replace the legacy primary tables. Fields stack on narrow screens, controls have at least 44px touch height, decimal/count keyboards are requested, focus states remain visible and long identities wrap. Standalone module browser checks cover 320/390/768/1440px without horizontal overflow. These are isolated module checks, not hosted activation or full-shell UAT.

Automated coverage includes scoped real-PostgREST-client query construction, paging/filtering/detail caps, exact conversion, explicit manual mode, loose validation, planning boundaries/UNKNOWN, permission denial, duplicate submit/uncertain retry identity, safe stale/unavailable errors, read-only entry, immutable confirmation/correction/reversal, waste gates/classifications, scope switching and responsive behavior. Browser doubles live only under tests and block every external request. No synthetic rows or owner reference is installed in shared Supabase.

Final gates: lint PASS (zero errors, five existing warnings); typecheck PASS; full `npm run test:run -- --maxWorkers=1` PASS (53 files, 702 tests passed, one skipped, 159.27s); build PASS (final build 21.14s); CSV performance PASS (one passed, one skipped, 4.12s total with the unchanged per-import budget). Module lint, typecheck, build and the complete browser runner were repeated after the final historical-consumption presentation adjustment. No unrelated timeout threshold was changed.

The browser runner passed nine workflow/check groups, all four responsive widths, zero page errors and zero external requests. Evidence: [browser report](production-ux/browser-evidence.json), [mobile entry](production-ux/mobile-entry.png), [desktop entry](production-ux/desktop-entry.png), [mobile history](production-ux/mobile-history.png). These images explicitly identify isolated HORECA DEV LAB test doubles. Run `node tests/browser/production_ux.mjs` with Playwright installed or `PLAYWRIGHT_MODULE` pointing to an existing Playwright module; Chrome is the default browser channel.

Existing warnings remain visible: unused variables in Configuracion/Inventory/Presence, Inventory hook dependencies (five lint warnings in total), stale Browserslist data, the bundle exceeding 500kB, and Vite plugin timing warnings. Initial browser checks exposed ambiguous select labels and a stale-revision button incorrectly retaining a saving label; both were corrected and the complete final runner passes. PostgREST-client tests caught JSON-array filter serialization and verify the corrected scoped product streams. The final production bundle was checked to exclude the synthetic fixture label.

## Deployment and WP-PROD-003 handoff

New migrations: **NONE**. Applied Core/Production migrations and protected Core persistence are unchanged. Hosted migrations applied: **NO**. El Criollo touched: **NO**. Inventory direct writes: **ZERO**.

Real activation still requires approved owner read services and fail-closed execution reference resolution, explicit tenant enablement by authorized administration, canonical Inventory availability/posting/compensation and receipts, optional recipe/version contracts, and multi-backend race hardening. WP-PROD-003 owns those integration agreements; this module remains unavailable for execution until they exist. Full multi-output/recipe editing and deeper detail pagination can extend the current read/entry ports without replacing the approved aggregate. No operational production-readiness claim is made.
