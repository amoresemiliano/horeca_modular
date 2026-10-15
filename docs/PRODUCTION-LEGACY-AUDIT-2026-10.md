# Production legacy audit — October 2026

Audit date: 2026-10-14. Domain: Production / Kitchen Operations. Result: source audit complete; implementation and hosted validation not performed.

## 1. Scope, evidence, and safety

The source root is `../inventario` relative to the repository checkout, under the El Criollo ecosystem. The audited remote branch is `module/production` at `b710bb9c89d2f2e9ca6573a88a2cbac23dae3b36`. Remote `dev` is `89abfb07c8d0fb2c45e6865da64515669c2d1057`; both refs were independently checked with `git ls-remote` during this audit.

Only source files, local Git objects, remote Git refs, and the local requirements document were read. No legacy PHP endpoint was called. No database was queried, no application was run against live data, and no migrations, business rows, credentials, or module source were changed. Documentation is authored in a separate audit branch based on DEV, not in `module/production`. Existing untracked Production drafts were inspected without editing or staging them.

Evidence vocabulary:

- **SOURCE**: behavior traceable to actual implementation; not a claim that this exact snapshot is deployed.
- **REQUIREMENT**: intent recorded in `inventario/Lista ajustes Jules.odt`; not necessarily implemented.
- **PROPOSAL**: recommended HORECA design, clearly separate from legacy behavior.
- **UNVERIFIED**: exact live legacy revision, live MySQL DDL/triggers, and runtime behavior. Their absence does not prevent source-based planning.

Fifteen application variants and 129 relevant files were inventoried, including generated assets and the requirements attachment. Per-file byte lengths and SHA-256 identifiers are provided in [the source manifest](production-audit/source-manifest.json). Credentials in `db.php` were not copied into this report. The manifest includes hashes, not file contents or business records. Folder numbering does not establish deployment precedence.

## 2. Legacy source landscape and stack

| Folder | Traced implementation | Persistence / relevance |
| --- | --- | --- |
| `warehouse_v1` | DOM-rendered movement/production tables and navigation | In-memory sample records; initial UX sketch |
| `warehouse_v2` | DOM role navigation, admin dashboard, registration modal | Simulated roles and records |
| `warehouse_v3` | DOM table templates including stock, production, planning | Sample planning rows; no executable persistence path |
| `warehouse_v4`, `warehouse_v5` | React UMD/Babel views, stock calculation, registration, planning | In-memory/demo actions; min/max suggestions in units |
| `warehouse_v6` | React dashboard, charts, recalculated threshold planning | In-memory; critical/necessary/optimal classifications |
| `warehouse_v7` | React with PHP session login calls | Inventory/planning explicitly placeholder components; registration simulated |
| `warehouse_v8` | React inventory editing/planning plus PHP login files | Frontend calculations/state; no fetch path found in application code |
| `warehouse_v9` | React session/data loading from PHP | `get_movements.php` read path; registration still a simulation |
| `warehouse_v10` | React UMD/Babel plus PHP/MySQL movement registration | Actual frontend → `add_movement.php` → joined movement response path |
| `warehouse_v11` | Most extensive PHP-backed variant: roles, edits, adjustment confirmation, catalogs, thresholds | Real server-operation code, but local response/DB-driver inconsistencies prevent treating snapshot as deployment proof |
| `v12` | React UMD and Chart.js; product/stock demo | In-memory product management; login PHP files not wired by frontend |
| `v13`, `v14` | React context/store, editable movements, planning/dashboard | In-memory state, with unused session PHP files; do not infer DB persistence from their presence |
| `inventory-app` | React 18, Vite 7, CSS, context store, custom SVG charts | `localStorage` operational state; PHP avatar upload is wired, general PHP CRUD is not wired |

`inventory-app/package.json` also declares Axios, date-fns, React Router and Recharts. Dependency declarations do not establish usage: view selection is React state, calculations are local, and charts inspected are custom SVG components. Its Vite base is `./`. The UMD variants load React/ReactDOM development builds and Babel from unpkg in `index.html`; PHP-backed JS hardcodes `https://el-criollo.com/es/inventario_v3/api`.

