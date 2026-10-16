# Login home final polish review

Date: 2026-10-15. Branch: `feature/login-home-redesign`. Base: `f1b9eb16ad02ae97f548790f24096ab578526498`.

The approved portal layout, logo assets and watermark remain. Restored the exact requested hero/login wording, Suite badge, desktop security label and module heading. All ten descriptive chips now use native buttons with 44px minimum targets, `aria-pressed`, a subtle selected border/background and one selection at a time. Clicking the selected chip clears it, matching the reference. The footer description is visible on mobile and announced through a polite atomic live region. No navigation or authorization is performed.

AuthContext, Supabase client, auth handlers and flags, callback/recovery logic, App/main, global CSS, dependencies, backend, migrations and business modules are unchanged. Login.jsx changes only the two normal-login text strings. No demo credentials or mock login were added to the application.

## Validation

- `npm run lint`: PASS, five existing unrelated warnings.
- `npm run typecheck`: PASS.
- `npm run test:run`: FAIL, LastAppRateBudget.test.ts beforeAll exceeds its existing 30-second timeout; 48 files pass, 607 tests pass, eight skipped. This timeout also occurred before this polish. No business tests or timeout settings were changed.
- `npm run build`: PASS, existing chunk-size/plugin-timing and Browserslist advisories.
- Access portal browser regression: PASS, 16 checks, no page exceptions. Real Login/AuthProvider/SDK with intercepted synthetic HTTP responses; no live authentication or email delivery is claimed.
- Browser coverage: exact copy, all ten modules including Compras/Ventas, each approved description, one selected state, default/toggle behavior, keyboard Enter/Tab/Space, touch selection, preserved password/session/recovery/callback/OAuth paths.
- 375, 390, 430, 768, 1024 and 1440px: PASS, wrapping chips, visible selection/description, no horizontal overflow, 44px targets and 16px input text. The extra chips and readable mobile description require vertical scrolling; submit reachability is verified, including a 390x500 viewport.
- Protected-path diff and `git diff --check`: PASS.

## Visual evidence

[Measurements](login-home-redesign/evidence.json) and screenshots are from local synthetic transport, with Compras selected:

[375px](login-home-redesign/production-375.png), [390px](login-home-redesign/production-390.png), [430px](login-home-redesign/production-430.png), [768px](login-home-redesign/production-768.png), [1024px](login-home-redesign/production-1024.png), [1440px](login-home-redesign/production-1440.png).

Run: `PLAYWRIGHT_MODULE=../../.local-data/tooling/node_modules/playwright/index.mjs node tests/browser/access_portal.mjs` (PowerShell: set the environment variable first). Chrome requires process-launch permission. The suite owns Vite ports 5191-5193 and writes `.local-data/access-portal`.

Ready for visual review on the feature branch. No merge, deployment or database action.
