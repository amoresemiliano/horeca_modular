# Production target design — source audit proposal

Date: 2026-10-14. Status: implementation-planning input; not an approved schema or implemented API. Read together with [the legacy audit](PRODUCTION-LEGACY-AUDIT-2026-10.md) and [gap matrix](PRODUCTION-GAP-MATRIX.md). No historical records will migrate.

## 1. Minimum viable scope

Preserve the operator's simple job: see today's needs, log packages actually produced, review quantities in kg, confirm what happened, and find/correct earlier entries. Explicitly distinguish real production from receipts/transfers/sales withdrawals. Keep the current HORECA day/history/summary orientation while moving duplicated Production/Planning features out of Inventory after canonical replacements are accepted.

The MVP has four pages within the existing Production module:

| Page / navigation | Main actions | Ownership / dependencies |
| --- | --- | --- |
| Today (`Registro`) | Date/unit context, pending drafts, confirmed batches, + Log production, resume draft | Production facts; Core selected unit and authorization |
| Needs (`Planificación`) | Urgency cards, stock freshness, min/max, accept suggested quantity into a draft | Production planning policy; Inventory read projection, Catalog packaging |
| Batch detail | Product/package/count/date, optional actual inputs/recipe reference, notes, waste, review/confirm/correct | Production execution; Catalog/Recipe references, Inventory posting acknowledgement |
| History and summary (`Historial` / `Resumen`) | Filter/search, batch detail, immutable correction chain, unit-safe trends | Production-owned projections and Analytics handoff |

Do not add a separate production-order application, shift scheduler, purchasing workflow, label-printing system or costing engine merely because conceptual names were supplied. A planned draft batch can satisfy a requirement without a separate `ProductionOrder` table. Shift and optional notes can retain the useful existing HORECA fields. Shelf life/labels/recipe-based material requirements require owner contracts and are not recovered legacy features.

## 2. Entities and ownership

Names are conceptual. Final SQL names and migration timestamps require Master review; this document creates no migration.

| Concept | Minimum facts / invariant | Owner |
| --- | --- | --- |
| PlanningPolicy | org, unit, canonical product ID, stock-scope definition, decimal min/max, base unit, revision, active flag | Production replenishment intent; no master product or stock ownership |
| ProductionRequirement | product, projected stock/time/version, urgency, suggested kg, policy revision | Derived Production suggestion, not stock reservation |
| ProductionPlan | Optional date + accepted requirements; add persistence only if needed | Production; MVP may use planned draft batch instead |
| ProductionOrder | Not required as a separate MVP aggregate | Deferred proposal |
| ProductionBatch | org/unit, immutable server ID, effective date, optional shift, operator auth/profile ID, optional separate employee ID, product ID, draft revision, execution status, timestamps, notes | Production execution truth |
| ProductionBatchLine / ProductionOutput | batch, product/package ID, count, snapshotted net weight + unit/version, actual normalized quantity, destination Inventory location reference | Production output fact; Inventory owns receiving movement |
| ProductionConsumption | batch, canonical ingredient/preparation ID, actual quantity/unit, source location/lot reference, optional approved recipe-line reference | Production declaration; Inventory owns stock deduction/reservation |
| WasteRecord | batch, material/output reference, quantity/unit, reason, effective time, process-vs-stock-impact classification, confirmation identity | Production process fact; Inventory owns stock write-off when applicable |
| RecipeReference | recipe/version ID, approved yield/output unit, immutable reference/snapshot hash | Definition belongs to Escandallos; not a local recipe master |
| ProductionLocation | Foreign reference to an Inventory stock location and Core operational unit | No Production-owned warehouse catalog |
| ProductionNotes | Optional execution note; correction reason required separately | Production |
| PostingReceipt | batch revision, event IDs, downstream accepted/rejected/pending status and reference | Integration evidence, not StockLedger |
| Correction | original confirmed revision, reason, actor, corrected facts, compensating-event references | Append-only Production audit |

All owned headers and child facts must resolve the same organization and operational unit. Child foreign keys must prevent attaching a product, location, recipe or batch from a different tenant. Org-level masters may be shared only within the same organization, with their owner-approved eligibility. Do not assume an OperationalUnit is itself a StockLocation. Frozen goods in transit, reserved stock and sale staging need explicit Inventory semantics.

## 3. Statuses and human gates

Proposed minimal execution status: `DRAFT → CONFIRMED`. `DRAFT → CANCELLED` has no stock consequences. A confirmed batch is immutable. Corrections create a new revision/fact chain, and a full reversal is represented as `REVERSED` with compensating downstream facts; the original remains auditable. An optional planned flag/requirement reference on a draft distinguishes planned from ad hoc work without seven unproven lifecycle states.

