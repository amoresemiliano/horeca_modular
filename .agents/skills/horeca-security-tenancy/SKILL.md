---
name: horeca-security-tenancy
description: HORECA security and multi-tenancy invariants, 13 canonical role templates, and human gate separations.
---

# horeca-security-tenancy

## Identity & Tenancy Invariants
- `User` != `Employee` | `Employment` != `Authorization` | `Access` != `ActiveContext`
- `Platform Admin` != `Tenant Data Access` (0 rows under Postgres RLS).
- Cross-tenant deny by default; fail-closed authorization.

## 13 Canonical Role Templates
`VEGEN_PLATFORM_ADMIN`, `HOLDING_OWNER`, `HOLDING_ADMIN`, `OWNER`, `MANAGER`, `ADMINISTRATIVE`, `PURCHASING`, `RECEPTION_FLOOR`, `PRODUCTION`, `COOK_COST_SHEET_MANAGER`, `HR_PERSONNEL`, `EXTERNAL_ACCOUNTANT`, `CONSULTANT`.

## Human Gates
`REVIEW_RECONCILIATION` != `CONFIRM_RECONCILIATION` | `CREATE_PO` != `APPROVE_PO` | `RUN_COUNT` != `CONFIRM_ADJUSTMENT`