PHP uses MySQLi (`$conn`) with prepared statements in session login and movement creation/read. Several `warehouse_v11` administration endpoints instead expect PDO (`$pdo`), although the supplied `db.php` defines a MySQLi connection and no PDO connection. The standalone React variant uses six browser keys: `criollo_movimientos`, `criollo_usuarios`, `criollo_productos`, `criollo_formatos`, `criollo_presentaciones`, `criollo_almacenes`. Planning thresholds are component state, not one of these persisted collections.

Generated `inventory-app/dist` code differs from checked-in `src` in details including movement-date editing and format selection. It is another evidence snapshot, not an authoritative replacement for source. No supplied SQL DDL was found. Some product PHP files are zero-byte stubs. A request for a complete SQL file in the ODT is not evidence that it was delivered.

## 3. Evidence index and traced paths

Paths below are relative to `inventario` unless prefixed `HORECA`. Line numbers refer to the audited snapshot; named functions remain useful if line numbers drift.

| Evidence | Path / anchor | What it proves |
| --- | --- | --- |
| E01 | `warehouse_v11/app.v1.4.js:7`, `App:1088`, `fetchAllData:1110` | Hardcoded API origin, session/bootstrap and parallel catalogs/users/movements loads |
| E02 | `warehouse_v11/app.v1.4.js:184`, `api/add_movement.php:7` | Registration validation, client actor ID, signed integer persistence, joined readback |
| E03 | `warehouse_v11/app.v1.4.js:143` | Stock derived from signed movements grouped by product and format names, hardcoded warehouses |
| E04 | `warehouse_v11/app.v1.4.js:826`, `api/update_stock.php:16` | Preview/confirm stock adjustment UI, mutable `inventario` balance and adjustment rows |
| E05 | `warehouse_v11/app.v1.4.js:273`, `api/manage_movements.php` | Mutable edit/delete correction path |
| E06 | `warehouse_v11/app.v1.4.js:929`, `api/manage_catalog.php` | Product-level min/max fields, ratio colors, admin edit/server update |
| E07 | `warehouse_v11/app.v1.4.js:585`, `:1219` | Chart restricts Vallecas receipts; production table accepts all receipts |
| E08 | `inventory-app/src/store/store.jsx:77`, `:109`, `:154` | Browser persistence, kg conversion, instant stock adjustments |
| E09 | `inventory-app/src/views/PlanningView.jsx:12`, `:30` | Five hardcoded kg thresholds and four planning states |
| E10 | `inventory-app/src/views/ProductionView.jsx`, `MovementsView.jsx` | Vallecas receipts vs complementary movement list |
| E11 | `inventory-app/src/views/LoginView.jsx:14`, `src/App.jsx` | Email-substring role choice, unused password, role-based view selection |
| E12 | `inventory-app/src/components/modals/ManageUsersModal.jsx:65`, `api/upload.php` | Only wired frontend PHP request: avatar upload; image conversion/compression |
| E13 | `inventory-app/src/components/charts/ProductionLineChart.jsx`, `AdminDashboard.jsx` | Chart unit/filter discrepancy and duplicated planning defaults |
| E14 | `inventory-app/src/index.css:275`, `warehouse_v11/style.v1.4.css:444` | Card-style mobile table CSS vs narrower desktop-table adjustments |
| E15 | `Lista ajustes Jules.odt` → ZIP `content.xml` | Operator requirements for kg, all products, burger nav, editable date, freezer semantics |
| E16 | HORECA `src/modules/produccion/ProduccionApp.jsx:19` at `b710bb9` | Existing daily register/history/summary with direct legacy-table calls |
| E17 | HORECA DEV `supabase/migrations/20261002020000_core_legacy_fail_closed.sql` | Legacy production/employee/recipe browser access intentionally revoked |
| E18 | HORECA DEV `20260927000000_ccr_fin_001_core_authorization.sql`, `20261002030000_core_module_entitlement_registry.sql` | Trusted org/unit capability gate and module registry |

### Registration trace

In `warehouse_v11`, `UserDashboard` opens `RegisterMovementModal`; required product/format/presentation and quantity > 0 are checked before POST. `add_movement.php` requires a session, resolves selected names to IDs, takes `usuario_id` from the payload, signs `Salida` negative and all other types positive, casts quantity to integer, inserts `movimientos`, and returns the joined movement directly. The frontend checks `result.movement` instead of accepting that direct response, so the successful insert may not update local state until reload. `warehouse_v10` accepts the direct response. This is a source mismatch, not a verified report of production deployment failure.

