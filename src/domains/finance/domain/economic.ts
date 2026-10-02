import { moneyToMinorUnits } from './money';

export const economicTypes = ['UNCLASSIFIED', 'OPERATING_INCOME', 'OPERATING_EXPENSE', 'INTERNAL_TRANSFER',
  'FINANCING_INFLOW', 'FINANCING_OUTFLOW', 'CARD_SETTLEMENT', 'OTHER_NON_OPERATING'] as const;
export type EconomicType = typeof economicTypes[number];
export type GenericEconomicType = Exclude<EconomicType, 'INTERNAL_TRANSFER'>;
export const genericEconomicTypes = economicTypes.filter((type): type is GenericEconomicType => type !== 'INTERNAL_TRANSFER');
export function assertGenericEconomicType(type: unknown): void {
  if (type === 'INTERNAL_TRANSFER') throw new Error('Internal transfer requires paired transfer review');
}
export const economicLabels: Record<EconomicType, string> = {
  UNCLASSIFIED: 'Sin clasificar', OPERATING_INCOME: 'Ingreso operativo', OPERATING_EXPENSE: 'Gasto operativo',
  INTERNAL_TRANSFER: 'Transferencia interna', FINANCING_INFLOW: 'Entrada de financiación', FINANCING_OUTFLOW: 'Salida de financiación',
  CARD_SETTLEMENT: 'Liquidación de tarjeta', OTHER_NON_OPERATING: 'Otro no operativo',
};
export interface Allocation {
  id: string; monto: string | number; economic_type?: EconomicType;
  classification_status: 'PENDING' | 'SUGGESTED' | 'CONFIRMED';
  category_id?: string | null; subcategory_id?: string | null; counterparty_id?: string | null;
  notes?: string | null; updated_at?: string; transfer_candidate_id?: string | null;
  classification_source?: 'MANUAL' | 'RULE';
  category?: { name: string } | null; subcategory?: { name: string } | null; counterparty?: { name: string } | null;
}
export interface FinanceMatchCandidate {
  id: string; organization_id: string; candidate_type: 'INTERNAL_TRANSFER';
  source_movement_id: string; target_movement_id: string;
  evidence: { equalOppositeAmounts: boolean; differentOwnAccounts: boolean; currency: string; dayDistance: number; referenceMatch: boolean; descriptionHint: boolean };
  score: number; status: 'SUGGESTED' | 'CONFIRMED' | 'REJECTED';
  created_at: string; reviewed_at: string | null; reviewed_by: string | null;
}
export interface FinanceRule {
  id: string; organization_id: string; pattern: string; match_sign: 'ALL' | 'POSITIVE' | 'NEGATIVE';
  source_account_id: string | null; target_economic_type: EconomicType;
  target_category_id: string | null; target_subcategory_id: string | null; target_counterparty_id: string | null;
  priority: number; is_active: boolean;
}
export interface FinanceMovement {
  id: string; monto: string | number; fecha: string; status?: string; currency?: string;
  source_account?: { id: string; name: string } | null; allocations?: Allocation[];
}
type Flow = { inflows: number; outflows: number; net: number; count: number };
const emptyFlow = (): Flow => ({ inflows: 0, outflows: 0, net: 0, count: 0 });
function add(a: number, b: number): number {
  const result = a + b;
  if (!Number.isSafeInteger(result)) throw new Error('Finance total exceeds safe minor-unit range');
  return result;
}
function accumulate(flow: Flow, cents: number) {
  flow.inflows = add(flow.inflows, Math.max(cents, 0));
  flow.outflows = add(flow.outflows, Math.max(-cents, 0));
  flow.net = add(flow.net, cents); flow.count++;
}

/** All amounts are exact cents. Confirmed allocation semantics alone feed economic totals. */
export function financeMetrics(movements: FinanceMovement[], currency = 'EUR') {
  const banking = emptyFlow();
  const accounts: Record<string, Flow> = {}, months: Record<string, Flow> = {};
  const economic = Object.fromEntries(economicTypes.map(type => [type, emptyFlow()])) as Record<EconomicType, Flow>;
  const categories: Record<string, number> = {}, subcategories: Record<string, number> = {}, counterparties: Record<string, number> = {};
  let unclassifiedCount = 0, unclassifiedAmount = 0, pendingCount = 0, suggestedCount = 0;
  for (const m of movements) {
    if ((m.status && m.status !== 'ACTIVE') || (m.currency || 'EUR') !== currency) continue;
    const cents = moneyToMinorUnits(Number(m.monto));
    accumulate(banking, cents);
    const account = m.source_account ? m.source_account.name + ' · ' + m.source_account.id.slice(0, 8) : 'Sin cuenta';
    accumulate(accounts[account] ||= emptyFlow(), cents);
    accumulate(months[m.fecha.slice(0, 7)] ||= emptyFlow(), cents);
    const allocations = m.allocations?.length ? m.allocations : [{ id: m.id, monto: m.monto, classification_status: 'PENDING' as const }];
    for (const a of allocations) {
      const amount = moneyToMinorUnits(Number(a.monto));
      if (a.classification_status === 'PENDING') pendingCount++;
      if (a.classification_status === 'SUGGESTED') suggestedCount++;
      const type = a.classification_status === 'CONFIRMED' && a.economic_type ? a.economic_type : 'UNCLASSIFIED';
      accumulate(economic[type], amount);
      if (type === 'UNCLASSIFIED') { unclassifiedCount++; unclassifiedAmount = add(unclassifiedAmount, Math.abs(amount)); }
      if (type === 'OPERATING_EXPENSE') {
        for (const [map, name] of [[categories, a.category?.name || 'Sin categoría'], [subcategories, a.subcategory?.name || 'Sin subcategoría'], [counterparties, a.counterparty?.name || 'Sin contraparte']] as const) {
          map[name] = add(map[name] || 0, -amount);
        }
      }
    }
  }
  return { banking, accounts, months, economic, categories, subcategories, counterparties,
    operatingIncome: economic.OPERATING_INCOME.net, operatingExpense: -economic.OPERATING_EXPENSE.net,
    unclassifiedCount, unclassifiedAmount, pendingCount, suggestedCount };
}
