# Final Core SaaS UX closure

Development Captain delivery on `dev`, following WP-CORE-003. Production is excluded.

## Invitation acceptance

The reported 404 was reproduced at the hosted DEV `/reset-password` URL. Vercel had no rewrite for this application callback. `vercel.json` now serves `index.html` at that route, including direct navigation and refresh. The dedicated callback retains its existing invite/recovery token handling and password setup; ordinary OAuth retains PKCE. The login screen offers a new access link for expired or consumed links and uses neutral platform branding.

The verified Supabase DEV project `vmxjqwlfwnphorthhcwu` had the production-looking `https://horecamodular.vercel.app` as its Auth Site URL. Only that setting was changed to `https://horecamodular-git-dev-vegen-s-projects.vercel.app`. Configuration comparison verifies that all other remote settings, including providers and redirect allowlisting, were preserved. The invitation function already targets this DEV origin plus `/reset-password`.

The actual Supabase Auth Admin invitation verification link was followed in a browser through hosted Vercel, using a disposable identity. Direct callback and refresh returned HTTP 200; password setup and subsequent password login passed; the spent link could not reopen password setup. This supersedes the earlier test that constructed an invitation fragment locally. The Vercel preview retains deployment protection: automation establishes a temporary bypass cookie for the cross-origin return and revokes its temporary bypass secret afterward. Human testers need access to the protected DEV preview; this is separate from tenant authorization.

A fresh secure setup/recovery email was sent to the previously authorized real recipient without replacing its Auth identity or membership. Actual mailbox acceptance remains a human confirmation, distinct from the automated link test.

## Administration and branding

The approved local `src/assets/icono_VDC.png` asset identifies Vegen Digital in the login, shell and platform context. El Criollo's existing logo appears only within its active tenant context. The tenant selector is labeled accordingly; platform-only users receive no tenant logo or business navigation.

Platform administration separates tenants, lifecycle, commercial modules, user provisioning metadata and audit. Tenant administration separates general information, memberships, profiles/permissions, operational scope and audit. Presets precede collapsed advanced permissions. Effective decisions still come from the server, and raw permission codes appear only in advanced details.

Tenant creation and editing support display/unique code/trade/legal names, tax ID/type, business or fiscal address, country, base currency, timezone and contact email/phone. Optional legal fields remain blank unless supplied. Lifecycle remains platform-only. The existing canonical El Criollo organization and operational IDs are preserved. Custom uploaded or external tenant-logo URLs were not introduced; existing trusted local tenant branding is retained.

`20261003000000_core_saas_ux.sql` is applied to DEV after the prior Core chain. It adds three optional contact/address columns and updates authorized RPCs. `tenant.update` requires platform tenant authority or `org.config.write` for the requested tenant. A private helper validates an explicit field allowlist, types, lengths, unique code, tax type, country/currency format and timezone, locks the organization, and records before/after metadata. Direct browser execution of that helper is denied. Identity/lifecycle fields cannot be smuggled through metadata updates.

## Access presets and audit

Four public application presets map to CONSULTANT plus exact capability overrides. Existing preset keys remain compatible; there are still exactly 13 role templates and MANAGER grants remain unchanged.

| Preset | Access |
| --- | --- |
| BANKS_VIEWER | Consolidado, Resumen, Métricas and banking reads; no import or modifications |
| BANKS_IMPORT_OPERATOR | Consolidado and upload/process/confirm; no classification, catalog, rules, transfer or reconciliation actions |
| BANKS_RECONCILIATION_OPERATOR | Banks views, allocation/classification and separate reconciliation review/confirm capabilities; no tenant administration or import/catalog management |
| BANKS_ADMIN | All Banks sections and actions; no unrelated modules or tenant administration |

Applying a preset explicitly replaces overrides and preserves scope. Role-only changes preserve exceptions, which the UI explains. Audit displays the actor, action, tenant, target member, a human-readable change summary and timestamp. Internal identifiers remain collapsed; Auth secrets are never included.

## Verification

Embedded PostgreSQL tests execute the full migration chain under real roles/RLS, including full metadata creation/editing, foreign-tenant denial, invalid and privileged input rejection, private helper denial and exact capability sets for both new and legacy presets. Hosted DEV checks cover platform-only isolation, OWNER administration, all four new presets, cross-tenant business/metadata denial, audit actor resolution, entitlement and operational scope. Browser UAT covers branding, administration separation, Viewer/Import/Full profiles and persistent metadata editing in the disposable tenant.

Safe execution evidence is kept under ignored `.local-data/core-ux/` and `.local-data/core3/`; secret/session files are not committed. Reusable browser assertions live in `tests/browser/core_saas_assertions.mjs` and were executed against the hosted DEV preview.

Final results: lint has zero errors and five existing warnings; typecheck and build pass. The complete suite passed 410 tests with one existing opt-in test skipped. A subsequent final run had 409 passes and a five-second timeout in the existing environment-boundary suite; its isolated rerun passed all four tests without changes. Build retains existing bundle-size and Browserslist advisories. Hosted authorization, browser profiles/metadata editing, actual invitation callback and entitlement/scope checks are PASS. Browser checks ran against application SHA `3e85031e4258c1c9e7a19279bacbb8a4b6f0e149`; the remaining delivery commit adds only evidence and the executed reusable browser assertions.

Cleanup verified eight synthetic Auth identities, seven synthetic memberships and one disposable tenant removed, with no tracked invitation tickets or synthetic profiles remaining. Exactly one canonical El Criollo is preserved, along with the other legitimate tenant, Taquería Maravillas. The cleanup assertion was corrected to check canonical uniqueness instead of assuming the whole SaaS must contain only one tenant. The Product Owner's separate OWNER/platform authorities and the real invited member remain active. El Criollo's three accounts, 320 movements and 320 allocations retain their preflight hashes. A temporary Vercel automation bypass left by an interrupted test was explicitly revoked; no earlier bypass was removed. Local fixture sessions were cleared.

The fresh real-mailbox link was accepted for delivery by Supabase. Human confirmation of receipt/setup remains pending; automated hosted acceptance uses its own disposable identity. Delivery is IN_DEV, not a declaration of Product Owner sign-off or production readiness approval.

## Separate production gate

Before promotion, Master must verify production Supabase and Vercel identities, backup and review the complete migration chain, configure the actual production Site URL/redirects and email delivery, deploy the callback rewrite and trusted function, and keep service credentials server-side. Bootstrap the platform administrator independently of the canonical El Criollo OWNER and approved entitlements. Confirm that no disposable test identities or operational facts enter production. Test a real invitation from a fresh browser, expired/reused links, password setup, smoke profiles and foreign-tenant isolation. Retain an application rollback plan compatible with the forward security migrations; do not restore permissive legacy access. Product Owner acceptance and production deployment remain separate gates. See also `WP-CORE-003-PRODUCTION-GATE.md`.

References: [Vercel Vite deep links](https://vercel.com/docs/frameworks/frontend/vite), [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Vercel automation bypass cookies](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).