In `inventory-app`, the modal composes a format string from format + presentation, multiplies quantity by movement sign, attributes a fixed user, and calls context actions. Those actions only change React state/localStorage. Login does not call the supplied PHP login endpoint. Merely having PHP scripts in the folder does not make this a DB-connected flow.

### Endpoint and configuration inventory

These are source routes, not a live service enumeration. UMD and React pages select views in client state rather than having a route for each screen.

| Route / file | Caller and operation | Auth / consistency observation |
| --- | --- | --- |
| v11 `login.php`, `check_session.php`, `logout.php` | Login POST; session GET; logout GET | PHP session path, password verification; logout invalidates session |
| v11 `get_movements.php` | Bootstrap GET, joined movement history | Session required; all rows, no org/unit scope; joined response omits actor ID needed by some filters |
| v11 `get_catalogs.php`, `get_users.php` | Bootstrap GET, master lists | No session gate in these supplied PDO-based files; supplied DB adapter is MySQLi |
| v11 `add_movement.php` | Registration JSON POST | Session required, referenced names validated; actor still supplied by client |
| v11 `manage_movements.php` | JSON POST `update` / `delete` | No session/capability gate; mutable original fact |
| v11 `update_stock.php` | JSON POST full stock list and actor ID | No session/capability gate; transaction and dual balance/history writes |
| v11 `manage_catalog.php` | JSON POST `create` / `update` / `delete` | Table whitelist; no session/capability gate; product min/max integer casts |
| v11 `manage_users.php` | Multipart POST `create` / `update` / `delete`, optional avatar | Method check and password hashing; no session/admin gate; extension-derived file upload |
| v11 `add_product.php`, `update_product.php`, `delete_product.php` | No wired frontend path found | Supplied files are empty; do not count as implemented product APIs |
| v10 counterparts | Session/movement/catalog PHP plus product-named files | Earlier snapshot; registration expects direct movement response correctly; not v11 feature parity |
| v8/v12/v13/v14 `hash_passwords.php` | Maintenance script, not wired to operational frontend | Out of target scope; do not execute credential maintenance during audit |
| React `api/login.php` | Supplied but not called by `LoginView` | Verifies stored `password`, returns role/name, does not establish the session flow used by v11 |
| React `api/api.php?action=...` | Supplied `getData`, `addMovimiento`, `deleteMovimiento`, `addGeneric`, `deleteGeneric`, `updatePlanificacion` | No frontend operational caller found; no session gate; no update-movement handler |
| React `api/usuarios.php` | Supplied GET/POST/PUT/DELETE | No frontend user CRUD caller found; current UI changes localStorage; no session gate |
| React `api/upload.php` | Wired avatar multipart POST and OPTIONS | No auth gate; image MIME/decode, resize/compress then filesystem write |
| `api/db.php` variants | Included server connection/header setup | Hardcoded connection values and wildcard CORS; values withheld; not a safe HORECA configuration layer |

Cross-origin credentials are not explicitly enabled in the v11 fetch calls. Successful PHP sessions therefore depend on actual hosting/origin and cookie configuration; source does not prove safe cross-origin deployment. No environment-based backend routing or documented deploy manifest establishes the active legacy revision.

### Actual entities inferred from code

No schema dump was supplied, so the following describes fields referenced by source, not verified types, constraints or triggers.

| Entity | PHP-backed references | React/local representation and implication |
| --- | --- | --- |
| `movimientos` | `id`, `fecha`, `tipo`, `cantidad`, `usuario_id`, `producto_id`, `formato_id`, `presentacion_id`, `almacen_id` | `usuario`, `producto`, `formato`, `almacen` strings, quantity and optional presentation/adjustment marker; separate React PHP schema uses `usuario_email` |
| `productos` | `id`, `nombre`, v11 `min_stock`, `max_stock` | ID/name masters; limits separately hardcoded in component state |
| `formatos` | `id`, `nombre` | Combined labels and `peso_kg`; not consistently compatible with separate presentation selection |
| `presentaciones` | `id`, `nombre`; joined in movement read/create | Separate label list, sometimes concatenated into format name |
| `almacenes` | `id`, `nombre` | Fixed Palencia/Vallecas strings despite editable list |
| `usuarios` | ID/name/email/role/phone and photo; login references `password_hash`, management references `password` | Local users with synthetic actor attribution; React PHP uses `foto`, v11 uses `foto_url`; no uniform schema contract |
| `inventario` | Product/format IDs plus `stock_palencia`, `stock_vallecas` in adjustment endpoint | No equivalent canonical table; browser derives stock from movement history |
| `planificacion` | Referenced only in React generic PHP API, with `producto`, `minimo`, `maximo` | Not read/written by current React planning screen |

