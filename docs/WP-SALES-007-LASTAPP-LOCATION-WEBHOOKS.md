# WP-SALES-007 — Last.app location lifecycle webhooks

Master update (2026-10-09): lifecycle migration applied exactly once; hosted schema/security and rollback-only pause checks pass. Subsequent DEV/Production promotion is controlled by the [Master deployment record](MASTER-LASTAPP-WEBHOOK-DEPLOYMENT.md). The original no-deployment statements below describe the module WP scope.

Date: 2026-10-08. Project: HORECA Modular, Sales & Revenue. Branch: `module/sales`. Verified remote Sales starting SHA: `349a7d98abf80689251810b73b6055efbfa9eaac`; resynced by fast-forward to DEV `04704f3f21575d8675b062c6a75e89d0cf643990` before implementation. Main baseline: `4ba2a1e1daec27339ec608dd8bc97511000cae38`. Shared project: `vmxjqwlfwnphorthhcwu`. No shared migration or deployment performed here.

## Supported events and official contract

Adds exactly `location:integrated` and `location:desintegrated`, while preserving `tab:created`, `tab:closed`, `tab:cancelled` and `tab:updated` receipt/replay behavior. Unsupported event types fail closed.

Re-fetched [official Last.app v2 documentation/OpenAPI](https://developers.last.app/docs/index.html). API version is 2.0.0; extracted OpenAPI SHA-256 is `511b48b30b4ff75bab062a984819132885963401f337f5c4b5c76d2e17068e2d`. Its webhook discriminator maps both lifecycle event names to `location-2`. The schema/example has direct `id`, `type`, `created`, `data`; prose describes wrapping the event in `event`. Accept only these two explicit forms: direct event or `{ "event": <direct event> }`. Reject mixed wrappers, siblings and recursive wrappers. This supports the two documented representations without claiming real provider delivery has been observed.

Lifecycle validation requires a stable event ID, supported type, valid UTC ISO creation timestamp and Location UUID. Validate optional organization/integration/integrator UUIDs and bounded location/organization names when supplied; do not infer absent identifiers. Optional context headers must match the corresponding body identifier. Integrator ID, if present, must match the Product Owner's configured integrator. The contract does not mark those optional payload fields required; no invented Tab field is accepted as lifecycle identity.

Product Owner identifiers are distinct:

| Concept | Supplied value |
| --- | --- |
| Integrator | `ae7fb926-7f70-4bec-a9b7-1003121a4675` |
| TEST Location | `f7408208-75c8-4547-8862-f8748e2afac1` |
| Product/company | Horeca modular / Vegen Digital SL |
| Declared capability/method | Reporting (`isReport=true`) / webhooks |

Integration ID is an installation identifier supplied in event data, not either UUID above. Provider Organization ID is not a HORECA tenant ID. Unknown locations are never assigned to El Criollo or DEV LAB.

## Authentication and acknowledgement

Provider ingress uses `Authorization: Bearer <LAST_APP_TOKEN>` with the existing server-only credential and constant-time SHA-256 comparison. It requires no browser session or Supabase user JWT. Content-Type must be application/json. Authentication and validation precede trusted Supabase composition; malformed and unauthorized requests cannot mutate state. Unauthorized returns empty 401, malformed empty 400, durable storage failure empty 503. Accepted and exact duplicate events return **empty HTTP 200**, without HTML or a JSON wrapper, only after durable receipt succeeds.

The rotated credential's secure local source is `C:\Users\Emiliano\Documents\1. Sistemas\El Criollo\.local-secrets\lastapp.env`, key `LAST_APP_TOKEN`. No credential is copied into Git, docs, fixtures, logs or client code; regression authentication values are synthetic. This WP does not configure Vercel/portal credentials. Master must load the current rotated value for the appropriate deployment later.

## Lifecycle persistence and manual review

Exactly one new forward-only migration is prepared: **`20261008110000_lastapp_location_lifecycle.sql`**. Existing applied migrations are untouched. It creates a dedicated append-only receipt table and a location lifecycle projection, so an unknown location needs neither a tenant mapping nor `external_tab_id`. The existing Tab inbox schema and claim/replay functions remain unchanged.

Receipts retain only event ID/type/created/received timestamps, Location/Organization/Integration/Integrator IDs, bounded provider location/organization names and a hash of normalized minimized facts. Raw payloads, customer data, processor metadata and `integrationRequestToken` are discarded. Event identity is global within lifecycle receipts; an exact replay returns duplicate without changing state. Reusing an event ID with conflicting minimized facts rejects atomically. Provider Organization ID conflicting with an existing mapping rejects before any receipt or routing mutation.

An integrated unknown location is **PENDING_MAPPING**. Neither receipt nor projection creates an Organization, OperationalUnit, mapping or sync run. Future onboarding remains: installation → durable pending location → authorized admin review → choose tenant and approved unit → create mapping → activate sync. No onboarding UI or provisioning RPC is introduced.

De-integration records audit and sets **PAUSED**, deactivating existing mappings for that provider Location. Unknown locations are still accepted and acknowledged. Historical canonical Sales, lines, Bills, tenant, unit, checkpoints and audit remain intact. A later integration or older replay never reactivates routing; explicit human review is required. Provider-state metadata follows source creation time, with event ID as deterministic tie-breaker. Any authenticated de-integration conservatively pauses routing even if delivered late; provider_state and review_state can therefore differ until review. No ordering or delivery guarantee is invented.

Receipt/state/routing updates share one transaction and a location advisory lock. A canonical Sales trigger uses the same location lock, checks PAUSED and rejects API commits from already-running syncs. This also serializes the previously unknown-state case. The trigger does not update or delete historical Sales, and excludes CSV. Server mapping resolution separately denies a paused lifecycle state or unavailable state table, including if someone mistakenly re-enables a mapping without resolving the pause. New migration must be deployed before new runtime code.

## Trusted inspection and tenant boundaries

New tables use RLS with no anonymous/authenticated access. Only trusted service execution can receive events; service-role SELECT supports future admin tooling without exposing unmapped installations to arbitrary tenants. Inspection must remain on a server with appropriate admin authorization. Existing mapped tenant reads/replay permissions remain unchanged. Example trusted inspection:

```sql
SELECT l.external_location_id, l.external_organization_id,
       l.external_integration_id, l.external_integrator_id,
       l.location_name, l.organization_name, l.provider_state, l.review_state,
       l.last_source_created_at, l.updated_at,
       m.organization_id AS mapped_horeca_tenant,
       m.operational_unit_id, m.is_active
FROM public.sales_lastapp_location_lifecycle l
LEFT JOIN public.sales_location_mappings m
  ON m.external_location_id = l.external_location_id;
```

Human approval/reactivation tooling is intentionally deferred; there is no public action to clear PAUSED. An approved administrative review must resolve lifecycle state and routing together. Do not simply toggle `is_active`.

## Regression and quality evidence

Local PostgreSQL tests replay all migrations including the new migration, using only synthetic fixtures. Handler tests verify Bearer authentication, both envelopes, empty ACK, one durable duplicate receipt, pending unmapped state, no auto-provisioning/mapping/Sales writes, Tab dedup compatibility, failures before trusted composition, denied browser/anonymous privileges and trusted inspection. SQL tests verify pause preserves business snapshots, conflicting receipts/provider relationships roll back, reinstalls/stale delivery never enable routing, and paused canonical commits fail without changing prior facts. No real Last.app event delivery or hosted mutation is claimed.

All five required checks passed: lint (zero errors, five existing warnings), typecheck, full test:run (48 files; 603 passed, one skipped; one worker), build (existing Browserslist/chunk warnings), and CSV performance (one passed, one skipped; unchanged budget). A private check confirmed the current rotated token exists in its secure source, with zero occurrences in tracked/changed files and zero token/service-role references in client bundles. Existing rate coordinator, payment validation, `/100`, canonical contracts, resumability, checkpointing, CSV and DEV LAB mapping are preserved. Ingress performs no outbound Last.app read; later Tab refresh still uses the preventive coordinator.

## Master deployment and portal gate

The permanent provider-facing callback is **https://horecamodular.vercel.app/api/sales-webhook**. It is the future Production target; this WP does not claim current main serves lifecycle-capable code. Preview, git-dev aliases, localhost and tunnels are validation-only and must not be configured in Last.app.

Master must review/apply the new migration, integrate Sales into DEV, run controlled hosted tests, promote the exact webhook-capable code to main, configure the rotated server token in Vercel Production, and verify the stable callback is publicly reachable without Vercel/browser/Supabase user authentication while enforcing provider Bearer auth. Only afterward authorize the Product Owner to configure Last.app Portal with the stable URL and `location:integrated` / `location:desintegrated`. Retain only separately verified supported Tab subscriptions; unrelated events remain disabled. Do not configure the portal here.

Prepared hosted test: use a sanitized synthetic unknown Location/Organization/Integration UUID and a unique event ID with the real current token kept out of terminal output. POST a documented body to the deployed validation endpoint; verify empty 200, one durable receipt after replay, PENDING_MAPPING and unchanged Organization/Unit/mapping/canonical Sales counts. Capture row fingerprints before/after; use rollback-only or approved synthetic routing fixtures for desintegration validation. Never reuse El Criollo or the installed TEST mapping as a destructive fixture. No actual provider delivery is required for this gate.

B3 portal evidence remains open: supplied identifiers and declared scope do not prove logo/description/contact metadata, selected notifications, actual delivery envelope or Production reachability. No migrations applied, live canonical Sales writes, El Criollo changes, portal configuration, production access, DEV integration or main promotion occurs in this WP.
