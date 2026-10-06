# Production state — HORECA Modular

Core + Banks production is active at https://horecamodular.vercel.app/ from main in the existing Vercel project vegen-s-projects/horeca_modular. Approved DEV source: 78fb5127793767120e49170f254edbaa92af49f8. Main history is retained; Sales PR #6 is excluded. The final SHA is declared through VITE_RELEASE_SHA and verified against deployment Git metadata and the served bundle; local release evidence records it.

DEV and PROD intentionally share canonical HORECA Supabase vmxjqwlfwnphorthhcwu, historically named horeca_modular_staging. Code environments remain separate. MICA is never a HORECA backend.

**EL CRIOLLO REAL DATA MODE = ACTIVE.** Organization f84168ef-2b78-451b-b0a9-39c1c381e59b is REAL PRODUCTION ONLY. NEVER load synthetic fixtures there, globally sanitize/reset it, or target it with automated destructive tests. The production smoke passed with its canonical Finance empty. The Product Owner performs real banking setup and imports manually.

**HORECA DEV LAB = SYNTHETIC / NON-PRODUCTION ONLY.** Code HORECA_DEV_LAB, organization f7f6da70-f7dc-4b1a-aa23-f5612174dcbc, has a separate Product Owner organization-wide OWNER membership and Banks-only entitlement. All future DEV/UAT fixtures and destructive tests must use it or another explicitly disposable tenant. It starts empty. No legal metadata was invented.

Production password login uses VITE_PASSWORD_AUTH=true and hides DEV-only presentation. Shared Auth defaults to PROD and retains both DEV and PROD callbacks. Invitations use the exact approved caller Origin; missing and arbitrary origins are denied. Browser keys are canonical public anon credentials. Privileged keys remain server-side.

RLS, capabilities, operational scope and entitlements remain authoritative. Platform authority does not grant tenant business access. Protected Finance fact writes use trusted RPCs; existing catalog writes require tenant-scoped RLS capabilities. Anonymous business access and direct privileged fact/Core writes are denied. Nine applied migrations remain unchanged.

Actual production smoke passed owner login, platform administration, tenant switching, Consolidado, Resumen, Métricas, empty catalog sections, rules and the import modal without uploads. No JavaScript or Supabase errors occurred. Read-only checks confirm empty Finance in both tenants, preserved existing Core/Auth/legacy state and unchanged security definitions. Taquería Maravillas remains REAL. Twelve unowned legacy categories and thirteen subcategories are preserved pending provenance review; they are not canonical Finance catalogs.

See [operating rules and next Sales stream](SHARED-PRODUCTION-OPERATING-RULES.md). No future global El Criollo cleanup is permitted.