The local React `addMovement` also does not assign a date, while the source registration modal does not supply one and report cells expect `fecha`. The generated bundle includes different date handling. This further supports treating source and generated assets separately rather than claiming runtime parity.

## 4. Complete functional map: 18 identified flow groups

This count groups repeated versions of the same action and related create/edit/delete operations. It includes supporting Inventory/Core screens so their ownership can be separated. It is not a count of canonical Production features.

| ID / screen or action | Purpose / actor | Inputs → outputs | Validation and dependencies | Side effects / resulting state |
| --- | --- | --- | --- | --- |
| F01 Login / logout | Establish access; all operators | Email/password → role/user or error | PHP variants verify password hash and session; React variant chooses role by email substring | PHP session set/destroyed; demo role only. Core owns target auth |
| F02 Role navigation | Expose relevant views; admin/user/chef | Current role and selected menu → screen | v11 `admin`, `usuario`, `cocinero`; React `admin`, `usuario`, `cocina` | UI view state only; not server authorization |
| F03 Home dashboard | Quick operational picture; admin/kitchen | Movements, derived stock, fixed thresholds → latest movements, stock, production need, recent production | Local aggregation; React defaults duplicated from planning | Read/projection only; no production order is created |
| F04 Register receipt | Record packages arriving/produced; user/chef | Warehouse, product, format, presentation, positive quantity → signed positive movement | v11 required selections and >0; PHP checks referenced names but trusts actor | DB movement or browser record inserted; derived stock increases. Vallecas production is inferred, not an explicit event type |
| F05 Register withdrawal | Record frozen stock leaving; user/chef | Same selections + `Salida` → negative movement | No traced availability reservation or paired destination check | Movement reduces derived stock; no paired transfer, sale, or ingredient consumption entity |
| F06 My movement history | Review own entries; user/chef | Current actor, optional dates, display limit → table | v11 filters by user ID or name; GET response omits user ID. React filters fixed email | Read only; 10/20/50/all means prefix length, not server pagination |
| F07 Edit movement | Correct entry; v11 admin / React user | Selected row, quantity/type/date/location/product/format → overwritten row | v11 required fields; frontend normalizes signs, including making adjustment positive; no revision guard or correction reason | DB UPDATE or localStorage overwrite, stock/report recalculation; original fact lost |
| F08 Delete movement | Remove erroneous entry; admin / React user | Row + browser confirm → removal | No immutable reversal or server capability proof in management PHP | Hard DELETE/filter, stock/report changes; no compensating inventory event |
| F09 Stock overview | See freezer quantities; admin/kitchen | Movement collection + formats → stock by product/format/location and total | v11 sums package counts; React converts via format weight, silently defaults missing weight to 1 kg | Projection only, owned by Inventory in target |
| F10 Adjust counted stock | Reconcile physical quantity; admin | New counts for two warehouses → deltas/confirmation | v11 tracks changed rows and preview; no concurrency guard. React adjusts on each input change | v11 writes mutable balance and `Ajuste` rows; React creates receipt/withdrawal with `esAjuste`; Inventory-owned |
| F11 Production report | Review produced packages; admin | Date/product/format/user filters → receipts table | React restricts `Ingreso` at Vallecas; v11 table includes receipts anywhere | Read only; receipt and production semantics differ by version |
| F12 Movement report | Review stock circulation; admin | Date/actor/type/warehouse filters → signed movements | React excludes Vallecas receipts; v11 includes all movements; substring/exact filter implementations vary | Read only; owner Inventory, with links back to Production facts |
| F13 Planning suggestions | Detect shortages; admin/chef | Derived stock + min/max → urgency and suggested quantity | v11 units/ratio colors; React kg/four states; no recipe computation | Read-only recommendation; no batch/order/reservation is created |
| F14 Edit planning limits | Tune replenishment targets; admin | Product min/max → updated suggestion | v11 writes integer product fields; React Number() with no range check | v11 catalog DB update, React component-only limits lost on remount; separate from actual production |
| F15 Catalog maintenance / inline create | Fast selection setup; admin, some demo modal users | Names for products/formats/presentations/warehouses → lists | v11 table whitelist and required name; React prompt/local actions | Master-data writes outside target Production; renaming string identities can orphan joins |
| F16 User maintenance | Maintain operator directory; admin | Name/email/role/password/phone/photo → users | v11 email duplicate check/password hashing; other script has default password; frontend role gating only | User create/update/delete; Core/HR responsibility, not Production |
| F17 Avatar upload | Improve operator recognition; admin/user editor | Image file → URL | React MIME prefix check; PHP accepts JPEG/PNG/GIF/WebP and resizes longest side to 300 | Filesystem JPEG upload at quality 80; no Production data import |
| F18 Charts / filters | See trend and stock distribution; admin/kitchen | Movements/date selection/product visibility → monthly lines, stock bars | v11 dynamic products and Vallecas filter; React fixed five products, raw package counts despite kg label | Read only, per-view filter/legend state; no export action found |

