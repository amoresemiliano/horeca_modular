import { genericEconomicTypes, financeMetrics } from '../../domains/finance/domain/economic';
export const emptyInterpretation = () => ({ economic_type: 'UNCLASSIFIED', category_id: '', subcategory_id: '', counterparty_id: '', notes: '' });
// Banking sign is deliberately absent from interpretation initialization.
export function interpretationDraft(allocation) { return { ...emptyInterpretation(), ...allocation, economic_type: allocation?.economic_type || 'UNCLASSIFIED' }; }
export function changeCategory(value, categoryId) { return { ...value, category_id: categoryId, subcategory_id: categoryId === value.category_id ? value.subcategory_id : '' }; }
export function classificationInput(orgId, allocationId, value, requestedStatus = 'CONFIRMED') {
  return { orgId, allocationId, economicType: value.economic_type, categoryId: value.category_id, subcategoryId: value.subcategory_id,
    counterpartyId: value.counterparty_id, notes: value.notes, status: value.economic_type === 'UNCLASSIFIED' ? 'PENDING' : requestedStatus === 'SUGGESTED' ? 'SUGGESTED' : 'CONFIRMED' };
}
export function ruleExample(movement) {
  if (movement?.allocations?.length !== 1) return null;
  const a = movement.allocations[0];
  return a.classification_status === 'CONFIRMED' && !a.transfer_candidate_id && a.economic_type !== 'UNCLASSIFIED' && genericEconomicTypes.includes(a.economic_type) ? a : null;
}
export const emptyFilters = () => ({ query: '', account: '', status: '', month: '', economicType: '', category: '', counterparty: '', currency: 'EUR' });
export function filterMovements(movements, f) {
  const q = f.query.trim().toLocaleLowerCase();
  return movements.filter(m => (!m.status || m.status === 'ACTIVE') && (m.currency || 'EUR') === f.currency
    && (!f.account || m.source_account_id === f.account) && (!f.month || m.fecha.startsWith(f.month))
    && (!q || [m.descripcion, m.source_account?.name, ...(m.allocations || []).flatMap(a => [a.category?.name, a.subcategory?.name, a.counterparty?.name])].filter(Boolean).join(' ').toLocaleLowerCase().includes(q))
    && (!(f.status || f.economicType || f.category || f.counterparty) || (m.allocations || []).some(a =>
      (!f.status || a.classification_status === f.status) && (!f.economicType || (a.economic_type || 'UNCLASSIFIED') === f.economicType)
      && (!f.category || a.category_id === f.category) && (!f.counterparty || a.counterparty_id === f.counterparty))));
}
export function reviewSummary(movements, currency = 'EUR') {
  const rows = movements.filter(m => (!m.status || m.status === 'ACTIVE') && (m.currency || 'EUR') === currency), metrics = financeMetrics(rows, currency);
  const attention = rows.filter(m => !m.allocations?.length || m.allocations.some(a => a.classification_status !== 'CONFIRMED' || !a.economic_type || a.economic_type === 'UNCLASSIFIED')).length;
  const confirmed = rows.flatMap(m => m.allocations || []).filter(a => a.classification_status === 'CONFIRMED' && a.economic_type && a.economic_type !== 'UNCLASSIFIED').length;
  return { metrics, attention, confirmed, hasOperating: metrics.economic.OPERATING_INCOME.count + metrics.economic.OPERATING_EXPENSE.count > 0 };
}
