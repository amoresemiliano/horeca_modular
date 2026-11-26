// A second relationship is used only for filtering: the displayed allocation
// embed remains complete, including other lines of split movements.
const allocationSelect = `allocations:eco_movement_allocations!eco_movement_allocations_movement_id_fkey(*,counterparty:eco_counterparties(*),category:eco_tax_categories(*),subcategory:eco_tax_subcategories(*))`;
const matchSelect = 'matching:eco_movement_allocations!eco_movement_allocations_movement_id_fkey!inner()';

export function consolidatedPageRequest(client, orgId, { page = 1, pageSize = 25, filters = {} } = {}) {
  if (!orgId) throw new Error('FAIL-CLOSED: Active organization ID is required for extractos service operations.');
  const size = [25, 50, 100].includes(Number(pageSize)) ? Number(pageSize) : 25;
  const current = Number.isSafeInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
  const relational = Boolean(filters.status || filters.economicType || filters.category || filters.subcategory || filters.counterparty);
  let query = client.from('eco_financial_movements')
    .select(`*,source_account:eco_financial_accounts(*),${allocationSelect}${relational ? ',' + matchSelect : ''}`, { count: 'exact' })
    .eq('organization_id', orgId).eq('status', 'ACTIVE');
  if (filters.currency) query = query.eq('currency', filters.currency);
  if (filters.account) query = query.eq('source_account_id', filters.account);
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(filters.month || '')) {
    const [year, month] = filters.month.split('-').map(Number);
    const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
    query = query.gte('fecha', `${filters.month}-01`).lt('fecha', `${next}-01`);
  }
  if (filters.query?.trim()) query = query.ilike('descripcion', `%${filters.query.trim().replace(/[\\%_]/g, '\\$&')}%`);
  for (const [key, column] of [['status','classification_status'], ['economicType','economic_type'], ['category','category_id'], ['subcategory','subcategory_id'], ['counterparty','counterparty_id']]) {
    if (filters[key]) query = query.eq(`matching.${column}`, filters[key]);
  }
  return { query: query.order('fecha', { ascending: false }).order('id').range((current - 1) * size, current * size - 1), page: current, pageSize: size };
}

export async function fetchConsolidatedPageWithClient(client, orgId, options) {
  const { query, page, pageSize } = consolidatedPageRequest(client, orgId, options);
  const { data, error, count } = await query;
  if (error) throw error;
  if (count == null) throw new Error('No se pudo obtener el total de movimientos.');
  return { rows: data || [], total: count, page, pageSize };
}
