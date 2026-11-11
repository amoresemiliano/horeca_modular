# Personnel punch security

## Credentials and deployment gates

Node runtime uses asynchronous scrypt N=32768, r=8, p=1, 16-byte salt, 32-byte output,
64 MiB maximum memory and timing-safe comparison. A server-only random pepper protects
the four-digit PIN space if database material alone is disclosed. Tenant-bound HMAC-SHA256
provides the private credential lookup/uniqueness key; it is NOT the password hash.
PIN collision across organizations is harmless; active stored PIN lookup is unique inside
an organization. Reset generates cryptographically random digits with unbiased `randomInt`,
replaces the hash/revision and returns plaintext exactly once to an authorized admin.
Neither hashes nor lookup digests are returned by admin snapshots or device HTTP responses.

Runtime is disabled unless both explicit backend enablement and required server config
are present. Backend URLs are pinned to the canonical project. Keys/pepper never use
`VITE_` prefixes. Same-origin HTTPS Origin validation, POST-only requests, bounded bodies,
no-store responses and no permissive CORS protect both endpoints. Secrets are never logged.
Public environment examples are empty/disabled; the branch contains no working credentials.

## Device activation and session

An authorized admin issues a 256-bit token bound to tenant/unit for ten minutes. Only
its SHA-256 digest is stored. The token is carried in a URL fragment, immediately removed
with replaceState before any HTTP call, then exchanged by POST exactly once under a
database lock. The page has a no-referrer policy and no external fonts/analytics.

The server generates a distinct 256-bit device secret; only its digest is stored privately.
The browser receives `__Host-personnel-device` in a Secure, HttpOnly, SameSite=Strict,
Path=/ cookie with a 90-day maximum; the DB independently enforces expiry and revocation.
The session endpoint returns only organization/unit display names and timezone. This
credential never authorizes the Personnel admin endpoint or any HORECA module. Activation
does not create Auth users. Issued activation grants expire independently after ten minutes;
the organization entitlement and active organization/unit are rechecked on consumption.

## Canonical server command

The HTTP boundary rejects extra employee/organization/unit/time/verified properties.
Identity and scope come only from the cookie-resolved device and server PIN lookup.
The trusted server has a narrowly auditable two-phase operation:

1. A private device preflight consumes distributed device/org attempt budgets, records
   a PIN_ATTEMPT audit fact without PIN/lookup, and issues a one-use 30-second permit
   bound to device, employee candidate, credential revision and request UUID.
2. The backend performs scrypt (including equal-work dummy verification for unknown PINs).
3. The service-role-only execute RPC consumes that permit and, under device/employee
   locks, revalidates device/expiry/revocation, entitlement, active organization/unit,
   active employee, local-date assignment and exact credential revision. It determines
   IN/OUT, checks duplicate/idempotency conditions and atomically inserts the immutable event.

Scrypt is outside a DB transaction, not incorrectly represented as a PostgreSQL primitive.
Its permit/credential revision binds that check to the atomic commit, so resets, employee
deactivation and device revocation cannot be bypassed between verification and commit.
The `verified` flag exists only in the service-role RPC, never accepted from the browser.
Anonymous/authenticated roles cannot execute that RPC or access private schema relations.

Requests are limited to eight attempts/device/minute and 120/organization/minute, with
activation limited to ten/IP-key/minute. Counters are database-backed/serialized, including
across Vercel instances. IP keys are HMACs of the platform forwarding address, not stored
plaintext addresses. Device/org budgets remain authoritative even if an IP changes.
Invalid, inactive and wrong-unit employee attempts share `PIN_REJECTED`; no candidate
identifier or roster is returned. Database audit facts record attempts, rejection/throttle,
activation, reset, revoke, administration and successful commits without attempted PINs.

The same `(device_id, request_id)` returns its committed event after current authorization
and PIN validation. Reusing it for another employee is rejected. Cross-device double taps
within five seconds are suppressed under the shared employee lock. The UI retains only
an opaque pending request UUID in sessionStorage for uncertain delivery/reload; PINs and
device secrets are never persisted there. Explicit user retry can reuse the UUID; there
is no background/offline punch queue or automatic replay.

## RLS and trusted RPCs

All new tables enable RLS. Public fact tables have Core-integrated admin SELECT policies;
browser table privileges are revoked, so the MVP intentionally reads through gated snapshot
RPCs. Private credentials/activations/permits/counters/audit have no browser policies or
schema privileges. Admin SECURITY DEFINER commands use pinned pg_catalog search_path,
canonical capability/entitlement checks and composite tenant/unit FKs; there are no broad
anonymous inserts or `USING (true)` policies. Core/user/auth tables are not altered.

## Master operational handoff

Review secret provisioning/rotation, TLS exact origin, backup/rollback, error telemetry
redaction, distributed budget tuning, one-time link sharing, device revocation and rate/
activation/attempt retention maintenance before deployment. The 4-digit UX has deliberately
limited entropy; protect the pepper and tune budgets/alerts to observed restaurant load.
Audit/event retention must be explicitly owned; no destructive cleanup job is installed.
This branch does not claim a hosted penetration test or real-device rollout.

Primary runtime reference: [Node crypto scrypt](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback).
