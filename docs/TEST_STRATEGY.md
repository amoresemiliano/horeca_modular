# TEST STRATEGY & VERIFICATION PROTOCOL

## 1. Overview
The verification protocol for HORECA Modular ensures all technical and business contracts are verified autonomously using automated test scripts, build checks, and browser simulation before human QA.

## 2. Testing Layers

### A. Automated Node Verification Scripts (`scratch/*.js`)
- **Auth Flow Verification**: `scratch/verify_new_temp_password.js` tests `signInWithPassword`, session creation, profile resolution, membership resolution, and role derivation against live Supabase APIs.
- **Bank Statement Parser Tests**: Unit tests validating BBVA and Sabadell CSV/XLS statement parsers, row normalization, and duplicate row detection.

### B. Build & Compilation Verification
- Command: `npm run build`
- Criteria: Must complete with 0 errors. Validates JSX syntax, ESM imports, TypeScript types (where applicable), and CSS asset bundling.

### C. Fail-Closed Security Boundary Tests
- Verifies that unauthenticated API requests or missing profile/membership records result in HTTP 401/403 or empty array responses via Database RLS policies (`get_auth_user_org_id()`).

### D. Automated E2E Browser Testing (`browser_subagent`)
- Simulates real browser user interactions on Vercel Preview deployments:
  - Form input editability & submission.
  - Dashboard navigation & module tab rendering.
  - Password change modal workflow.
  - Reload session persistence (`autoRefreshToken` & `persistSession`).
  - Logout flow.

## 3. Pre-Flight Release Gate Criteria
Before any PR merge from `dev` to `main`:
1. `npm run build` succeeds without warnings/errors.
2. All Node automated test scripts in `scratch/` pass with code 0.
3. RLS boundary check passes (0 public/anon data access).
4. No plain-text passwords or secret keys present in Git diff.
