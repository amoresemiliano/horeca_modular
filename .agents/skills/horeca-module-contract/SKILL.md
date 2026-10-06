---
name: horeca-module-contract
description: Reusable HORECA module contract template specifying ownership, boundaries, capabilities, OLTP/OLAP contracts, and CCR protocols.
---

# horeca-module-contract

## Template Outline
- **Identity & Purpose**: Name, slug, owning stream.
- **Ownership**: Owned tables, routes, services.
- **Boundaries**: May modify vs Must NOT modify (Protected Core).
- **Contracts**: OLTP schema, OLAP projections, Intelligence gates (`MODEL RECOMMENDS -> HUMAN CONFIRMS -> EXECUTES`).
- **Core Change Request (CCR)**: Required for any cross-module or Core mutation.
