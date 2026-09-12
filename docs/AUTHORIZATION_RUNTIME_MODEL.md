# AUTHORIZATION RUNTIME MODEL — HORECA MODULAR

## 1. Core Authorization Principles
1. **Atomic Capabilities are the Sole Authority**: Roles (`eco_role_templates`) are non-authoritative bundles of capabilities.
2. **Fail-Closed Default Deny**: If a user has no active membership, no matching capability, or if a module entitlement is disabled, authorization evaluates to `DENY` (`false`).
3. **Platform Admin Segregation**: `VEGEN_PLATFORM_ADMIN` manages platform infrastructure and global catalogs. It does NOT automatically grant access to tenant business data without explicit OrganizationMembership.
4. **Holding Roles Segregation**: `HOLDING_OWNER` and `HOLDING_ADMIN` provide cross-tenant oversight but do not bypass CIF-specific operational permissions.

---

## 2. The 13 Canonical Role Templates

| Role Template Code | Tier | Primary Scope | Operational Business Data Access? |
| :--- | :---: | :--- | :---: |
| `VEGEN_PLATFORM_ADMIN` | `PLATFORM` | System administration, global catalogs, tenancy provisioning | **NO (Separated)** |
| `HOLDING_OWNER` | `HOLDING` | Executive ownership and consolidated reporting across holding | Multi-org oversight |
| `HOLDING_ADMIN` | `HOLDING` | Executive administration and audit across holding | Multi-org oversight |
| `OWNER` | `ORGANIZATION` | Full legal and operational authority within organization (CIF) | **YES** |
| `MANAGER` | `ORGANIZATION` | General management, daily operations, banking, approvals | **YES** |
| `ADMINISTRATIVE` | `ORGANIZATION` | Financial administration, statement imports, reconciliation | **YES** |
| `PURCHASING` | `ORGANIZATION` | Supplier management, purchasing orders, invoices | **YES** |
| `RECEPTION_FLOOR` | `ORGANIZATION` | Stock receiving, floor operations, incident reporting | **YES** |
| `PRODUCTION` | `ORGANIZATION` | Kitchen and central production batch tracking | **YES** |
| `COOK_COST_SHEET_MANAGER` | `ORGANIZATION` | Recipe creation, ingredient cost calculation, menu margins | **YES** |
| `HR_PERSONNEL` | `ORGANIZATION` | Clock-in management, employee records, payroll imports | **YES** |
| `EXTERNAL_ACCOUNTANT` | `ORGANIZATION` | External gestoría, statement verification, tax exports | **YES** |
| `CONSULTANT` | `ORGANIZATION` | Read-only analytics, audit logs, and performance reports | Read-Only |

---

## 3. Legacy Role Mapping

| Legacy Role String | Canonical Role Template | Justification & Modeling | Transitional Field State |
| :--- | :--- | :--- | :--- |
| `SUPERADMIN` | `OWNER` (Tenant) + `VEGEN_PLATFORM_ADMIN` (Platform) | Historically combined platform and tenant power. Separated in canonical model. | Retained in `eco_organization_members.role` |
| `ADMIN` | `ADMINISTRATIVE` | Financial and statement management role. | Retained in `eco_organization_members.role` |
| `GERENTE` | `MANAGER` | General manager overseeing operations and staff. | Retained in `eco_organization_members.role` |
| `OPERADOR` | `PRODUCTION` / `RECEPTION_FLOOR` | Daily operational floor and kitchen staff. | Retained in `eco_organization_members.role` |
| `CONSULTA` | `CONSULTANT` | Read-only audit and analytics access. | Retained in `eco_organization_members.role` |

---

## 4. Permission Resolution Pipeline

```mermaid
graph TD
    A[Start: can(userId, orgId, capabilityCode, opUnitId)] --> B{Active Membership in orgId?}
    B -- No --> DENY[DENY (false)]
    B -- Yes --> C{Module Entitlement Enabled?}
    C -- No --> DENY
    C -- Yes --> D{Explicit Override for OpUnit?}
    D -- GRANT --> ALLOW[ALLOW (true)]
    D -- REVOKE --> DENY
    D -- No Override --> E{Explicit Override for Org?}
    E -- GRANT --> ALLOW
    E -- REVOKE --> DENY
    E -- No Override --> F{Capability in RoleTemplate?}
    F -- Yes --> ALLOW
    F -- No --> DENY
```
