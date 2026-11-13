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

## Approved authentication resolution

The PO subsequently approved email OTP for both existing production identities,
Resend custom SMTP, no Google/GitHub OAuth and no password/DEV shortcuts. Production
Login therefore renders only the email-code form. The Supabase request explicitly
sets shouldCreateUser=false; verification requires a real email OTP session.
Codes remain in component memory and are not logged or persisted by the app.
AuthContext still resolves canonical authorization after Supabase signs in;
no email allowlist or role shortcut is introduced. Nonproduction login is preserved.

Resend SMTP credentials are read only from the external local secret file and
configured in Supabase Auth, never Vercel/frontend variables. The email template
contains the OTP token rather than a magic link, with eight digits and ten-minute
expiry. Provider configuration remains pending until the verified sender and
Resend API key are supplied. Final sign-in acceptance is assigned to the PO for
both accounts; it must not be reported as PASS before confirmation.
