# Core platform shell, branding and authorization-scoped navigation

This correction supersedes the branding assumption in `CORE-SHELL-POLISH.md`. The current user-provided leaf/Vegen Digital logo was located as the original `logo_vegen_negativo.png` and copied unchanged into `src/assets/vegen-digital.png`. Its SHA-256 is `ddd51414e68d6f496e2eee27633585b54be1136862c572ad54816fae28c25c12`. No brand reconstruction or generated replacement was used. Login and the app header no longer reference the VDC asset. The left login panel has clean centered text/chips and a bottom registered-brand signature; the right column centers the original mark and sign-in copy.

## Context and authorization

Platform authority is still resolved through `core_platform_can`. A platform identity starts with no selected organization, including when it has only one membership. Empty selection is explicit and clears the previous organization/unit/permissions. Platform tenant choices come from the existing authorized metadata snapshot; these choices do not create memberships, grants or tenant data access. Selecting a tenant without membership leaves effective tenant capabilities and entitlements empty.

Platform navigation scope exposes the complete operational catalog for discovery. The catalog wraps so all module chips remain visible. A tenant-required module prompts for explicit tenant selection when neutral; with a selected tenant it must pass the existing entitlement/capability gates before mounting. The Organization sidebar entry changes to organization navigation scope, where only effectively authorized and enabled modules appear. Platform discovery visibility never authorizes execution. Both administrative sidebar labels stay concise. A discovered Organization entry without tenant administration authority displays an access-denied state.

Tenant users retain capability-driven navigation. Banks also requires sensitive banking access and an authorized section, preventing an empty-section landing. Role names do not determine module visibility. Context resolution clears old grants before asynchronous reads, fences obsolete responses using the existing request counter, and resolves candidates through the canonical server gate. Switching organizations recomputes the list; default landing uses the authorized list, so Banks-only access lands in Banks instead of Sales.

Backend/RLS authorization is unchanged. Existing PostgreSQL tests cover platform-versus-tenant authority, foreign-tenant denial and the canonical capability boundaries. No Sales implementation, migrations, Finance business logic, data resets or hosted business mutations were performed. No production deployment was initiated.

## Validation evidence

Unit regressions cover neutral platform selection/deselection, full catalog discovery without execution grants, Banks-only landing, disabled entitlements and banking section prerequisites. Browser evidence in `CORE-PLATFORM-SHELL-evidence.json` uses the local frontend with canonical hosted DEV, without hosted writes:

- Real platform identity: neutral login, all ten operational modules, explicit tenant requirement, El Criollo selection, organization context showing only Banks, and deselection restoring platform context.
- Real platform identity selecting a tenant without membership: module execution denied and previous organization navigation cleared.
- Restricted canonical RPC responses on the DEV identity: Banks-only landing, Sales absent and administrative entries absent. This is presentation/source-resolution evidence, not a claim of a separate hosted limited-user account audit.
- Desktop/mobile login: original logo, clean left panel, registered-brand signature, centered copy and no page overflow.

Validation passed: `npm run lint` (five existing warnings), `npm run typecheck`, `npm run test:run` (31 files, 413 passed, one configured skip), and `npm run build` (existing bundle/Browserslist warnings). The browser checks passed with no JavaScript errors. Production was not deployed.