### Explicitly absent from the inspected legacy source

No production-order lifecycle, persisted plan/requirement, batch identifier, recipe execution/BOM, raw ingredient consumption linkage, process yield, waste entity, approval workflow, immutable correction chain, linked warehouse transfer, expiration/lot labels, or dedicated production notes was found. No Production CSV/XLS import/export, PDF/print-label operation, or historical-data migration code was found. Avatar upload and ES-module `export` statements are not production-data import/export features. These absences must not be hidden by renaming a movement a batch.

## 5. Domain extraction and ownership

| Legacy concept → function | HORECA target concept | Decision / owner |
| --- | --- | --- |
| Vallecas `Ingreso` → receipt interpreted as newly cooked frozen goods | `ProductionBatch` with `ProductionOutput` plus Inventory receipt | SPLIT; Production owns execution, Inventory owns ledger; use explicit origin instead of warehouse-name inference |
| Min/max screen `plan` → computed replenishment list | `ProductionRequirement` projection and planning policy; optional accepted `ProductionPlan` | ADAPT; no persisted legacy plan exists |
| `Producir X` text → replenish toward max | Suggested requirement quantity | KEEP formula/clarity, ADAPT stock scope and numeric safety; never imply confirmed order |
| Generic movement row → signed quantity fact | Production output only when origin is production; otherwise `InventoryMovement` | SPLIT; do not migrate movements into Production |
| `Salida` → freezer withdrawal | Inventory withdrawal/transfer/sales issue, as explicitly classified | MOVE; not automatically `ProductionConsumption` |
| No order entity | `ProductionOrder` | Optional proposal only; defer separate order aggregate in MVP |
| No batch lines | `ProductionBatchLine` / output packaging lines | New target structure; do not claim source equivalence |
| No ingredient-consumption entity | `ProductionConsumption` | New declared actuals + Inventory contract, not inferred from freezer withdrawals |
| No waste entity | `WasteRecord` | Target proposal; HORECA's existing merma input is a different source |
| Planning CRITICO/NECESARIO/OPTIMO/EXCESO | Planning urgency | KEEP/ADAPT; not `ProductionStatus` |
| Ingreso/Salida/Ajuste | Inventory movement types | MOVE; not production execution statuses |
| Palencia/Vallecas almacenes | Inventory stock locations referencing Core OperationalUnits | ADAPT; no hardcoded location names |
| Product and package/presentation | Catalog product and versioned packaging conversion | MOVE masters to Catalog; Production snapshots execution conversion |
| No recipe reference | `RecipeReference` | New cross-domain reference; Escandallos owns definitions and yields |
| No production notes | `ProductionNotes` | Optional target text; do not infer from absence of a movement comment field |
| User/profile/session | Core identity; optional HR employee reference | MOVE; signed-in user is not employee identity |

## 6. Inventory interaction audit

The ODT describes freezer stock: Vallecas receipts mean newly produced goods going into its freezer; Vallecas withdrawals mean either sale staging/direct issue or dispatch to Palencia; Palencia receipts replenish its freezer and withdrawals leave it for sale. New locations should be possible. This is recorded operational intent, not a linked-transfer implementation.

