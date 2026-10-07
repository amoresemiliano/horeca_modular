# Sales DEV reconciliation before live Last.app work

Source Sales SHA: e10445b73248bf0924de75a308370d1263429050.
Approved DEV base: 78fb5127793767120e49170f254edbaa92af49f8.
Current production main: 4ba2a1e1daec27339ec608dd8bc97511000cae38.

Merge origin/dev into module/sales without rewriting its history. PR #6 remains open and targets dev; it is not merged here. This incorporates the approved Vegen branding, neutral platform context, platform/organization navigation and tenant-aware resolution. Production-only Core changes from main are not merged into this Sales reconciliation.

All Sales implementation files and three Sales migration blobs are preserved exactly from the starting Sales commit. The active versions remain 20261003100000 (canonical Sales schema), 20261003110000 (Last.app ingestion), and 20261003120000 (resumable sync). The twelve local migration versions have no duplicates or collisions with current DEV. No migration is renamed, added or applied to a hosted database.

Canonical Sale identity, Tab UUID/event ID separation, source correction/cancellation semantics, Location/OperationalUnit and Product mapping, durable webhook inbox, resumable sync/checkpoints/continuation version/lease fencing, idempotent writes, sales_changes and CSV ingestion are unchanged. Frozen SHA-256 compatibility vectors and historical source export fixtures remain unchanged; those pure hash oracles do not select or write to any hosted tenant.

HORECA uses shared Supabase vmxjqwlfwnphorthhcwu. El Criollo is REAL PRODUCTION ONLY. Synthetic ingestion and performance test inputs now select HORECA DEV LAB (f7f6da70-f7dc-4b1a-aa23-f5612174dcbc) in their in-memory repositories. They never contact Supabase. Local multi-tenant tests retain isolated in-memory/PGlite fixtures; future hosted testing must explicitly select DEV LAB and may not use El Criollo. DEV LAB currently has only Banks enabled; Sales enablement and migration deployment require a separate Master-controlled task.

This task performs no live Last.app API call, token configuration, hosted database access/write, migration deployment or Sales application deployment. MICA is not used.

Validation on 2026-10-07: npm run lint PASS (zero errors, five existing warnings); npm run typecheck PASS; npm run test:run PASS (43 files, 521 passed, one skipped); npm run build PASS; npm run test:csv-performance PASS (one passed, one optional test skipped). The isolated 5000-row gate used one warmup and three fresh samples: 586.21, 663.80, 622.18 ms, all below the unchanged 5000 ms budget. git diff --check passes. Sales implementation and migration diffs against the starting Sales commit are empty.
