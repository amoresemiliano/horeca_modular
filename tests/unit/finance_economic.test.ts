import { describe, expect, it } from 'vitest';
import { financeMetrics } from '../../src/domains/finance/domain/economic';
import { workflowMovements } from '../fixtures/finance/workflow';

describe('Bank truth and allocation interpretation', () => {
  it('keeps raw banking flow independent of confirmed economic meaning', () => {
    const m = financeMetrics(workflowMovements);
    expect(m.banking).toEqual({ inflows: 60700, outflows: 28045, net: 32655, count: 11 });
    expect(m.operatingIncome).toBe(9500);
    expect(m.operatingExpense).toBe(5745);
    expect(m.economic.INTERNAL_TRANSFER).toEqual({ inflows: 7500, outflows: 7500, net: 0, count: 2 });
    expect(m.economic.FINANCING_INFLOW.net).toBe(40000);
    expect(m.economic.FINANCING_OUTFLOW.net).toBe(-10500);
    expect(m.economic.CARD_SETTLEMENT.net).toBe(-4000);
    expect(m.economic.OTHER_NON_OPERATING.net).toBe(3000);
    expect(m.unclassifiedCount).toBe(2); expect(m.unclassifiedAmount).toBe(1000);
    expect(m.categories.Food).toBe(3500); expect(m.subcategories.Produce).toBe(3500);
    expect(m.counterparties['Synthetic supplier']).toBe(3500);
    expect(m.months['2026-04']).toEqual(m.banking);
  });
  it('does not treat suggestions as confirmed operating results', () => {
    const rows = structuredClone(workflowMovements);
    rows.find(r => r.id === 'sales')!.allocations![0].classification_status = 'SUGGESTED';
    const m = financeMetrics(rows);
    expect(m.operatingIncome).toBe(0); expect(m.suggestedCount).toBe(1);
    expect(m.unclassifiedCount).toBe(3); expect(m.banking).toEqual(financeMetrics(workflowMovements).banking);
  });
  it('never mixes currencies or includes deleted facts and tolerates missing allocations', () => {
    const base = workflowMovements[0];
    const m = financeMetrics([{ ...base, currency: 'USD' }, { ...base, status: 'SOFT_DELETED' }, { ...base, id: 'missing', allocations: [] }]);
    expect(m.banking.count).toBe(1); expect(m.unclassifiedCount).toBe(1); expect(m.unclassifiedAmount).toBe(7500);
  });
  it('uses exact minor units and does not mutate bank facts', () => {
    const before = JSON.stringify(workflowMovements);
    const m = financeMetrics(workflowMovements);
    expect(Number.isSafeInteger(m.operatingExpense)).toBe(true);
    expect(JSON.stringify(workflowMovements)).toBe(before);
  });
});
