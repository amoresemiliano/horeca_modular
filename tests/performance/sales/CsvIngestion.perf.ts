import { describe, it, expect, vi } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { platform, arch, cpus } from 'node:os';
import Papa from 'papaparse';
import * as crypto from '../../../src/shared/utils/crypto';
import { IngestSalesCsvUseCase } from '../../../src/application/sales/useCases/IngestSalesCsvUseCase';
import { InMemorySaleRepository } from '../../../src/infrastructure/sales/repositories/InMemorySaleRepository';
import { InMemorySalesImportRepository } from '../../../src/infrastructure/sales/repositories/InMemorySalesImportRepository';
import { ExternalIdentityResolver } from '../../../src/domain/sales/services/ExternalIdentityResolver';
import { SpanishNumberParser } from '../../../src/domain/sales/services/SpanishNumberParser';
import { ProductLineParser } from '../../../src/domain/sales/services/ProductLineParser';
import { Sale } from '../../../src/domain/sales/models/Sale';
import { SaleLine } from '../../../src/domain/sales/models/SaleLine';
import { SalesImport } from '../../../src/domain/sales/models/SalesImport';

const csvContent = readFileSync('tests/fixtures/sales/lastapp/tabs-report-0-2.csv', 'utf8');
const input = { organizationId: 'org-elcriollo-palencia', csvContent, filename: 'tabs-report-0-2.csv' };
const environment = { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model };
function setup() {
  const imports = new InMemorySalesImportRepository();
  const sales = new InMemorySaleRepository(imports);
  return { imports, sales, useCase: new IngestSalesCsvUseCase(sales, imports) };
}
function contract(result: Awaited<ReturnType<IngestSalesCsvUseCase['execute']>>) {
  expect(result).toMatchObject({ status: 'COMPLETED', rowsAttempted: 5000, rowsAccepted: 5000,
    rowsDuplicate: 0, rowsRejected: 0, totalRevenue: 95823.36 });
}
function artifact(name: string, value: unknown) {
  mkdirSync('.local-data/csv-performance', { recursive: true });
  writeFileSync(`.local-data/csv-performance/${name}.json`, JSON.stringify(value, null, 2));
}

describe('isolated 5,000-row CSV performance', () => {
  it.skipIf(!process.env.CSV_PROFILE)('profiles inclusive phase costs without imposing a budget on instrumented execution', async () => {
    const { imports, sales, useCase } = setup();
    const phases: Record<string, { calls: number; ms: number }> = {};
    // Diagnostic wrappers only; nested inclusive costs must not be summed.
    function sync(target: any, key: string, label: string | ((args: any[]) => string)) {
      const original = target[key];
      vi.spyOn(target, key).mockImplementation(function(this: any, ...args: any[]) {
        const name = typeof label === 'string' ? label : label(args);
        const start = performance.now();
        try { return original.apply(this, args); }
        finally { const p = phases[name] ??= { calls: 0, ms: 0 }; p.calls++; p.ms += performance.now() - start; }
      });
    }
    function asyncPhase(target: any, key: string, name: string) {
      const original = target[key];
      vi.spyOn(target, key).mockImplementation(async function(this: any, ...args: any[]) {
        const start = performance.now();
        try { return await original.apply(this, args); }
        finally { const p = phases[name] ??= { calls: 0, ms: 0 }; p.calls++; p.ms += performance.now() - start; }
      });
    }
    sync(Papa, 'parse', 'csvParse');
    sync(useCase, 'getField', 'rowFieldNormalization');
    sync(SpanishNumberParser, 'parse', 'spanishNumberParsing');
    sync(ExternalIdentityResolver, 'resolveLastAppIdentity', 'externalIdentityInclusive');
    sync(crypto, 'sha256Hex', args => args[0] === csvContent ? 'fileSha256' : 'identitySha256');
    sync(ProductLineParser, 'parse', 'productLineParsing');
    sync(Sale, 'create', 'saleConstruction'); sync(SaleLine, 'create', 'lineConstruction');
    sync(SalesImport, 'create', 'provenanceConstruction');
    asyncPhase(sales, 'findByExternalIdentityKeys', 'repositoryLookup');
    asyncPhase(sales, 'saveBatch', 'repositorySave');
    asyncPhase(imports, 'save', 'provenanceSave');
    const start = performance.now();
    try {
      contract(await useCase.execute(input));
      const evidence = { ...environment, totalMs: performance.now() - start, phases };
      artifact(process.env.CSV_PROFILE_LABEL || 'profile', evidence);
      console.log(JSON.stringify(evidence));
    } finally { vi.restoreAllMocks(); }
  });

  it.skipIf(Boolean(process.env.CSV_PROFILE))('keeps every measured fresh-repository import below the unchanged five-second budget', async () => {
    // Load/compile outside the timer; one complete untimed warm-up, then three
    // fresh repositories. No duplicate-import shortcut or concurrent workloads.
    contract(await setup().useCase.execute(input));
    const samplesMs: number[] = [];
    for (let i = 0; i < 3; i++) {
      const { useCase } = setup();
      const start = performance.now();
      const result = await useCase.execute(input);
      samplesMs.push(performance.now() - start);
      contract(result);
    }
    const evidence = { ...environment, rows: 5000, warmups: 1, samplesMs, budgetMs: 5000,
      maxMs: Math.max(...samplesMs), medianMs: [...samplesMs].sort((a, b) => a - b)[1] };
    artifact('benchmark', evidence); console.log(JSON.stringify(evidence));
    expect(evidence.maxMs).toBeLessThan(evidence.budgetMs);
  });
});