Posting status is separate: `NOT_REQUESTED`, `PENDING`, `POSTED`, `FAILED`. Confirmed execution can be truthful while downstream posting is pending. Never show stock updated until Inventory acknowledges. Do not overload planning urgency (`CRITICO`, `NECESARIO`, `OPTIMO`, `EXCESO`) with execution or integration status.

| Human gate | Explicit review | Consequence |
| --- | --- | --- |
| Confirm batch | Product/package counts, kg, actual inputs if declared, effective date, unit/destination, waste and recipe version | Immutable execution revision and durable events; no direct ledger write |
| Confirm waste | Quantity/unit, reason, source stage, whether already included in input consumption | Confirmed waste fact; prevents double deduction |
| Correct confirmed batch | Before/after amounts, reason, original ID, Inventory dependencies and remaining stock feasibility | Append correction and approved compensations; never overwrite history |
| Inventory posting | Batch confirmation must explicitly disclose configured stock effects | Approved fact authorizes only its configured Inventory contract; no second silent plan-to-stock conversion |
| Stock count adjustment / transfer | User follows Inventory workflow and its confirmation capability | Owned entirely by Inventory; never implied by editing a Production field |

For automatically processed confirmed events, the explicit batch/waste confirmation is the human gate; delivery retries are technical and do not require repeated operator confirmation. If an Inventory correction needs a separate supervisor gate, leave it pending until that owner's capability approves it. Do not silently retry a semantically rejected command with changed facts.

## 4. Proposed server operations and validations

These operation names are planning contracts, not existing endpoints:

| Command/query | Required behavior | Idempotency / concurrency |
| --- | --- | --- |
| ListProductionDay / GetBatch / GetHistory | Authorize reads by org/unit, effective date, cursor, product and status; summary keeps separate units | Stable cursor; no browser-wide fetch of every tenant |
| EvaluateNeeds | Use authorized Catalog products, validated policies and Inventory availability snapshot | Return snapshot timestamp/version; missing stock is UNKNOWN, never zero |
| SavePlanningPolicy | Validate decimal limits and stock scope; separate admin/planner permission | Expected policy revision; unique org/unit/product/scope key |
| CreateBatchDraft / UpdateBatchDraft | Save actual selections and valid numeric inputs, no stock effects | Request key + expected revision; reject stale update |
| ConfirmBatch | Revalidate identity, capabilities, entitlement, references and revision inside a transaction; save immutable facts + outbox atomically | Unique org/unit/command/request key; same key+same payload returns prior result, same key+different payload conflicts |
| ConfirmWaste | Same scoped authorization and explicit stock-impact classification | Stable waste identity, no duplicate independent write-off for process loss already deducted in inputs |
| CorrectBatch / ReverseBatch | Require reason, reference original revision, append compensations rather than delete | Expected confirmed revision, unique correction request; handle downstream consumed-output rejection |
| GetPostingStatus / RetryDelivery | Show durable receipt; retry same events without changing business facts | Stable event IDs and downstream unique source-event constraint |

Validation requirements:

- Organization and OperationalUnit must be active, match each other and be explicitly authorized; derive actor from session, never payload. Recheck on server for every command. Platform capability alone grants no tenant execution.
- Product/package/location/recipe references must be active or explicitly valid historical snapshots, belong to the same tenant, and be eligible for the selected operation. Reject arbitrary names as identities.
- Counts must be finite, positive integers for discrete packages. Loose production uses validated decimal quantity in an approved unit, not fake fractional packages. Reject NaN, infinity, negative output and invalid decimal precision. Avoid binary-float accumulation in persisted totals.
- Snapshot `quantityKg = units × approvedNetWeightKg`; g↔kg and ml↔L are dimensional conversions. Do not convert volume to weight without an owner-approved density. Do not default unknown package to 1 kg or parse arbitrary label text as a conversion rule.
- Planning limits satisfy `0 ≤ min ≤ max`, compatible units and explicitly selected location scope. Preserve the later kg algorithm from the audit, including equality boundaries; raw stock and shortages remain visible. No silent negative-stock clamp.
- If suggesting package counts, explicitly decide whether ceiling-to-meet-target or manual rounding applies; show the resulting kg and difference. A floor may underproduce. Threshold equality (`min=max`) must have a defined state without division by zero.
- Effective business date is an explicit Europe/Madrid date; `recorded_at` is server UTC. Late entry does not falsify audit timestamps. Future-date restrictions and correction windows are configurable decisions, not invented legacy rules.
- Recipe scaling uses the immutable approved output basis from Escandallos. Formula, when available: `multiplier = targetOutputBaseQty / recipeOutputBaseQty`; ingredient targets come from that recipe version. Distinguish theoretical target, gross/net yield and actual consumption. Preserve actual overrides with a reason, never rewrite recipe definitions.
- Waste must identify whether it was lost during transformation from already-consumed inputs or removed from stocked material. The first is process accounting; the second can cause one Inventory write-off. Output-to-plan attainment is not mass yield. Mixed units must never be summed into a single merma percentage.
- On integration failure, keep durable confirmed fact and visible pending/rejected posting status; never substitute browser-generated stock, sample data or success toast. A feature with unavailable reference contracts stays gated.

