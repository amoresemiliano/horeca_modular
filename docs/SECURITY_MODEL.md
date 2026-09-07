# SECURITY MODEL & MULTI-TENANT AUTHORIZATION

## 1. Authentication Architecture
- **Primary Auth Engine**: Native Supabase Auth (`auth.users`) configured with PKCE flow.
- **Provider Support**:
  - DEV environment (`VITE_DEV_PASSWORD_AUTH=true`): Temporary email/password login path.
  - Staging/Production: Google & GitHub OAuth via Supabase Auth (`signInWithOAuth`).
- **Credential Hygiene**: Zero plain-text passwords or secret keys in repository, Git commits, logs, or documentation. All developer credentials stored in gitignored `.local-data/`.

---

## 2. Authorization Primitive: AS-IS vs TARGET TO-BE Model

### A. AS-IS Single-Organization Bootstrap Helper (`get_auth_user_org_id()`)
In the current implementation, `get_auth_user_org_id()` is a helper function defined as:

```sql
CREATE OR REPLACE FUNCTION public.get_auth_user_org_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_org_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT m.organization_id INTO v_org_id
    FROM public.eco_user_profiles p
    JOIN public.eco_organization_members m ON m.user_profile_id = p.id
    WHERE p.auth_user_id = auth.uid()
      AND p.is_active = TRUE
      AND m.is_active = TRUE
    ORDER BY m.created_at ASC
    LIMIT 1;

    RETURN v_org_id;
END;
$$;
```

**Limitation**: `get_auth_user_org_id()` executes `LIMIT 1`, returning only the first active organization created for a user profile. It is suitable ONLY for single-tenant bootstrap operations and must NOT be treated as the final multi-tenant security architecture.

### B. APPROVED TARGET TO-BE Multi-CIF Security Model
The target architecture requires support for **multi-CIF / multi-organization memberships**, where a user profile can belong to multiple organizations or corporate tax entities (CIFs) simultaneously.

In the Target Security Model:
1. **Active Organization Context**: The user selects an active organization context stored in `eco_user_active_context` or passed as a validated request claim.
2. **Multi-Tenant RLS Policy Standard**: Database RLS policies validate that the requested `organization_id` exists within the user's active memberships in `eco_organization_members`:

```sql
-- Target Multi-CIF RLS Policy Pattern
CREATE POLICY "Strict Multi-Tenant RLS" ON public.table_name
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

## 3. Fail-Closed Authorization Protocol
Authorization strictly follows a 3-step validation pipeline:
1. `auth.uid()` resolves valid Supabase session user.
2. `eco_user_profiles` resolves active global profile (`auth_user_id = auth.uid()`, `is_active = true`).
3. `eco_organization_members` resolves active memberships (`user_profile_id = profile.id`, `is_active = true`), returning authorized roles (`SUPERADMIN`, `ADMIN`, `GERENTE`, `OPERADOR`, `CONSULTA`) per tenant.

If ANY step fails or if an unauthorized `organization_id` is requested, access is strictly DENIED.

---

## 4. Public & Anon Access Prohibition
- Anonymous access (`anon` role) is strictly prohibited across all business tables.
- All RLS policies target `TO authenticated`.
- No broad `FOR ALL` policies with `USING (true)` or `auth.uid() IS NULL` fallbacks are permitted in production or dev migrations.
