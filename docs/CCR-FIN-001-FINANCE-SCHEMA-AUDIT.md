# CCR-FIN-001 — Finance ownership and schema evidence

Audit baseline: dev `b710bb9c89d2f2e9ca6573a88a2cbac23dae3b36`; Finance draft read through
Git at `84fec72de0f91249348e49e503099779fa114d7e`. All reachable SQL migration history was
inspected; the ten business tables below have **no versioned base CREATE TABLE definitions**.
The reconstruction plan already records this drift. This audit does not certify a live schema.

Evidence: `docs/DOMAIN_MODEL.md`, `docs/CANONICAL_DB_RECONSTRUCTION_PLAN.md`,
`src/lib/extractosService.js`, `20260903000000_supabase_auth_rls.sql`, and the Finance draft
`20260919000000_wp_fin_001_canonical_bank_movements.sql`. Runtime field usage proves an
application dependency, not a PostgreSQL NOT NULL, FK, uniqueness or grant declaration.

## Ownership decision

| Table | Classification | Authorized schema owner / preservation obligation |
| --- | --- | --- |
| eco_financial_accounts | FINANCE-OWNED | BankAccount identity/product/institution and Finance migrations. |
| eco_source_imports | FINANCE-OWNED | Import lifecycle/counters/provenance; coordinate consumers of any legacy non-bank rows. |
| eco_source_files | FINANCE-OWNED | Source metadata/hash and file/import relationships. |
| eco_import_rows | FINANCE-OWNED | Row provenance/parsing lifecycle; preserve existing source relationships. |
| eco_financial_movements | FINANCE-OWNED | Canonical bank facts, idempotency evidence and tenant-scoped read/write boundaries. |
| eco_movement_allocations | FINANCE-OWNED | Editable classification/splits; preserve historical allocations and Extractos joins. |
| eco_tax_categories | LEGACY AWAITING ADOPTION | Finance steward of the shared financial reference catalog; confirm global vs tenant semantics before adoption. Not Core auth schema. |
| eco_tax_subcategories | FINANCE-OWNED | Tenant-scoped subcategory catalog; preserve category links and current classification behavior. |
| eco_counterparties | FINANCE-OWNED | Financial counterparty reference, not ownership of PurchaseOrder/Supplier/Sale domains. |
| eco_classification_rules | FINANCE-OWNED | Deterministic Finance classification rules/targets and tenant scoping. |

None of these tables is deprecated by this CCR. None is transferred into Core. Core owns
identity, tenancy, authorization and the reusable authorization primitive only. Cross-domain
consumers of financial catalogs do not by themselves transfer business-table ownership to Core.

## Per-table schema evidence

For **every row below**, `id` is consumed by the application as identity; the exact primary-key
type/default/constraint is unversioned. Existing NOT NULL constraints and grants are likewise
**unverified for every table**. Referenced IDs below are application relationships unless
explicitly marked as a draft DDL constraint. Do not equate these lists with complete DDL.

| Table | organization_id evidence | Consumed columns / required application inputs | Relationships, uniqueness and status evidence |
| --- | --- | --- | --- |
| eco_financial_accounts | Queries and 20260903 policy require it; nullability/FK unversioned | id, code, name, bank_name, account_type; Finance draft adds institution, product_type, masked_identifier, external_reference, currency, updated_at | Referenced as source_account_id; source code lookup uses maybeSingle but no org/code uniqueness DDL is present. Draft product_type CHECK BANK_ACCOUNT/CARD; no proven legacy status CHECK. |
| eco_source_imports | Written on import; membership policy | id, organization_id, source_type, operation_type, status, total_rows, accepted_rows, duplicate_rows, completed_at | PROCESSING/COMPLETED used in code, enum/CHECK unversioned. Draft adds nullable bank_account_id UUID FK to financial_accounts(id), ON DELETE SET NULL; that action needs Finance review. Draft parser_name/parser_version and non-null accepted/duplicate counters. |
| eco_source_files | Written and queried; membership policy | id, import_id, organization_id, original_name, storage_path, size_bytes, sha256_hash, source_type, created_at | import_id relationship consumed; exact FK unversioned. Draft has unique (organization_id, sha256_hash) WHERE hash IS NOT NULL. No versioned status field contract. |
| eco_import_rows | Written and membership policy | id, file_id, organization_id, source_row_number, raw_payload, parse_status | file_id -> source_files consumed. ACCEPTED used; allowed values/uniqueness unversioned. |
| eco_financial_movements | Written, queried and membership policy | id, import_id, row_id, source_account_id, source_type, operation_type, status, identity_key, financial_fingerprint, fecha, fecha_valor, descripcion, monto, row_hash, normalized_payload | import/row/account relationships consumed; actual FKs and identity_key/row_hash uniqueness unknown. ACTIVE/SOFT_DELETED, INGRESO/GASTO used by legacy code, CHECKs unversioned. Draft duplicate_status CHECK and NON-UNIQUE fingerprint index; new bank_native_id/source_row_number/raw_payload. |
| eco_movement_allocations | Written and membership policy | id, movement_id, monto, counterparty_id, category_id, subcategory_id, classification_status/source, reconciliation_status, notes, updated_at; optional reconciled_movement_id/type and flags | Client explicitly names eco_movement_allocations_movement_id_fkey; constraint definition/actions unversioned. Counterparty/category/subcategory joins consumed. PENDING/SUGGESTED/CONFIRMED, RULE/MANUAL, UNMATCHED/CONFIRMED used; uniqueness and CHECKs unknown. |
| eco_tax_categories | Client reads globally, without organization predicate; no table-specific policy in tracked migration | id, name and classification references | Taxonomy seed, parent links, status fields, tenant semantics and constraints unversioned. Historical snapshot counts are not a schema or an approved HORECA seed. |
| eco_tax_subcategories | Client filters organization_id; membership policy | id, name, organization_id and category association consumed by classification | Category relation consumed; exact FK/uniqueness/status/NOT NULL unknown. |
| eco_counterparties | Queries/writes and membership policy | id, organization_id, name, entity_type (PROVEEDOR legacy input) | Allocation/rule target references; actual FK/CHECK/uniqueness/status unversioned. Do not promote this registry to a cross-domain supplier model. |
| eco_classification_rules | Queries/writes and membership policy | id, name, pattern, source_account_id, match_sign, target_counterparty_id, target_category_id, target_subcategory_id, is_active | Target/account relationships consumed; actual FKs unknown. ALL/POSITIVE/NEGATIVE used for match_sign, CHECK unknown; no proven uniqueness. |