## 5. Integration contracts

No current approved Catalog/Inventory/Recipe service is assumed available. Contract names below are proposed handoffs to those owners. Cross-domain direct table writes are forbidden.

| Domain | INPUT to Production | OUTPUT from Production | OWNERSHIP | TRIGGER | IDEMPOTENCY NEED |
| --- | --- | --- | --- | --- | --- |
| Catalog | Scoped active products, base units, eligible packages and immutable conversion version | Reference validation request, proposed master-data gap for owner review | Catalog owns product/packaging masters; Production stores IDs and execution snapshots | Draft selection and confirmation | Read/version consistency; master-change proposal key if such workflow is approved; no inline duplicate creation |
| Escandallos | Approved recipe/version, output/yield basis, ingredient requirements and optional cost snapshot reference | Actual input/output/waste measurements for variance analysis | Escandallos owns recipes/standard yield/costing; Production owns actual execution | Optional recipe-based draft then confirmed batch | Immutable recipe version/hash; actuals keyed by batch revision/event |
| Inventory | Scoped timestamped stock availability, locations/lots, reservation feasibility, posting acknowledgement | Confirmed output receipts, explicit actual-input consumption requests, classified stock waste, corrections | Inventory owns StockLedger, availability, lot/location masters, reservations, transfers and valuation | Confirmed execution or approved correction, never plan evaluation | Durable source-event ID uniqueness; atomic multi-line posting or explicit rejection; same delivery cannot post twice |
| Purchases | Owner-approved supply/reception status if later useful | Optional shortage signal, never a PurchaseOrder | Purchases owns suppliers, orders and receptions | Reviewed unmet requirement; not necessary for MVP | Signal key includes requirement/policy/snapshot revision; no auto-order or approval |
| Sales | Optional demand signal by canonical product/unit and cutoff | Optional available-production fact/projection link; no sale or ticket creation | Sales owns demand/sales; Inventory owns stock issue | Future planning refresh, not order confirmation | Demand snapshot version; do not deduct stock both on sale signal and manual withdrawal |
| Analytics | Query/filter contract, approved product/unit dimensions | Confirmed and corrected output/consumption/waste facts, planning variance and posting lag | Production owns facts; Analytics owns derived reports | Event publication after confirmation/correction | Unique event ID/revision; correction-aware aggregates, no duplicate original+replacement totals |

Proposed event envelope: `schemaVersion`, `eventId`, `eventType`, `organizationId`, `operationalUnitId`, `batchId`, `batchRevision`, `lineId`, `commandId`, `effectiveDate`, `occurredAt`, `actorProfileId`, `correlationId`, payload and optional `supersedesEventId`. Generate/persist event identity once with the confirmation transaction. Correlation ID alone is not deduplication. Never emit a new random business event on every retry.

Output payload identifies product/package/conversion snapshot, units and normalized quantity, destination location, and owner-defined lot fields if required. Consumption identifies actual quantity and source reference; recipe targets cannot silently become actuals. Waste declares its stock impact classification and related consumed-input/output IDs. Corrections reference original event IDs and approved compensating amounts. Inventory must validate all references and authorization context, return source event→ledger references, and safely handle repeated deliveries, unavailable stock, invalid units and partial failures. No Production operation may alter downstream stock balances directly.

Where no approved recipe exists, a manually declared finished-output batch may be designed, but approval of its Inventory posting mode and explicit "no ingredient deduction" semantics is a dependency decision. Do not invent a BOM or imply that such a batch proves input traceability. Until the owner agreement exists, log drafts only or keep confirmed facts in a non-posting controlled UAT mode, visibly distinguished from operational availability.

## 6. Security and Core Change Request

Use DEV's `public.can_execute_capability_for_org(org, capability, unit)` for unit-scoped operations, backed by active profile/membership, role template, explicit unit scope, revoke precedence and `produccion` entitlement. RLS must also protect all child tables and read projections. Selected UI context is not authority; reject cross-organization/unit IDs even if syntactically valid. Use fixed search paths/least privilege for privileged functions, do not expose service keys to browsers, and do not use session-variable-only tenant policies. Reuse Core identity/audit conventions instead of introducing a competing User table.

### CCR-PROD-001 — scoped Production capabilities and navigation