| Behavior | Actual source | Classification and target |
| --- | --- | --- |
| Produced output | Receipt at Vallecas increments movement-derived stock; no explicit production batch | KEEP AS PRODUCTION FACT, REPLACE WITH EVENT/CONTRACT for ledger posting |
| Inputs consumed | Generic withdrawals, no ingredient/BOM linkage | MOVE TO INVENTORY for stock issues; only explicitly declared batch actuals become Production consumption facts |
| Waste | No legacy waste workflow found | Do not infer waste from a negative movement; target confirmed waste fact routes once to Inventory when stock-impacting |
| Stock read | Sum signed counts by product/format and the two names; later React multiplies format weight | MOVE TO INVENTORY; Production consumes a scoped, timestamped availability projection |
| Adjustment | v11 computes delta against `inventario`, updates its columns and inserts `Ajuste`; React adds movement per keystroke | MOVE TO INVENTORY with count vs confirmation gate; remove adjustment controls from Production |
| Transfers | Separate manually entered out/in movements; no linked ID/atomic pairing | MOVE TO INVENTORY; paired dispatch/receipt contract, never two unrelated Production batches |
| Corrections | Movement edit/delete changes derived stock without updating the separate balance table | REPLACE WITH EVENT/CONTRACT; append correction/reversal facts and Inventory compensations |
| Sales-bound withdrawals | Manual stock departure; no sale linkage | MOVE TO INVENTORY/Sales integration; do not count as consumption of ingredients or new production |

The dual truth problem is concrete: `add_movement.php` writes movement history, `calculateStock` derives UI stock from that history, while `update_stock.php` computes deltas against and updates `inventario.stock_palencia/stock_vallecas`. The supplied creation/edit/delete paths do not synchronize that separate balance. Adjustment inserts also omit `presentacion_id`, while reads inner-join presentations, so NULL presentation adjustments may disappear from reads or violate live constraints. Live DDL is unavailable; both outcomes remain possibilities.

Production must own neither stock balances nor direct Inventory writes. A plan has zero stock effects. A confirmed execution fact is submitted via a versioned integration contract with durable deduplication and posting acknowledgement. A lost acknowledgement must not lead to double receipt on retry.

## 7. Recipes, costing, units, and calculations

No recipe/BOM/cost-sheet calls, portions scaling, ingredient ratios, yield calculation, or recipe multiplier was found in legacy Production paths. Operators enter package counts manually. Planning is replenishment-to-max, not recipe-driven material planning.

`inventory-app` stores package weights 1.5, 1, 0.8 and 0.25 kg and calculates signed kg as `count * format.peso_kg`. Formats are matched by their name, and missing lookup defaults to 1 kg; the movement modal can compose names that do not match those masters. Changing a master weight retroactively changes all projected historical weights. This fallback must be removed, not preserved. Catalog owns conversion definitions; Production snapshots the verified conversion used for each new execution. Inventory owns stock-unit normalization and balances. Escandallos owns recipe yield, ingredient proportions, costing and approved versions.

For the later React planning behavior, `b = min + 0.25 * (max - min)`:

- `actual < min`: CRITICO; `min <= actual < b`: NECESARIO.
- `b <= actual <= max`: OPTIMO; `actual > max`: EXCESO.
- Suggest `max - actual` kg only for critical/necessary. Excess is advisory, never an automatic negative production batch.

At `(min,max)=(30,100)`, b=47.5: stocks 29, 30, 47.5, 100, 101 yield CRITICO, NECESARIO, OPTIMO, OPTIMO, EXCESO. Those are analytically traced boundary cases, not executed application tests.

v11 differs: critical uses `actual <= min`, ratio colors have no explicit excess state, and `max-actual` is suggested whenever actual is below max. Product limits are integers and stock is package units. Earlier v6 also plans in units. Preserve later kg operator intent while explicitly approving boundary behavior; do not silently mix these algorithms.

The monthly chart in later React sums raw `cantidad`, includes receipts in any warehouse, limits to five product names, and labels kg. Its dashboard recent-production cards do convert weights and restrict Vallecas. In v11 the chart filters Vallecas but the production report and latest-production dashboard accept all receipts. A Palencia transfer receipt may therefore inflate production metrics depending on view.

## 8. Current operational value to retain

Keep the recognizable daily actions and short form: select product/package, enter count, review destination and date, save. Preserve the prominent registration action, visible signed quantities, my recent entries, date filters, production history separated from circulation, urgency labels, min/max configuration, and the clear replenish-to-max suggestion. Package count entry with kg display avoids repeated kitchen arithmetic. Preserve the v11 adjustment-summary confirmation pattern in Inventory, rather than its mutable implementation.

