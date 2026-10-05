# WP-SALES-002-R5 — CSV performance gate remediation

The standard suite keeps the complete 5,000-row correctness contract. A separate, sequential CI step now enforces the unchanged **each import <5,000 ms** requirement with the same fixture and ingestion use case. No migrations, Sales architecture, authorization, mappings, or other module contracts changed.

## Profiling and measured decision

Baseline source: reviewed `5e767ecdab55dc9dd37d0117d054372d665b9e8e`. The existing local work was preserved; the reviewed hash helper was temporarily restored for baseline measurements before completing the remediation. Profile wrappers instrument actual production methods, including the private field resolver through test-only spying. No instrumentation is shipped in runtime code.

Measurements on 2026-10-05: Windows x64, Node v22.17.1, Intel Core i7-1360P. All phases below are milliseconds; nested inclusive phases overlap and **must not be added**. Spy overhead and cold compilation/JIT/GC effects make diagnostic totals unsuitable as a performance gate. Time outside these methods includes UUIDs, dates, row orchestration, and wrapper overhead; the profile does not claim to account for every allocation.

| Phase | Calls | Reviewed baseline | Optimized |
| --- | ---: | ---: | ---: |
| CSV parse | 1 | 117.09 | 95.09 |
| Row field lookup/normalization | 45,000 | 72.21 | 60.98 |
| Spanish number parsing | 10,000 | 30.27 | 28.09 |
| External identity generation, including hashing | 5,000 | 250.04 | 126.24 |
| File SHA-256 | 1 | 307.17 | 150.40 |
| Identity SHA-256, nested in external identity | 5,000 | 210.11 | 104.30 |
| Product-line parsing | 5,000 | 61.23 | 52.75 |
| Canonical Sale construction | 5,000 | 25.61 | 13.64 |
| Canonical SaleLine construction | 31,395 | 71.61 | 57.77 |
| Provenance construction | 2 | 0.18 | 0.17 |
| Repository lookup | 1 | 16.63 | 5.35 |
| Repository save | 1 | 23.66 | 13.67 |
| Provenance save | 2 | 0.11 | 0.09 |
| Whole instrumented import | 1 | 1,512.37 | 975.99 |

SHA-256 was the largest measured individual cost: approximately 517 ms across file/identity hashing in the final baseline. The file helper allocated a schedule slice and copied hash array for every 64-byte block. It now allocates two scratch buffers per invocation and reuses them across blocks, with round constants initialized once at module scope. Scratch buffers remain invocation-local. SHA-256 rounds, input byte encoding, discriminator contents, and output format remain unchanged; the runtime uses only browser-safe JavaScript. Other helpers were left unchanged because their measured costs did not warrant added complexity.

An earlier repeat measured combined hashing at 548.33 ms before and 369.76 ms after; its whole instrumented import was 1,699.71 versus 1,802.97 ms. This variability is retained here: isolated phase comparisons support removing the allocations, but cold, instrumented end-to-end timings do not establish a universal speedup.

## Controlled benchmark and budget

Run `npm run test:csv-performance` after the standard suite, with no concurrent validation commands. The dedicated config uses one worker, disables file parallelism, and **retains isolation**. The CSV is loaded and modules compiled before timing. One complete untimed import warms the path, followed by three sequential timed imports. Each sample uses fresh Sale/provenance repositories, preventing duplicate-import shortcuts. `performance.now()` measures the entire awaited use-case execution, including file hashing, parsing, canonical construction, repository operations, and provenance. Functional assertions execute after each timer. Every warm-up/sample verifies 5,000 attempted/accepted, zero duplicates/rejections, COMPLETED, and EUR 95,823.36.

| Same isolated workload | Sample 1 ms | Sample 2 ms | Sample 3 ms | Median ms | Maximum ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Reviewed baseline | 849.71 | 812.34 | 683.26 | 812.34 | 849.71 |
| Final optimized helper | 800.07 | 712.98 | 715.78 | 715.78 | 800.07 |

