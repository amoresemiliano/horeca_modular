# DATA OWNERSHIP & TENANT ISOLATION MODEL

## 1. Multi-Tenant Ownership Rule
Every business record in HORECA Modular MUST explicitly belong to an organization identified by `organization_id UUID NOT NULL`.

- **No Hardcoded Defaults**: Tables MUST NOT specify hardcoded tenant UUID defaults.
- **Explicit Ownership Validation**: On insert or query, `organization_id` must be validated against the user's authorized active memberships in `eco_organization_members`.

---

## 2. Row-Level Security Policy Standard (AS-IS vs TARGET TO-BE)

### AS-IS Single-Org Bootstrap Standard
During initial bootstrap, operational tables evaluate `get_auth_user_org_id()` (which defaults to `LIMIT 1` active organization):
```sql
-- AS-IS Bootstrap Policy
CREATE POLICY "Strict RLS table_name" ON public.table_name
    FOR ALL TO authenticated
    USING (organization_id = get_auth_user_org_id())
    WITH CHECK (organization_id = get_auth_user_org_id());
```

### APPROVED TARGET TO-BE Multi-CIF Standard
In the Target Multi-CIF Security Architecture, RLS policies validate that `organization_id` belongs to the set of active organizations assigned to the user:
```sql
-- TARGET Multi-CIF Policy
CREATE POLICY "Strict Multi-Tenant RLS table_name" ON public.table_name
    FOR ALL TO authenticated
    USING (
        organization_id IN (
            SELECT m.organization_id
            FROM public.eco_organization_members m
            JOIN public.eco_user_profiles p ON p.id = m.user_profile_id
            WHERE p.auth_user_id = auth.uid()
              AND p.is_active = TRUE
              AND m.is_active = TRUE
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT m.organization_id
            FROM public.eco_organization_members m
            JOIN public.eco_user_profiles p ON p.id = m.user_profile_id
            WHERE p.auth_user_id = auth.uid()
              AND p.is_active = TRUE
              AND m.is_active = TRUE
        )
    );
```

---

## 3. Storage Bucket Isolation
Import files (bank CSVs, invoices) uploaded to Supabase Storage are isolated in private bucket `eco-imports-private-staging`:
- Bucket privacy: `public = false`.
- Folder path pattern: `{organization_id}/{file_id}/{filename}`.
- Storage RLS: Validates `(storage.foldername(name))[1]` against active organization membership in `eco_organization_members`.

---

## 4. Cross-Tenant Isolation
Cross-tenant data leakage is strictly prohibited. A user profile cannot query, mutate, or access records outside their assigned organization memberships.