The ODT provides especially useful acceptance intent: weights across mixed packages (6 × 1 kg plus 1 × 1.2 kg = 7.2 kg), editable effective date for late recording, burger navigation instead of sideways menu scrolling, cards instead of wide mobile tables, all catalog products on charts including zero stock, consistent product colors, and production reports excluding transfers. Some of these are partially implemented or only requirements. They are not evidence of a canonical recipe or traceability system.

Defaults must adapt: automatic selected operational unit/date are useful; Palencia as a hardcoded default for registering production is not. Dynamic catalog products replace fixed food names. Preserve operational brevity without allowing inline unprivileged creation of Catalog masters.

## 9. Legacy weaknesses and severity

These are source findings; the audit did not exploit a live service.

| ID | Severity | Finding / evidence | Consequence / required response |
| --- | --- | --- | --- |
| L01 | CRITICAL | `inventory-app` email-substring login ignores entered password (E11) | Demo role selection cannot become HORECA authentication |
| L02 | CRITICAL | v11 stock/movement/catalog/user management PHP lacks session/capability checks; movement insert trusts supplied actor | Unauthorized writes/attribution forgery if deployed as supplied; replace with trusted scoped operations |
| L03 | CRITICAL | No organization/unit authorization in legacy entities; hardcoded warehouse names | No SaaS isolation; canonical org/unit keys and server authorization required |
| L04 | CRITICAL | Separate mutable `inventario` balance vs movement-derived balance (E03/E04) | Stock divergence and incorrect repeated adjustments; one Inventory truth |
| L05 | HIGH | v11 PDO endpoints include MySQLi-only `db.php`; some endpoints are empty | Supplied backend snapshot internally incompatible; inspect deployed revision before reuse, do not port connection code |
| L06 | HIGH | Registration response mismatch, missing presentation on adjustments, personal-history actor ID missing from GET | Saved rows may not appear; joins/filtering can conceal facts |
| L07 | HIGH | Hardcoded DB connection configuration; errors displayed/raw server messages; unrestricted CORS headers | Credential/configuration exposure risk; no values copied, production secrets managed separately |
| L08 | HIGH | Mutable edit/delete, no original fact/reason/version/idempotency key or server posting guard | Lost audit trail, duplicate submission, conflicting edits; immutable confirm/correct commands |
| L09 | HIGH | Unknown format silently means 1 kg; string joins and format/master edits recalculate history | Incorrect quantities and reports; validated stable IDs and conversion snapshots |
| L10 | HIGH | Production inferred from receipt/location; inconsistent table/chart filters | Transfers and receipts inflate production; explicit source event type |
| L11 | HIGH | Browser-only persistence, simulated actors, random sample history in React/HORECA Inventory | Not shared operational truth; never seed/copy into real tenants |
| L12 | MEDIUM | Planning duplicated and ephemeral, fixed five foods, v11 integer truncation/no min≤max check | Settings disappear, new products omitted, unsafe thresholds |
| L13 | MEDIUM | Date-only end filters compared with timestamps; UTC formatting used as local date | Same-day exclusion/timezone drift; use effective business date and half-open timestamp ranges |
| L14 | MEDIUM | Wide tables/small icon controls remain in v11; uploads lack explicit resource quota and v11 trusts file extension | Mobile friction and unsafe support workflow; Core-owned upload policy and touch-first cards |
| L15 | LOW | Role naming (`cocinero`/`cocina`), duplicate modal/icon files and versioned asset naming | Maintenance ambiguity; normalize concepts, not historical user rows |

`inventory-app/api/api.php` exposes getData across all tables including users, accepts arbitrary identifier-sanitized generic table names rather than a domain whitelist, and lacks an auth gate. It is not wired by current frontend, but must not be reactivated during a Production port. Its planning integer bindings also conflict with fractional kg intent. These findings do not require touching legacy code in this audit.

## 10. HORECA branch reality and DEV comparison

`module/production` is **PARTIAL**, not empty and not canonical implementation. Its tracked Production file is byte-identical to DEV's Production file. It provides `Registro`, `Historial`, `Resumen`, a date filter, quantity/unit, merma, shift, employee selection and notes. It directly reads `produccion_registros` and active `empleados`, inserts a free-text product row, loads at most 500 rows, groups history by date, and aggregates summary by product name. Category is collected in form state but not inserted. Merma totals can mix units; summary merges quantities with the same product name even if units differ. A loaded-row count is presented as lots without a real batch identifier. Validation only checks presence of name/quantity; source lacks tenant/unit context, canonical product/recipe reference, finite-positive enforcement, immutable confirmation, corrections and an Inventory contract.

