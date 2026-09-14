# AUTHORIZATION RUNTIME MODEL — HORECA MODULAR

## 1. Core Authorization Principles
1. **Atomic Capabilities are the Sole Authority**: Roles (`eco_role_templates`) are non-authoritative bundles of capabilities.
2. **Fail-Closed Default Deny**: If a user has no active membership, no matching capability, or if a module entitlement is disabled, authorization evaluates to `DENY` (`false`).
3. **Platform Admin Segregation**: `VEGEN_PLATFORM_ADMIN` manages platform infrastructure and global catalogs. It does NOT automatically grant access to tenant business data without explicit OrganizationMembership.
4. **Holding Roles Segregation**: `HOLDING_OWNER` and `HOLDING_ADMIN` provide cross-tenant oversight but do not bypass CIF-specific operational permissions.
5. **Human Gate Separation**: High-risk actions require distinct, non-implied capabilities (e.g. creating/reviewing vs confirming/approving).
6. **Multi-Unit Scopes**: Memberships are either organization-wide (`is_organization_wide = true`) or restricted to explicit units (`is_organization_wide = false` + `eco_membership_operational_unit_scopes`).

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
| `EXTERNAL_ACCOUNTANT` | `ORGANIZATION` | External gestoría, statement verification, tax exports | **YES (Read/Review Biased)** |
| `CONSULTANT` | `ORGANIZATION` | Read-only analytics, audit logs, and performance reports | **Read-Only** |

---

## 3. Legacy Role Mapping & Security Rules

| Legacy Role String | Canonical Role Template | Justification & Modeling | Transitional Field State |
| :--- | :--- | :--- | :--- |
| `SUPERADMIN` | `OWNER` (Tenant only) | Tenant membership mapped to OWNER. Platform admin is a SEPARATE assignment based on independent evidence. | Retained in `eco_organization_members.role` |
| `ADMIN` | `ADMINISTRATIVE` | Financial and statement management role. | Retained in `eco_organization_members.role` |
| `GERENTE` | `MANAGER` | General manager overseeing operations and staff. | Retained in `eco_organization_members.role` |
| `OPERADOR` | `PRODUCTION` | Kitchen and production staff. | Retained in `eco_organization_members.role` |
| `CONSULTA` | `CONSULTANT` | Read-only audit and analytics access. | Retained in `eco_organization_members.role` |
| *UNKNOWN / UNMAPPED* | `NULL` | **FAIL-CLOSED**: Unknown legacy roles are NOT mapped to OWNER. They receive 0 capabilities and are reported for audit. | Retained in `eco_organization_members.role` |

> [!IMPORTANT]
> **SUPERADMIN != VEGEN_PLATFORM_ADMIN**: A legacy `SUPERADMIN` string on an organization membership grants tenant `OWNER` authority only. `VEGEN_PLATFORM_ADMIN` is a distinct platform-tier authority that is never automatically granted simply from legacy organization role strings.

---

## 4. Mandatory Human Gate Capability Distinctions

The canonical model strictly separates entry/review capabilities from commitment/approval capabilities:

| Gate Area | Entry / Review Capability | Commitment / Approval Capability | Rationale |
| :--- | :--- | :--- | :--- |
| **Financial Reconciliation** | `REVIEW_RECONCILIATION` (`FINANCIAL_RECONCILIATION_REVIEW`) | `CONFIRM_RECONCILIATION` (`FINANCIAL_RECONCILIATION_CONFIRM`) | Reviewing reconciliation proposals is exploratory; confirming commits ledger allocations. |
| **Procurement Orders** | `CREATE_PURCHASE_ORDER` (`PURCHASES_ORDER_CREATE`) | `APPROVE_PURCHASE_ORDER` (`PURCHASES_ORDER_APPROVE`) | Drafting orders is separated from financial commitment to suppliers. |
| **Inventory Adjustments** | `RUN_STOCK_COUNT` (`INVENTORY_COUNT_RUN`) | `CONFIRM_STOCK_ADJUSTMENT` (`INVENTORY_ADJUSTMENT_CONFIRM`) | Floor count logging is separated from ledger adjustments and shrinkage write-offs. |

---

## 5. Permission Resolution Pipeline

```mermaid
graph TD
    A[Start: can(userId, orgId, capabilityCode, opUnitId)] --> B{Active Membership in orgId?}
    B -- No --> DENY[DENY (false)]
    B -- Yes --> C{Module Entitlement Enabled?}
    C -- No --> DENY
    C -- Yes --> D{OpUnit Specified & Restricted?}
    D -- Out of Scope --> DENY
    D -- In Scope / Org-Wide --> E{Explicit Override for OpUnit?}
    E -- GRANT --> ALLOW[ALLOW (true)]
    E -- REVOKE --> DENY
    E -- No Override --> F{Explicit Override for Org?}
    F -- GRANT --> ALLOW
    F -- REVOKE --> DENY
    F -- No Override --> G{Capability in RoleTemplate?}
    G -- Yes --> ALLOW
    G -- No --> DENY
```
