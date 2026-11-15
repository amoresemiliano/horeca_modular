# Personnel production push provisioning

Standalone infrastructure branch: `feature/personnel-production-push`.
Base production SHA: `c25b4dedb533f6052eb77e7daa9ac17cb8fc78e0`.
Production: https://horecamodular.vercel.app; Supabase `cznauyzhtbqvqtwmfeki`.

## Final Product Owner policy, 2026-11-15

Entry: soft reminder at T−3 minutes, missing-entry check at T, one final
missing-entry check at T+15 minutes. Exit: missing-exit check at scheduled end
and one final check at end+15 minutes. There is **no +30 stage** or further
employee reminder. Existing management attendance views remain unchanged.
The canonical exit reminder still requires an open attendance session.

Every stage rechecks schedule revision/cancellation, active employee/device,
organization/unit assignment, module entitlement, opt-in/preferences, corrections
and actual punches immediately before transport. Each stage has an existing
subscription/shift/revision/kind unique claim. Uncertain sends are not retried
within a stage. The existing minute cadence and two-minute post-event eligibility
windows are retained; push TTL is 60 seconds. Delivery is best-effort, not an
attendance authorization mechanism or a guarantee of OS display.

## Canonical installation and production separation

Apply the previously omitted `20261111100000_personnel_push_reminders.sql`
unchanged, then additive `20261115120000_personnel_push_final_reminders.sql`.
The latter adds only final +15 stages and installs the existing recurrence date
resolver hook regardless of migration installation order. Resolution is limited
to opted-in employees. It does not replace attendance, scheduling, PIN or Core
authorization functions. No existing operational record is seeded or reset.

VAPID keys are generated specifically for production. Private key and cron secret
are kept in production Vercel secrets; scheduler authorization resides in Supabase
Vault. The subject is the production HTTPS origin. The frontend obtains only
the public key through the device-authorized status API. Preview/DEV variables
are preserved. `VITE_PERSONNEL_PUSH_ENABLED=true` exposes the existing opt-in.
The existing push activation adapter clears a previous browser's push association
on reactivation while retaining canonical activation/token/device behavior.

`scripts/personnel-production-scheduler.sql` installs a named production-only
pg_cron/pg_net job, initially disabled. The release enables it only after the
production backend and endpoint have been checked. The job reads its origin and
authorization from Vault; no secret is stored in cron command text. Its minute
cadence matches the established implementation. Anonymous/application roles
cannot read private subscriptions, Vault or cron. Hosted pg_net grants are owned
by `supabase_admin`; the installer verifies net is not exposed through the Data
API and app roles have no direct database login, matching the established DEV
scheduler boundary. Only trusted infrastructure database logins may access net.

## Lifecycle

Subscriptions remain PIN-confirmed and bound to organization/unit/employee/device.
One active endpoint and one binding per device are enforced by the canonical
indexes/RPC. Unsubscribe removes the server association and browser subscription.
Provider 404/410 disables and erases the invalid subscription. Revoked/expired
devices cannot subscribe or receive reminders. Shared attendance tablets should
keep employee-specific reminders disabled.

A missing browser subscription or changed VAPID key offers explicit re-enablement.
Explicit re-enablement also replaces a browser endpoint disabled by the server
after provider 404/410, even if its browser subscription object still exists.
No permission prompt, subscription creation or renewal runs silently on load.
PIN values are cleared after each opt-in attempt. The send endpoint records
provider success HTTP codes as well as failures, without logging endpoints/keys.

Existing installed personal PWA: open HORECA Personal, expand **Recordatorios de tu
turno**, enter the personal PIN, press **Activar recordatorios**, and allow
notifications. If permission is blocked, allow notifications in the browser/OS
settings first, reopen the PWA, and repeat explicit opt-in. Reinstallation and
device reactivation are not required for an already valid activated device.

## Validation boundaries

Tests cover both migration orders, final +15 timing, no +30, actual-punch and
correction suppression, duplicate claims, PIN proof, preferences, revoked devices,
unit isolation, provider 404/410 cleanup and private RPC/table permissions.
Production database fixtures—including immutable audit/punch facts—are exercised
inside a rolled-back transaction. Protected production data is fingerprinted
before and after provisioning. The browser lifecycle suite uses isolated local
fixtures. A separate temporary-browser provider/worker test attempts real Web
Push without creating employee or attendance records; its result is recorded
separately and is not inferred from the service-worker simulation.

Ignored operational evidence: `.local-data/push-provision/`. Private material is
never part of committed documentation or evidence. No Incidents, Payroll,
Leave/Vacation or unrelated UX changes are included.
