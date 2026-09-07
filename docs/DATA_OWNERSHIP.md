# DATA OWNERSHIP & TENANT ISOLATION MODEL

## 1. Multi-Tenant Ownership Rule
Every business record in HORECA Modular MUST explicitly belong to a single organization identified by `organization_id UUID NOT NULL`.

- **No Hardcoded Defaults**: Tables MUST NOT specify hardcoded tenant UUID defaults.
- **Contextual Derivation**: On insert or query, `organization_id` is derived strictly from the authenticated context via `get_auth_user_org_id()`.

## 2. Row-Level Security Policy Standard
All multi-tenant tables enforce strict RLS policies for authenticated users using `get_auth_user_org_id()`:

```sql
CREATE POLICY "Strict RLS table_name" ON public.table_name
    FOR ALL TO authenticated
    USING (organization_id = get_auth_user_org_id())
    WITH CHECK (organization_id = get_auth_user_org_id());
```

## 3. Storage Bucket Isolation
Import files (bank CSVs, invoices) uploaded to Supabase Storage are isolated in private bucket `eco-imports-private-staging`:
- Bucket privacy: `public = false`.
- Folder structure: `{organization_id}/{file_id}/{filename}`.
- Storage RLS: Evaluates `(storage.foldername(name))[1] = get_auth_user_org_id()::text`.

## 4. Cross-Tenant Boundaries
Cross-tenant data access is strictly forbidden. A user profile cannot query or mutate records outside the organization returned by `get_auth_user_org_id()`.