DEV adds Core navigation, explicit active tenant/unit, capability resolution, trusted server gate and module entitlements. Its legacy fail-closed migration revokes browser privileges on both `produccion_registros` and `empleados` (and legacy recipes). The unchanged Production component is therefore incompatible with the intended current DB access model. Fixing this by reopening old tables would violate isolation. Source proves the intended denial; no hosted Production query was run to claim an observed database result.

HORECA Inventory is also partial: it embeds the React legacy localStorage store and Production/Planning views inside Inventory navigation. It is not yet a canonical StockLedger provider. Escandallos on DEV is a Guacamole recipe-constructor mock with static values and non-persisting actions, not a published recipe/version API. The separate feature branch contains historical proposals but is not an approved dependency. Old documents referencing MICA or assuming unrestricted recipe policies are superseded by current Core rules and must not guide implementation.

Untracked work in the Production checkout consists of `src/modules/produccion/domain/`, `src/modules/produccion/index.ts`, `supabase/migrations_proposed_production/`, and `tests/unit/production.test.ts`. It is **local draft evidence only**, absent from the audited GitHub branch. It proposes batch/input/output/waste types and planning helpers. It is not connected to the tracked screen or server persistence. The SQL draft references unprefixed `organizations`, `operational_units`, `products`, recipes and locations not provided by current Core, enables RLS only on batch/threshold headers (not children), and relies on an application GUC instead of the canonical membership/capability gate. Event helpers create random IDs per call rather than durable retry-stable identities. Planning clamps negative stock to zero, changing source behavior; unit rounding floors target kg and can underproduce; both need explicit decisions. These drafts must not be applied as-is or reported as implemented.

### DEV resync assessment — no merge performed

- `git rev-list --left-right --count module/production...origin/dev`: **0 ahead / 59 behind**, counting commits including merges.
- Merge base equals Production HEAD `b710bb9c89d2f2e9ca6573a88a2cbac23dae3b36`: tracked branch is an ancestor, so clean tracked content can fast-forward without text merge conflicts at these exact refs.
- Snapshot diff: 256 files, 54,512 insertions and 2,235 deletions. Most growth is outside Production, including Sales fixtures; do not equate line count with Production complexity.
- Production, Inventory and Escandallos module paths have no tracked differences between these refs. Core shell/auth/config and migration chain do change.
- Seven historical migration files move into `supabase/history/pre_rebaseline`; fourteen new active migration files are added. Do not replay the old branch migration directory against shared DEV.
- Local draft paths are not tracked in DEV, so no direct incoming path collision was found; nonetheless preserve them separately before any future resync. No stash, reset, clean, merge, or migration was executed.
- Semantic integration risks exceed text conflicts: legacy denial, unit-scoped gates requiring selected unit, current module registry, identity guard enforcing the shared HORECA project, and historical schema assumptions in drafts.

One formal Core Change Request is proposed: `CCR-PROD-001`, the reviewed Production capability registry/navigation changes detailed in [target design](PRODUCTION-TARGET-DESIGN.md). Canonical Inventory, Catalog and Escandallos contracts need owner agreement; they are cross-domain dependencies, not permission to create competing masters. Master owns migration ordering/review.

## 11. Migration decision and completion boundary

Historical Production data migration: **NOT_REQUIRED**. Do not prepare extract/transform/load scripts, copy legacy movements, synthetic history, identities, stock balances, or preexisting production rows. Optional configuration-only adoption: owner-reviewed planning thresholds and display preferences. Products, packaging conversions and locations must first be resolved by Catalog/Inventory/Core owners; Production references their canonical IDs instead of importing duplicates.

The audit is ready for implementation planning. Exact live legacy variant confirmation and integration-owner contract decisions remain planning inputs, not blockers to this completed source audit. Hosted UAT additionally needs working HORECA auth/infrastructure; the prior auth incident is not re-tested or changed by this task. The [target design](PRODUCTION-TARGET-DESIGN.md) and [gap/WP matrix](PRODUCTION-GAP-MATRIX.md) define implementation gates, four work packages and acceptance checks. No runtime PASS, schema availability, or deployment readiness is claimed.
