---
name: horeca-delivery
description: HORECA delivery contract defining branch progression (dev -> main), Master integration authority, and isolated worktree rules.
---

# horeca-delivery

## Repository & Branches
- Repo: `amoresemiliano/horeca_modular`
- Integration: `dev` | Production: `main`

## State Progression
`IMPLEMENTED` -> `IN_DEV` -> `USER_VALIDATED` -> `READY_FOR_MAIN` -> `IN_MAIN` -> `DEPLOYED` -> `PROD_VALIDATED`

## Master Control
Development Captain controls shared migrations and integration. Module agents operate in isolated worktrees.
