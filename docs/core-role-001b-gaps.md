# Gerente: capability coverage

Gerente uses an explicit list of active read capabilities and the four Personnel view/schedule capabilities. Entitlements and operational scope remain independent checks.

Compras has no separate read capability in the current registry or navigation contract, so this role is not granted purchasing writes to expose it. Prediction also has no dedicated prediction read capability; its current navigation references reporting access and must remain subject to the prediction entitlement. Further module integration should add and enforce domain-specific read gates before expanding this role.

Role templates are shared across organizations. Changing or deactivating an assigned custom role affects every active membership using it; the administration view displays the number of active memberships, and deactivation asks for confirmation. Tenant membership assignment still requires tenant authority and does not follow from platform authority alone.

Apply `20261127020000_core_custom_role_governance.sql` through the reviewed migration workflow after its two prerequisite migrations. No hosted environment was changed by this work.
