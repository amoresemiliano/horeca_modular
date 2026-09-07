# SECURITY MODEL & FAIL-CLOSED PROTOCOL

## 1. Authentication Architecture
- **Primary Auth Engine**: Native Supabase Auth (`auth.users`) configured with PKCE flow.
- **Provider Support**:
  - DEV environment (`VITE_DEV_PASSWORD_AUTH=true`): Email/Password authentication.
  - Staging/Production: Google & GitHub OAuth via Supabase Auth (`signInWithOAuth`).
- **Credential Hygiene**: Zero plain-text passwords or secret keys in repository, Git commits, logs, or documentation. All developer credentials stored in gitignored `.local-data/`.

## 2. Fail-Closed Authorization Protocol
Authorization strictly follows a 3-step validation pipeline:
1. `auth.uid()` resolves valid Supabase session user.
2. `eco_user_profiles` resolves active global profile (`auth_user_id = auth.uid()`, `is_active = true`).
3. `eco_organization_members` resolves active tenant membership (`user_profile_id = profile.id`, `is_active = true`), returning `role` and `organization_id`.

If ANY step fails, `AuthContext.jsx` clears all user state (`profile = null`, `role = null`, `organizationId = null`), and UI blocks module access completely.

## 3. Database Security Definers & Triggers
- `get_auth_user_org_id()`: Executed as `SECURITY DEFINER STABLE`. Resolves `organization_id` strictly via `auth.uid()`.
- `handle_new_user()`: Executed as `SECURITY DEFINER` on `AFTER INSERT ON auth.users`. Provisions `eco_user_profiles` and checks `eco_auth_bootstrap_allowlist` to assign initial role/organization.

## 4. Public & Anon Access Prohibition
- Anonymous access (`anon` role) is strictly prohibited on all operational tables.
- All RLS policies target `TO authenticated`.
- No broad `FOR ALL` policies with `auth.uid() IS NULL` fallbacks are permitted.
