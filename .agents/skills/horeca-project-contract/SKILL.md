---
name: horeca-project-contract
description: HORECA Modular core project contract defining domain boundaries (Spain / Restaurants / El Criollo reference), tenancy hierarchy, and product scope.
---

# horeca-project-contract

## Project Identity
- **Project**: HORECA Modular (`amoresemiliano/horeca_modular`)
- **Domain**: Restaurant & Hospitality management SaaS in Spain. Reference customer: El Criollo.
- **NOT THIS PROJECT**: MICA (Argentina accounting platform).

## Tenancy Hierarchy
`GROUP / HOLDING (Optional)` -> `ORGANIZATION (Fiscal Legal Entity / CIF)` -> `OPERATIONAL UNIT (Location / Floor / Kitchen)`
- **Ownership**: Organization owns Master Catalog, Cost Sheets, Suppliers.
- **Operations**: OperationalUnit activates and executes stock movements, shifts, and sales.
