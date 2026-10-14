# DEV and PROD authentication incident

Status: BLOCKED. Verified on 2026-10-14. No business data, memberships, passwords, environment variables, or deployment protection settings were changed.

## Confirmed findings

- Both Vercel aliases resolve to READY deployments of commit `89abfb07c8d0fb2c45e6865da64515669c2d1057`.
- PROD: `https://horecamodular.vercel.app`, deployment `dpl_JQu6FsjSaVdphu3roNeSnLYzSLMw`, branch `main`.
- DEV: `https://horecamodular-git-dev-vegen-s-projects.vercel.app`, deployment `dpl_AqbjXVWAWvx2Z456QKBgUJnUxQYP`, branch `dev`.
- Supabase CLI lists the intended shared project `vmxjqwlfwnphorthhcwu` (`horeca_modular_staging`) as `INACTIVE`. Its API-key list is empty while inactive.
- The deployed PROD JavaScript references only `vmxjqwlfwnphorthhcwu.supabase.co`; it does not reference the unrelated MICA project.
- The project hostname returns DNS name-not-found. A control lookup for `supabase.com` succeeds.
- PROD loads successfully, but the actual Product Owner password login displays `Failed to fetch`. The recovery form also cannot obtain an Auth response. These failures occur before authentication or email delivery can complete.
- DEV redirects to Vercel login before reaching HORECA. Vercel reports SSO protection `all_except_custom_domains`. This is an additional access barrier for the DEV alias.
- The directly stored Vercel API token returns HTTP 403. The alternative authenticated Vercel CLI can inspect deployments and settings.
- Environment keys and scopes were inspected through Vercel CLI. Returned values are encrypted envelopes, so their plaintext contents and key validity were not verified. Do not interpret failed reference matching against ciphertext as configuration drift.

## Auth configuration and flow review

The current source fixes the intended shared Supabase project and uses the browser origin for recovery redirects to `/reset-password`. Invite/recovery implicit-token callbacks are supported on that route; ordinary callbacks use PKCE. Password login and recovery requests are implemented. The button labeled "request a new access link" requests password recovery, not a separate magic-link sign-in flow.

Historical local configuration records PROD SITE_URL `https://horecamodular.vercel.app` and redirect allowlists for both aliases and their `/reset-password` routes. This is historical evidence only: effective remote SITE_URL, redirects, SMTP prerequisites, templates, provider settings, and allowed flows could not be inspected while the project was unavailable. Current user activation, tenant memberships, platform roles, and module scope remain UNVERIFIED. No invite was issued, password changed, or identity recreated.

## Attempted correction and blocker

An authenticated request to resume the paused project through the documented `POST /v1/projects/{ref}/restore` endpoint was attempted using the existing Supabase CLI session. The prerequisite project inspection failed because this machine could not resolve `api.supabase.com`. No restore request was successfully submitted, and no remote correction was applied.

Supabase documents project resume here: https://supabase.com/docs/reference/api/v1-restore-a-project . This operation must not be confused with point-in-time backup restoration or reseeding.

## Required completion steps

1. Resolve Management API connectivity or resume the existing shared project from the Supabase dashboard. Preserve the same project and data; do not create a replacement, restore an old business snapshot, or reseed tables.
2. Wait for ACTIVE_HEALTHY and working project DNS/Auth endpoints, then inspect effective Auth settings, the Product Owner identity, and existing access memberships using read-only queries.
3. Give the Product Owner an authorized path through DEV deployment protection; review protection policy before changing it.
4. Repeat password login in both environments. Request recovery links with each environment's own redirect, verify actual email receipt and token acceptance, and verify expired-link handling and applicable invite acceptance.
5. Verify expected tenant/module scope without operational writes. Only then mark login and recovery PASS.

## Evidence

Sanitized public-browser evidence is retained locally in `.local-data/auth-public-check.json`; project/protection metadata in `.local-data/auth-project-status.json`. Diagnostic scratch files remain untracked and ignored. No new automated application tests were added because no application code was changed. Browser results are FAIL for DEV login, PROD login, and access-link flow; delivery and post-auth scope were not reached.
