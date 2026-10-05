# Final pre-production shell polish

Historical validation snapshot. The branding assumption and platform navigation behavior below are superseded by [Core platform shell fix](CORE-PLATFORM-SHELL-FIX.md).

Baseline: `dev` at `2431ada1e0b55725ffa5da6eabfb26de32b4cf9d`.

The shell uses the existing `src/assets/icono_VDC.png` platform asset at the top-left without adjacent text. The supplied attachment contained only instructions, so the existing VDC asset was retained. El Criollo's logo is inside its tenant selector with its name and displayed role. The control stays on one line; the header wraps and operational navigation scrolls at narrow widths.

The top navigation filters out administrative entries. The left sidebar provides concise Plataforma and Organización buttons using the existing `navigationAllowed` decisions. No role-name authorization, entitlement logic, backend authorization, Sales or Finance behavior changed.

Administration displays persistent auto-save guidance and a sticky live status. A successful mutation immediately announces “Cambios guardados”; saving and failure states remain distinct. A subsequent snapshot-refresh failure reports that the save succeeded but the view could not refresh.

Validation: lint passed with five existing warnings; typecheck passed; standard full suite passed 31 files / 410 tests with one configured skip; production build passed with existing bundle/Browserslist warnings.

Browser evidence uses the local DEV frontend with canonical hosted DEV. Restricted capability responses are simulated on the existing DEV identity, since prior synthetic users were removed. These browser checks demonstrate presentation under denied platform/admin and Banks-only access, rather than claim a new hosted normal-user authorization audit. Existing Core authorization/navigation and PostgreSQL tests remain green. Desktop 1440px and mobile 390px checks cover branding, selector layout and navigation. A real authorized DEV availability save submits its existing value. A successful role response is simulated to exercise the feedback without modifying memberships. No production deployment was performed.
