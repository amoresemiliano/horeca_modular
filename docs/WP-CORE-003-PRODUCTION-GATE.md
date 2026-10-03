# Separate production promotion gate

WP-CORE-003 does not authorize production deployment. Master must approve a concrete production plan after DEV authorization UAT and Product Owner review.

- Verify the production Supabase project ID and organization against the deployment account. Do not reuse the DEV project or any MICA project.
- Verify the production Vercel project, main branch and production environment; validate browser URL/key project identity without printing secrets. Keep service-role keys exclusively in trusted server environments.
- Review the complete migration chain and current schema history. Back up identity/access state and operational data; rehearse on an isolated copy. Apply Core migrations before the matching UI.
- Configure Supabase Auth providers, SMTP delivery, Site URL and exact approved `/reset-password` redirect origins. Test invitation acceptance, expired links, repeat invitations, setup and logout. Configure `ADMIN_APP_ORIGIN` for the invitation function and deploy with JWT verification.
- Include `20261003000000_core_saas_ux.sql` and the Vercel `/reset-password` rewrite. Verify direct navigation and refresh return the application, then follow an actual Supabase invitation from a fresh browser through password setup. Confirm intended end-user access to the deployment independently of Supabase authentication; DEV preview protection must not be mistaken for tenant authorization. See `CORE-SAAS-UX-CLOSURE.md` for the DEV evidence.
- Bootstrap the first active platform administrator through trusted Master operations, audited. Do not derive platform authority from tenant membership or user-editable Auth metadata.
- Identify the canonical El Criollo organization before creating anything; preserve IDs and operational data. Set only verified display/trade name, ES, EUR and Europe/Madrid. Confirm legal facts separately.
- Explicitly approve commercial module entitlements. Closed legacy tables without tenant ownership remain inaccessible until the corresponding module passes its isolation gate.
- Assign the first organization-wide OWNER separately from the platform role. Verify it can administer users, overrides and scope without modifying MANAGER defaults.
- Run smoke tests for platform-only, OWNER, Banks Full, Banks Import+Consolidated, revoked capabilities, inactive membership/tenant, disabled entitlement and assigned/foreign operational units.
- Prove tenant A cannot read tenant B users, memberships, Finance facts or mutate permissions. Prove a platform administrator without membership receives zero business rows and denied business RPCs. Verify legacy surfaces reject browser access.
- Verify audit completeness and that logs, browser bundles and responses contain no secrets. Compare protected business-data hashes before and after deployment.
- Rollback: first disable the new UI/function entry points if needed. Restore application code only after confirming schema compatibility. Preserve audit and operational data. Do not roll back security by restoring permissive legacy policies. Correct authorization defects with reviewed forward migrations; use a backup only under a separate explicit recovery plan.
- Require Product Owner sign-off on the deployed production smoke/isolation evidence before marking PROD_VALIDATED.