The draft's newly added NOT NULL defaults are product_type BANK_ACCOUNT, currency EUR,
updated_at, accepted_rows/duplicate_rows 0, duplicate_status UNIQUE and raw/normalized_payload
empty JSON. `parser_version` has a default but no NOT NULL. All other nullability remains
unknown. Defaults must not silently classify historical card accounts as bank accounts.

## RLS and grants

The 20260903 migration declares `Strict RLS <table>` for all listed tables except
`eco_tax_categories`: `FOR ALL TO authenticated`, USING/WITH CHECK
`organization_id = get_auth_user_org_id()`. The Finance draft explicitly enables RLS on its
four target tables and recreates the same policy shape. For other tables the live RLS-enabled
flags, additional policies, column privileges and grants are not proven by these declarations.
No canonical Finance table/column GRANT baseline is versioned. Inspect it; never assume either
that the browser cannot write or that a new restrictive policy is the only policy present.

`supabase/audits/ccr_fin_001_finance_schema.sql` supplies read-only catalog queries for all ten
tables: existence, owners, RLS flags, columns/defaults/nullability, PK/FK/unique/CHECK constraints,
indexes, policies, table/column grants and non-internal triggers. It reads no business data.
Run it in the intended HORECA environment, record a redacted schema-only baseline under Finance
ownership, compare against application dependencies, and design adoption/migrations from that
evidence. A missing table is an explicit adoption decision, not a guessed ALTER target.

## Finance draft migration review — not applied or edited by Core

| Draft location / assumption | Required Finance correction |
| --- | --- |
| Four policies use get_auth_user_org_id() | Use explicit requested-org checks through Core for writes; membership-scoped reads must not pick the first organization. |
| FOR ALL authenticated policies | Replace canonical creation with a trusted atomic write boundary; audit all other policies/privileges. Preserve separate classification editing. |
| ALTER against missing base DDL | Capture/validate the schema baseline before introducing additive changes; own the baseline under Finance. |
| WHEN OTHERS THEN NULL in product/duplicate CHECK blocks | Remove exception swallowing; fail the migration with actionable constraint/data validation evidence. |
| product_type defaults BANK_ACCOUNT | Backfill from verified source semantics; do not turn cards into accounts. Missing institution/identity must remain unresolved. |
| bank_account_id nullable FK, ON DELETE SET NULL | Preserve required account relationships for canonical imports; explicitly handle legacy rows and deletion behavior. |
| Existing identity_key/row_hash constraints unknown | Audit before inserting fingerprint values. Fingerprint evidence must not become universal transaction uniqueness. |
| File hash partial unique index | Validate historical duplicates, required canonical hash provenance, transaction rollback and race response. Index alone is not an atomic import. |
| No complete canonical persistence/mapping contract | Preserve SQL NULL value dates, exact amounts, currency, provenance and final-account fingerprints through reload. |
| Allocations/categories absent from the draft | Their omission is not removal approval. Preserve the initial classification/allocation path, edits, splits and deterministic rules. |

Finance may own additive account/import/movement fields, exact-file constraints, supporting
indexes, canonical tenant-consistent FKs, Finance-specific RLS/grants and its atomic operation.
It may version/adopt missing Finance base schema and migrate classifications explicitly with
data-preservation evidence. It may not mutate Core capability grants/membership contracts,
remove allocations incidentally, seed unrelated/MICA data, or apply migrations to shared DEV
outside Master-controlled deployment. This resolves ownership; it does not certify unknown DDL.
