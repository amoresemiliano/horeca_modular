# Login / access portal redesign review

Date: 2026-10-15. Branch: `feature/login-home-redesign`. Design source: `683a250ae021ebcce1b22a68b60484ce760890a7`, based on DEV `89abfb07c8d0fb2c45e6865da64515669c2d1057`.

## Result

The real `src/components/Login.jsx` now presents a responsive blue-gradient hero, eight capability chips, the official Vegen image with CSS-only negative treatment, a subtle watermark from the same image, and a compact access panel. Separate presentation components live in `src/components/access/`; their CSS is scoped to the access portal. Mobile composition is deliberately shorter than the standalone design so the submit button fits the initial 844px-high viewport at 375, 390 and 430px widths. Inputs use 16px text, autocomplete, explicit labels and 48px minimum control height.

The eight chips are descriptive, not navigation or a grant of module access. The reference directory remains intact and is never imported into runtime. No reference demo credentials, fake dashboard, simulated authentication, hand-drawn reference logo or remember-me behavior was imported. The actual PNG is unchanged; CSS crops its whitespace/leaf, blends away its white background and adapts the dark wordmark on blue while retaining green accents. No new logo or edited bitmap was created.

The normal login has no "Solicitar un nuevo enlace de acceso" section or replacement forgot-password control. Controlled recovery remains available on the existing `/reset-password` path when no recovery session is active; a valid recovery/invite callback still displays the new-password form. `requestPasswordReset` remains unchanged in AuthContext. Errors retain accessible feedback with friendly Spanish messages instead of backend internals. OAuth remains available when the password flags are disabled, including after recoverable errors.

## Preserved boundaries

Compared with the supplied source commit, these paths are unchanged: `src/App.jsx`, `src/main.jsx`, `src/index.css`, `src/context/`, `src/lib/supabase.js`, package/lock files, Vite configuration, all business modules, backend APIs, server code, Supabase configuration/migrations and `design-reference/login-home/`.

The DEV `VITE_DEV_PASSWORD_AUTH` and PROD `VITE_PASSWORD_AUTH` selection expressions remain unchanged. Login calls the same `loginWithPassword` and `loginWithProvider` functions; recovery calls the same `requestPasswordReset` and `updatePassword` functions. Session restore, PKCE/implicit callback handling, logout and tenant authorization remain in the existing runtime. No service keys or new authorization shortcuts were introduced. Test fixture entries are isolated from the production application and use the real AuthProvider/SDK with intercepted network responses.

## Validation

| Check | Result |
| --- | --- |
| `npm run lint` | PASS: zero errors, five preexisting unrelated warnings |
| `npm run typecheck` | PASS |
| `npm run test:run` | PASS: 49 files, 614 tests passed, one existing test skipped |
| `npm run build` | PASS; existing large-chunk warning and plugin-timing advisory remain |
| Local browser regression | PASS: 16 checks; no page exceptions |
| Widths 375 / 390 / 430 / 768 / 1024 / 1440 | PASS: no horizontal overflow; screenshot review |
| Keyboard-reduced viewport | PASS: password focus and submit scroll reachability at 390×500 |
| Protected source/config diff | PASS: all paths listed above unchanged |

Lint warnings remain in Configuracion, Inventory chart hooks/store and Presence. Browser tooling also reports an outdated Browserslist dataset; dependencies were not changed to hide that warning.

Browser checks run actual Login, AuthProvider and Supabase client against **synthetic intercepted HTTP responses**. They cover DEV/PROD password flags and request payloads, session restoration without a second password request, logout, denial of tenant access when an active profile is missing, same-origin recovery redirect, expired-link feedback, PKCE code exchange with browser-held verifier, recovery/invite implicit callbacks, actual password-update request and return path, OAuth provider redirects, and sanitized credential/recovery errors. No live login, email delivery, business write, tenant membership change or hosted Supabase availability is claimed or needed for this UI regression check. Broader positive/negative tenant authorization tests remain in the passing existing suite.

Run the browser suite with Playwright available: `node tests/browser/access_portal.mjs`. It accepts `PLAYWRIGHT_MODULE`, `ACCESS_BROWSER_CHANNEL` (defaults to Chrome), and `ACCESS_BROWSER_ARTIFACTS`. In this workspace `PLAYWRIGHT_MODULE=../../.local-data/tooling/node_modules/playwright/index.mjs` points to the existing local browser tooling. The suite starts/stops its own isolated Vite servers on ports 5191–5193. It never calls a live Supabase endpoint. Raw snapshots and measurements are regenerated under `.local-data/access-portal`.

## Visual evidence

The committed [browser measurements](login-home-redesign/evidence.json) and screenshots show the production flag configuration with synthetic test transport, not a production deployment:

- [375px](login-home-redesign/production-375.png), [390px](login-home-redesign/production-390.png), [430px](login-home-redesign/production-430.png)
- [768px](login-home-redesign/production-768.png), [1024px](login-home-redesign/production-1024.png), [1440px](login-home-redesign/production-1440.png)

Ready for Product Owner visual review on this feature branch. No merge to DEV/main and no deployment or database action is included. The Product Owner's visual acceptance remains separate from these automated/local checks.
