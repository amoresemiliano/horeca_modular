# CCR-PERS-PROD-001 — first Personnel production activation

Date: 2026-11-13. PO authorization: first Personnel production deployment and
fixes within its scope. Extends the environment delivery recorded in
CCR-CORE-ENV-001; no Core authorization/schema mutation is introduced.

Production project: `cznauyzhtbqvqtwmfeki`; origin:
`https://horecamodular.vercel.app`.

The ten-migration production foundation already exposes the service-role-only
`personnel_device_command('activate',...)`. Set server-only
`PERSONNEL_ACTIVATION_MODE=foundation` to use that command directly. The existing
optional push activation adapter remains unchanged for installations without that
setting. Browser input cannot choose the activation adapter or supply tenant,
unit, previous-device authority or device hash. The server creates the random
device token, submits hashes, and sets the same secure host cookie after success.
No RPC grants, tables, memberships, entitlements or role templates change.

In production the optional push opt-in UI is hidden unless
`VITE_PERSONNEL_PUSH_ENABLED=true`. Leave it false for the initial foundation,
which has no push schema, VAPID configuration or scheduler. DEV behavior remains
unchanged. Reminder delivery is outside this release.

Focused tests exercise foundation activation without the optional RPC, secure
cookie handling, production target guards and PWA boundaries: 31 passed.

Production authentication remains a release gate. Password and DEV shortcuts
must remain disabled. At review time Google/GitHub providers and custom SMTP are
not configured. A production OAuth or SMTP service must be supplied securely and
validated before a usable no-password login can be released. This contract does
not authorize fabricating provider credentials, changing user passwords or
claiming a service-role-generated session as end-user login acceptance.
