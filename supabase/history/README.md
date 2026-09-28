# Historical migrations — not an execution queue

`pre_rebaseline/` preserves the original seven SQL files byte-for-byte as incident and
design history. They were **not applied to canonical HORECA DEV** and must not be marked
applied or copied back into the active queue. Some contain contaminated target assumptions,
unsafe bootstrap/role mappings or changes to domain tables outside the Core restoration.

The canonical HORECA Core chain is in `../migrations/`: consolidated baseline
`20260926000000`, followed by approved CCR-FIN-001 `20260927000000`.
See [migration classification and hosted evidence](../../docs/CORE_DEV_BASELINE_RESTORATION.md).
