import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../src');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
function runtimeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? runtimeFiles(file) : /\.[jt]sx?$/.test(file) ? [file] : [];
  });
}

// Static integration guard; behavior/payload and SQL authorization have separate tests.
describe('Finance active UI wiring after Core integration', () => {
  it('has no legacy import writer or operation_type in browser source', () => {
    for (const file of runtimeFiles(root)) {
      expect(readFileSync(file, 'utf8'), path.relative(root, file)).not.toMatch(/importBankStatementData|operation_type/);
    }
  });
  it('routes Bancos to the canonical modal and application service', () => {
    expect(read('components/MainLayout.jsx')).toMatch(/case 'Bancos':\s*return <ExtractosApp/);
    const app = read('modules/extractos/ExtractosApp.jsx');
    expect(app).toContain("import ImportModal from './ImportModal'");
    expect(app).toMatch(/<ImportModal[\s\S]*?onImportCompleted=\{handleImportCompleted\}/);
    const modal = read('modules/extractos/ImportModal.jsx');
    expect(modal).toContain('new BankStatementImportService(new SupabaseFinanceRepository())');
    expect(modal).toContain('await importService.confirmBankImport(preview, targetAccId, organizationId)');
    expect(modal).toContain('accept=".xls,.xlsx"');
    expect(modal).not.toMatch(/extractosService|\.insert\(/);
  });
  it('reloads after import and keeps classification, catalog, splits and rules connected', () => {
    const app = read('modules/extractos/ExtractosApp.jsx');
    expect(app).toMatch(/const handleImportCompleted = \(summary\) => \{[\s\S]*?loadData\(\);\s*\};/);
    expect(app).toContain('fetchConsolidatedMovements(organizationId,');
    expect(app).toMatch(/<ClassificationModal[^\r\n]*onSaved=\{loadData\}/);
    expect(app).toMatch(/<FinanceCatalogModal[^\r\n]*onSaved=\{loadData\}/);
    expect(app).toMatch(/<SplitModal[\s\S]*?onConfirmSplit=\{handleConfirmSplit\}/);
    expect(app).toContain('splitMovementAllocations(movementId, origAmount, allocations, organizationId)');
    expect(read('modules/extractos/RuleModal.jsx')).toContain('applyClassificationRules(orgId)');
    expect(read('modules/extractos/ClassificationModal.jsx')).toContain('updateAllocationClassification(classificationInput(');
  });
});
