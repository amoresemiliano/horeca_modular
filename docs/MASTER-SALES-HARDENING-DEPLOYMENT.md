# Master — Sales hardening deployment

Date: 2026-10-08. Project: HORECA Modular. Source: `module/sales`, `349a7d98abf80689251810b73b6055efbfa9eaac`. DEV baseline: `efcb7c4544979c22107371099032ea9804412a65`. Shared Supabase: `vmxjqwlfwnphorthhcwu`.

## Migration and hosted safeguards

Fetched origin and verified the exact requested source and DEV baseline. The source migration `20261008100000_lastapp_request_budgets.sql` exists once, was reviewed, and was absent from the 12-entry hosted migration history. An isolated migration staging directory matched that history; dry run listed only this migration. Applied once using the linked project and verified the resulting 13-entry history. No existing migration was replayed or modified.

Hosted function privileges deny `anon` and `authenticated`, allow `service_role`, and deny browser table reads. An actual anonymous HTTP RPC returned permission denial (`42501`). The deployed function retains SECURITY DEFINER, fixed search path, row locking, bounded lock timeout and bucket capacity.

Rollback-only controlled SQL measured **402 ms** generic admission spacing and **2,000 ms** organization-discovery spacing. A reservation with a future eligibility time was denied. Two concurrent service-role HTTP RPC calls sharing one token/entity produced exactly one allowed reservation and one denial (392 ms remaining). Synthetic reservation state was deleted afterward; no Last.app HTTP request was made.

Together with the deployed client freshness bound under 1,000 ms, these spacings enforce at most **5 outbound starts/second** and **1,496/rolling ten minutes**, within the provider's 15/s and 1,500/10min budgets, and organization starts at least 1,000 ms apart. This is controlled database verification plus the deterministic 1,501-request local regression, not a ten-minute live provider load test. Shared coordination requires all server instances to use this database/RPC and the normal monotonic-clock/dispatch assumptions documented in [WP-SALES-006](WP-SALES-006-LASTAPP-HARDENING.md).

SHA-256 row fingerprints and counts of all **43 pre-existing public business tables** matched before deployment, after deployment and after hosted verification. No Core, Finance, Inventory or canonical Sales business data changed. Only the coordinator schema/history and temporary synthetic rate state were touched; no El Criollo Sales write occurred.

## Payment hardening and integration

Repeated the exact source's three targeted suites: **71 tests passed**. They verify duplicate and conflicting payment IDs reject, foreign Bill IDs reject, deletion state must be boolean, identity/type/time/money validation, valid partial/multiple/deleted/tip cases, unchanged minor-unit conversion and rejection before canonical persistence. Rate tests replay the exact SQL locally with a controlled clock and cover every-attempt admission, rolling limits, retries, Retry-After, concurrent callers, deadlines and unavailable coordinator behavior.

The full source validation from WP-SALES-006 remains valid: lint/typecheck/build/CSV performance passed; 570 full-suite tests passed with one skipped. Master integration contains this unchanged tested implementation and this deployment record. Source merge was started only after hosted checks passed. The final DEV SHA and Git-linked Vercel DEV result are verified after publication and recorded in the Master completion report. No main integration or Production promotion is authorized or performed.

## Remaining boundaries

The migration deployment prerequisite recorded in WP-SALES-006 is now satisfied. B1/B2 implementation and hosted coordinator checks pass. **B3 remains OPEN**, pending Product Owner evidence for Integrator ID, selected capabilities, events, callback and profile metadata. No production access, provider configuration, approval email, real webhook registration, El Criollo ingestion or automatic sync was introduced. Restaurant activation gates remain separate.
