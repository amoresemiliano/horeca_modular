# Personnel installable PWA

`/personal/fichaje/` is a separate Vite HTML/React entry, not an authenticated admin
screen hidden with CSS. It imports no MainLayout, AuthProvider, employee roster,
prototype fixtures or Supabase client. Its only data channel is `/api/personnel-punch`.
Existing Vite app, Core login and all other modules remain on the original entry.
Vercel rewrites route both trailing-slash forms to the built personnel HTML. The
branch-specific automatic-deploy block remains present; no deployment was run.

`public/personal/fichaje/manifest.webmanifest` defines stable id, start_url and scope
`/personal/fichaje/`, `display: standalone`, Spanish metadata, theme/background colors,
192/512 PNG icons and maskable purpose. The PNGs are rasterized from the checked-in
leaf SVG in existing brand colors, with safe central artwork. HTML includes iOS
home-screen metadata and touch icon. The employee screen offers Android install prompt
when available and concise Safari/Android installation instructions.

Activation link fragment → single-use POST exchange → Secure HttpOnly device cookie →
session check → PIN-only screen. Reload/start from home-screen checks the cookie-backed
session again; revocation/expiry clears authority and hides the keypad. No app account,
admin controls, employee lists, salary, phone, email or documents are fetched.

The service worker is scoped only to the punch URL and caches only a static offline
explanation. It never caches API responses, PINs, credentials, identity confirmations,
admin HTML or authenticated data, and registers no background sync. API POSTs are always
network-only. Offline while punching displays:

> No hay conexión. No se pudo registrar el fichaje.

Offline navigation/reload displays the static explanation and an explicit retry link.
There is no local attendance fact and no success confirmation without a server response
after DB commit. An uncertain-delivery request UUID can survive tab reload for manual
idempotent retry; there is no persisted PIN/request body or silent queued punch.

## Local verification

```sh
# Actual Vite multipage app / standalone PWA; endpoints mocked by browser test.
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5195 --strictPort
node tests/personal/pwa-browser.mjs

# Live admin adapter in the existing shell, synthetic auth/API only.
node node_modules/vite/bin/vite.js --config tests/personal/live.vite.config.mjs
node tests/personal/admin-browser.mjs

# Original prototype regression, unchanged synthetic service boundary.
node node_modules/vite/bin/vite.js --config tests/personal/vite.config.mjs
node tests/personal/browser.mjs
```

Browser scripts use existing Playwright installation or `PLAYWRIGHT_MODULE` (absolute
module URL) and headless Chrome. Evidence lives under `.local-data/wp-pers-pwa`,
`.local-data/wp-pers-admin` and `.local-data/personnel-prototype` during development;
the final WP evidence is copied to `docs/evidence/wp-pers-001/`.

Validated browser behavior is not a claim of an actual iOS/Android home-screen install.
Master must verify install UX, Secure cookies and revocation on a reviewed HTTPS staging
origin before enabling production. HTTP loopback is for synthetic browser tests only;
the backend deliberately refuses a non-HTTPS configured origin.

Primary references: [manifest scope](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/scope),
[service-worker lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).