Exactly **one formal Core Change Request** is proposed. It covers registry semantics, least-privilege grants and corresponding module-read navigation; it does not ask Production to edit Core files itself.

| Capability | Current state | Proposed responsibility / grant review |
| --- | --- | --- |
| `production.batch.log` | Existing, OPERATIONAL_UNIT | Draft/log execution for explicitly scoped Production operators |
| `production.waste.log` | Existing, OPERATIONAL_UNIT | Declare waste; not implicit stock write-off approval |
| `production.view` | Proposed, OPERATIONAL_UNIT | Read-only day/history/summary without granting write; current module nav only checks log/waste capabilities |
| `production.plan.manage` | Proposed, OPERATIONAL_UNIT | Manage thresholds/accepted plans; planner/supervisor only |
| `production.batch.confirm` | Proposed, OPERATIONAL_UNIT | Explicit execution/posting gate; separately approved from draft logging |
| `production.batch.correct` | Proposed, OPERATIONAL_UNIT | Reasoned confirmed correction/reversal, supervisor only |
| `production.waste.confirm` | Proposed, OPERATIONAL_UNIT | Confirm waste with disclosed stock consequences, supervisor only |

All proposed codes require reviewed `produccion` entitlement metadata and negative authorization tests. Do not grant all codes to all roles or introduce a new broad "Production admin" bypass. The existing `PRODUCTION` template has batch/waste logging and inventory count; it does not imply `inventory.stock.view` or adjustment confirmation. If kitchen planning needs Inventory reads, agree a minimal explicit scoped read grant with that owner or a purpose-limited projection whose permissions are reviewed. Recipe viewing is similarly explicit. Managers/cooks/consultants obtain only approved capabilities; platform admins still need tenant membership. Required grants and entitlements are deployment decisions, not audit mutations.

Catalog/Recipe/Inventory schemas and contracts are separate owner requests. Master migration scheduling and adding module tables are delivery prerequisites, not justification for speculative Core changes. Do not reopen `produccion_registros`, `empleados` or `recetas` browser access to make the old screen work.

## 7. Mobile-first UX and operational acceptance

At 360–390 px, all critical actions must work without horizontal page scrolling. Use product cards with large primary count entry, package label/net kg, quick +/- steps, and visible calculated kg. Keep minimum 44 px touch targets, text beside status colors, and clear pending vs confirmed vs posting-failed badges. Use a burger menu and existing Core tenant/unit selector; never duplicate authentication or silently default to another unit.

Keep a sticky bottom "Review production" / "Confirm production" action on long forms; separate Save draft and Confirm with clear consequences. Product selection searches the canonical catalog, prioritizes recently used items within the active org/unit, and offers a request-to-Catalog path if missing. It must not silently create products from a kitchen form. Default business date to today; allow explicit authorized late-date entry with an audit trail. Numeric keyboards must accept approved locale decimal input and display normalized units.

Needs cards show product, actual availability scope/freshness, min/max kg, urgency and suggestion. "Create draft" copies a proposal; it never changes stock. Unknown/offline stock is visibly unavailable, not zero. A configurable combined-freezer projection can preserve the legacy aggregate intent only with authorized scope for every included unit; do not read unauthorized locations. Summary charts include all eligible products, stable colors and explicit zero values without fixed food-name arrays.

History uses stacked cards on phones, sortable tables only on wide screens; filters collapse into an accessible panel. Show effective date separately from recorded time, package counts and kg, actor, original/correction references and posting status. Corrections require before/after review and a reason. Preserve editable date from operator requirements without permitting silent edits of confirmed facts.

Mobile acceptance scenarios: log 20 × 1.5 kg = 30 kg; log mixed eligible formats with an explicit total; change active unit and verify context clears; create/confirm draft; retry after timeout without duplicate stock; see failed Inventory posting; find a late-dated batch; correct with reason; inspect chart zero-product row; complete every confirmation with touch and keyboard. No native offline stock mutation is in MVP; offline draft support would be a separate design decision.

## 8. Audit and reporting requirements

Record actor identity from auth, organization/unit, command/request key, batch revision, effective date, server timestamp, confirmation/correction reason, changed fact summary and downstream receipts. Keep immutable originals and linked compensations. Redact secrets and unnecessary personal data. Operational reports count effective confirmed facts with corrections applied; drafts/cancelled/reversed records must not inflate totals. Report by compatible base units and immutable product IDs, not names alone. Separate true mass yield (requires measured compatible inputs) from plan attainment and waste percentage with a documented denominator.

No operational value justifies backfilling historical legacy data. Optional threshold/configuration adoption requires owner review and master-reference resolution. The design is ready for WP estimation; production enablement requires the gates in [the implementation plan](PRODUCTION-GAP-MATRIX.md).
