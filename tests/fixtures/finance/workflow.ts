import type { EconomicType, FinanceMovement } from '../../../src/domains/finance/domain/economic';

// Entirely synthetic; no real bank statement, account identifier or UAT totals.
const row = (id: string, amount: number, type: EconomicType, account = 'synthetic-a'): FinanceMovement => ({
  id, monto: amount, fecha: '2026-04-08', status: 'ACTIVE', currency: 'EUR', source_account: { id: account, name: account },
  allocations: [{ id: id + '-allocation', monto: amount, economic_type: type, classification_status: type === 'UNCLASSIFIED' ? 'PENDING' : 'CONFIRMED',
    transfer_candidate_id: type === 'INTERNAL_TRANSFER' ? 'synthetic-confirmed-pair' : null }],
});
export const workflowMovements: FinanceMovement[] = [
  row('transfer-out', -75, 'INTERNAL_TRANSFER'), row('transfer-in', 75, 'INTERNAL_TRANSFER', 'synthetic-b'),
  row('loan-received', 400, 'FINANCING_INFLOW'), row('loan-repaid', -80, 'FINANCING_OUTFLOW'),
  row('supplier', -22.45, 'OPERATING_EXPENSE'), row('sales', 95, 'OPERATING_INCOME'),
  row('card-settlement', -40, 'CARD_SETTLEMENT'), row('capital', 30, 'OTHER_NON_OPERATING'),
  { ...row('split', -60, 'OPERATING_EXPENSE'), allocations: [
    { id: 'split-food', monto: -35, economic_type: 'OPERATING_EXPENSE', classification_status: 'CONFIRMED', category: { name: 'Food' }, subcategory: { name: 'Produce' }, counterparty: { name: 'Synthetic supplier' } },
    { id: 'split-finance', monto: -25, economic_type: 'FINANCING_OUTFLOW', classification_status: 'CONFIRMED' },
  ] },
  row('unknown-positive', 7, 'UNCLASSIFIED'), row('unknown-negative', -3, 'UNCLASSIFIED'),
];
