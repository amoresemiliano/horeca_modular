import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../src/lib/extractosService', () => ({
  createFinanceCatalogEntry: vi.fn(), findOrCreateCounterparty: vi.fn(), getExtractosCatalogs: vi.fn(),
  updateAllocationClassification: vi.fn(), createClassificationRule: vi.fn(), updateClassificationRule: vi.fn(), applyClassificationRules: vi.fn(),
}));
import AllocationFields from '../../src/modules/extractos/AllocationFields';
import ClassificationModal from '../../src/modules/extractos/ClassificationModal';
import RuleModal from '../../src/modules/extractos/RuleModal';
import { economicTypes, genericEconomicTypes } from '../../src/domains/finance/domain/economic';

const catalogs = { accounts: [], categories: [], subcategories: [], counterparties: [], rules: [] };
const movement = { id: 'synthetic', descripcion: 'Synthetic', monto: -5, currency: 'EUR', allocations: [
  { id: 'a', monto: -5, economic_type: 'UNCLASSIFIED', classification_status: 'PENDING' },
] };
const common = { catalogs, orgId: 'synthetic-org', onClose: () => {}, onSaved: () => {} };
describe('Generic economic selectors cannot establish a transfer', () => {
  it('retains transfers in the canonical model, not in generic choices', () => {
    expect(economicTypes).toContain('INTERNAL_TRANSFER');
    expect(genericEconomicTypes).toEqual(economicTypes.filter(t => t !== 'INTERNAL_TRANSFER'));
  });
  it.each([
    ['classification', () => createElement(ClassificationModal, { ...common, movement })],
    ['rules', () => createElement(RuleModal, common)],
    ['rule from a transferred example', () => createElement(RuleModal, { ...common, example: { ...movement, allocations: [
      { ...movement.allocations[0], economic_type: 'INTERNAL_TRANSFER', classification_status: 'CONFIRMED', transfer_candidate_id: 'pair' },
    ] } })],
  ])('%s exposes all approved generic types but no transfer option', (_name, element) => {
    const html = renderToStaticMarkup(element());
    expect(html).not.toContain('value="INTERNAL_TRANSFER"');
    for (const type of genericEconomicTypes) expect(html).toContain(`value="${type}"`);
  });
  it('allows a narrower context without offering an internal transfer override', () => {
    const html = renderToStaticMarkup(createElement(AllocationFields, { ...common, value: { economic_type: 'OPERATING_EXPENSE' }, onChange: () => {}, allowedEconomicTypes: ['OPERATING_EXPENSE', 'INTERNAL_TRANSFER'] }));
    expect(html).toContain('value="OPERATING_EXPENSE"');
    expect(html).not.toContain('value="INTERNAL_TRANSFER"');
    expect(html).not.toContain('value="OPERATING_INCOME"');
  });
  it('uses the same restricted options in the split selector', () => {
    // Split lines initialize after mount; static wiring complements the browser check.
    const source = readFileSync(path.resolve(__dirname, '../../src/modules/extractos/SplitModal.jsx'), 'utf8');
    expect(source).toContain('genericEconomicTypes.map(type =>');
    expect(source).not.toMatch(/\beconomicTypes\b|value="INTERNAL_TRANSFER"/);
  });
});