The original implementation also passes comfortably in isolation, supporting separation of the environment-sensitive gate from full-suite functional validation. The budget is preserved at **strictly less than 5,000 ms for every measured sample**, not a median-only pass or unlimited duration. No retries discard slow samples. The dedicated 120-second harness timeout is a hang watchdog, not the product performance budget. The diagnostic test is explicitly skipped in benchmark mode and the benchmark explicitly skipped in profile mode.

This measures the same in-memory integration workload as the original gate, not hosted database/network latency or total browser upload time. CPU scheduling, JIT, and GC still affect timing; isolation reduces contention rather than making wall-clock measurements deterministic. CI executes the dedicated budget step separately after the standard suite and uploads the JSON evidence even when its performance assertion fails. The standard suite's functional contract no longer depends on a global wall-clock assertion.

For a diagnostic profile in PowerShell: set `$env:CSV_PROFILE='1'`, optionally set `$env:CSV_PROFILE_LABEL`, run `npm run test:csv-performance`, then remove those environment variables before running the budget. Outputs are under `.local-data/csv-performance/`. Reviewed baseline/final profile and benchmark artifacts are retained in `docs/performance/WP-SALES-002-R5/`.

## Identity compatibility and validation

`sha256-reviewed-vectors.json` contains frozen outputs generated directly from the reviewed Git source using TypeScript transpilation. Tests verify SHA padding/block-boundary inputs, long multi-block input, invoice and code/time identities, whitespace trimming, accented text and surrogate pairs. An independent Node crypto oracle exists only in tests and uses the reviewed helper's low-byte encoding; changing this encoding to UTF-8 would change identities and was deliberately excluded. All 799-, 73-, and 5,000-row fixture identities are checked through a frozen digest of their ordered identity keys, and each complete file hash is frozen too.

Validation: `npm run lint` passes with five existing warnings; `npm run typecheck` passes; unmodified `npm run test:run` passes **43 files, 518 tests, one configured hosted test skipped**; `npm run build` passes with existing bundle/Browserslist warnings. The final dedicated benchmark passes the unchanged budget. Existing duplicate, malformed-row, billing-summary, correction, empty-line, zero-paidAmount, and tenant-isolation regressions remain in the standard suite. No `--no-isolate` execution was used as evidence.

PR #6 remains open and draft. The newer remote DEV commit `2431ada` contains Core closure documentation/browser evidence only; R5 does not merge or modify that work. Existing Last.app token/deployment prerequisites remain as documented by prior WPs and are outside this CSV remediation.

## Independent validation repeat

The complete standard commands were repeated successfully: lint (five existing warnings), typecheck, test:run (43 files, 518 passed, one skipped), build and the dedicated performance gate. No runtime or test implementation changed during this repeat.

Sequential diagnostic measurements against the reviewed source and optimized source produced 1295.50 ms and 1049.08 ms. Inclusive timings overlap and must not be summed.

| Phase | Baseline calls | Baseline ms | Optimized ms |
| --- | ---: | ---: | ---: |
| fileSha256 | 1 | 282.78 | 148.42 |
| csvParse | 1 | 96.89 | 126.39 |
| provenanceConstruction | 2 | 0.16 | 0.17 |
| provenanceSave | 2 | 0.09 | 0.16 |
| rowFieldNormalization | 45000 | 66.37 | 58.80 |
| spanishNumberParsing | 10000 | 22.28 | 19.15 |
| identitySha256 | 5000 | 169.52 | 108.23 |
| externalIdentityInclusive | 5000 | 193.33 | 139.59 |
| repositoryLookup | 1 | 6.59 | 7.10 |
| saleConstruction | 5000 | 20.28 | 14.29 |
| productLineParsing | 5000 | 87.68 | 89.59 |
| lineConstruction | 31395 | 56.11 | 47.48 |
| repositorySave | 1 | 13.45 | 17.66 |

Uninstrumented reviewed-source samples: 1066.08, 1049.80, 993.09 ms. Optimized samples: 548.29, 635.91, 678.35 ms. Every sample passed the unchanged strict 5,000 ms budget. These repeated observations do not imply a universal speedup. The four additional snapshots use the r5- filename prefix in the evidence directory.
