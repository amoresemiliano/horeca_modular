# Master — Last.app lifecycle webhook deployment

Date: 2026-10-09. Project: HORECA Modular. Source Sales SHA: `6e0548b389ca3e9ca4477b3fec12f6a0e979581f`; DEV baseline: `04704f3f21575d8675b062c6a75e89d0cf643990`; main baseline: `4ba2a1e1daec27339ec608dd8bc97511000cae38`. Target Supabase: `vmxjqwlfwnphorthhcwu`.

## Migration and hosted safety

Verified all three remote heads and reviewed the six-file Sales change and forward migration. `20261008110000_lastapp_location_lifecycle.sql` occurs once, immediately after the rate coordinator. It was absent from the 13-entry hosted history. Saved a private business-row backup, history and SHA-256 row fingerprints for all 43 existing business tables. The isolated migration dry run listed only lifecycle. Applied exactly once and verified the 14-entry history; existing migration contents were not changed or replayed.

Hosted checks deny anonymous/authenticated read and RPC execution, allow trusted server ingress and confirm RLS. Actual anonymous HTTP RPC/read attempts are denied. A rollback-only synthetic DEV LAB mapping exercised desintegration: it became inactive, the state became PAUSED and one receipt existed within the transaction. The transaction was rolled back. All 43 business-table fingerprints remained unchanged; installed TEST/DEV LAB routing and El Criollo were preserved.

## Integration and runtime

Sales was fast-forwarded into DEV. Main's existing production password-login presentation, shared-project guard, exact invitation-origin validation and real-data operating rules were reconciled into DEV before final validation. The five Sales runtime/handler/mapper files remain byte-identical to the requested source. No unrelated experimental module branch was included. Main history is preserved by promoting the approved descendant DEV state only after hosted DEV succeeds.

The server runtime uses the current rotated `LAST_APP_TOKEN` from the secure local source. Vercel secrets are read/written privately through authenticated API calls, never browser variables or logs. Required Supabase server variables use the exact shared project. Existing Production browser/auth environment remains unchanged except the declared `VITE_RELEASE_SHA`, which must identify the final promoted commit. No Auth configuration or Edge function redeployment is required by this webhook release.

Reconciled DEV validation: lint passes (zero errors, five existing warnings), typecheck passes, full suite passes (49 files, 614 tests passed, one skipped; one worker), build passes with existing warnings, and CSV performance passes its unchanged budget. A private scan confirms no current token in repository files and no token/service-role references in the client bundle. Production promotion is gated by these checks and the hosted validations below. Final Git SHAs, deployment IDs, response statuses and safety hashes are recorded in the private release evidence and Master completion report, rather than self-referencing commit hashes in this document.

## Hosted acceptance and portal handoff

DEV validation uses a unique synthetic unknown Location, Organization, Integration and event ID, and the supplied Integrator ID `ae7fb926-7f70-4bec-a9b7-1003121a4675`. It must prove empty 200 for integration, a single durable receipt after duplicate POST, PENDING_MAPPING without tenant/unit/mapping/Sales creation, safe desintegration to PAUSED with history retained, and invalid/missing token rejection without mutation. DEV protection bypass is allowed only for Preview testing.

Only after DEV PASS, promote the exact approved state to main and deploy Production with the rotated server secret. Production validation repeats the same acceptance on a separate synthetic location at **https://horecamodular.vercel.app/api/sales-webhook**, without Vercel bypass, cookies, browser login or Supabase user JWT. Verify READY deployment/main metadata, alias identity and the served client release SHA; verify privileged/token values are absent from the client bundle. Repeat business fingerprint verification after both validation stages. Synthetic lifecycle receipts remain as minimized audit evidence; no real provider API read or Sales ingestion is started.

After the Master completion report marks Production callback PASS, the Product Owner may manually configure exactly:

- Webhook URL: `https://horecamodular.vercel.app/api/sales-webhook`
- Events: `location:integrated`, `location:desintegrated`
- Sync method: `webhooks`
- Integrator ID: `ae7fb926-7f70-4bec-a9b7-1003121a4675`

This task never configures Last.app Portal. Synthetic receipt acceptance is not evidence of actual Last.app delivery or full portal/profile compliance. No El Criollo mapping, real ingestion, canonical Sale, tenant or OperationalUnit is created. Historical Core/Finance/Sales/Inventory business data and El Criollo real-data mode remain protected.
