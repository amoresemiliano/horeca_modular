/**
 * extractosService.js — Capa de servicio e integración Supabase (Track A)
 * Implementa:
 *  - Persistencia multi-tenant en Supabase Staging
 *  - Duplicados Nivel A (SHA256 File), Nivel B (Row Identity), Nivel C (Economic Overlap)
 *  - Origen inmutable (eco_financial_movements) vs Asignación económica editable (eco_movement_allocations)
 *  - Motor de reglas determinísticas
 *  - Reconciliación (Movimiento <-> Movimiento, Tarjeta <-> Liquidación)
 *  - Soft delete
 */
import { supabase } from './supabase.js';
import { assertGenericEconomicType } from '../domains/finance/domain/economic';
import { moneyToDecimal } from '../domains/finance/domain/money';

function requireOrgId(orgId) {
  if (!orgId) {
    throw new Error('FAIL-CLOSED: Active organization ID is required for extractos service operations.');
  }
  return orgId;
}

// ─── Carga catálogos iniciales ────────────────────────────────────────────────
export async function getExtractosCatalogs(orgId) {
  const activeOrgId = requireOrgId(orgId);
    const [accountsRes, categoriesRes, subcategoriesRes, counterpartiesRes, rulesRes] = await Promise.all([
      supabase.from('eco_financial_accounts').select('*').eq('organization_id', activeOrgId),
      supabase.from('eco_tax_categories').select('*').eq('organization_id', activeOrgId).order('name'),
      supabase.from('eco_tax_subcategories').select('*').eq('organization_id', activeOrgId).order('name'),
      supabase.from('eco_counterparties').select('*').eq('organization_id', activeOrgId).order('name'),
      supabase.from('eco_classification_rules').select('*').eq('organization_id', activeOrgId).order('priority').order('created_at')
    ]);

    for (const result of [accountsRes, categoriesRes, subcategoriesRes, counterpartiesRes, rulesRes]) {
      if (result.error) throw new Error(result.error.message);
    }
    return {
      accounts: accountsRes.data || [],
      categories: categoriesRes.data || [],
      subcategories: subcategoriesRes.data || [],
      counterparties: counterpartiesRes.data || [],
      rules: rulesRes.data || []
    };
}

// Reload all history instead of silently stopping at PostgREST's row limit.
export async function fetchConsolidatedMovements(orgId) {
  const activeOrgId = requireOrgId(orgId);
    const movements = [];
    for (let offset = 0; ; offset += 500) {
    const { data: page, error } = await supabase
      .from('eco_financial_movements')
      .select(`
        *,
        source_account:eco_financial_accounts(*),
        allocations:eco_movement_allocations!eco_movement_allocations_movement_id_fkey(
          *,
          counterparty:eco_counterparties(*),
          category:eco_tax_categories(*),
          subcategory:eco_tax_subcategories(*)
        )
      `)
      .eq('organization_id', activeOrgId)
      .eq('status', 'ACTIVE')
      .order('fecha', { ascending: false })
      .order('id')
      .range(offset, offset + 499);

    if (error) throw error;
    movements.push(...(page || []));
    if (!page || page.length < 500) break;
    }
    return movements;
}

// ─── Actualiza Asignación Económica / Clasificación ─────────────────────────
/**
 * @param {{ orgId: string, allocationId: string, counterpartyId?: string|null, categoryId?: string|null,
 * subcategoryId?: string|null, economicType?: import('../domains/finance/domain/economic').EconomicType,
 * status?: 'PENDING'|'SUGGESTED'|'CONFIRMED', notes?: string|null }} input
 */
export async function updateAllocationClassification({ orgId, allocationId, counterpartyId, categoryId, subcategoryId, economicType, status = 'CONFIRMED', notes }) {
  assertGenericEconomicType(economicType);
  const patch = { classification_status: status };
  if (economicType !== undefined) patch.economic_type = economicType;
  if (counterpartyId !== undefined) patch.counterparty_id = counterpartyId || null;
  if (categoryId !== undefined) patch.category_id = categoryId || null;
  if (subcategoryId !== undefined) patch.subcategory_id = subcategoryId || null;
  if (notes !== undefined) patch.notes = notes;
  return rpc('rpc_update_bank_allocation', { requested_organization_id: requireOrgId(orgId), allocation_id: allocationId, patch });
}

async function rpc(name, input) {
  const { data, error } = await supabase.rpc(name, input);
  if (error) throw new Error(error.message);
  return data;
}
/**
 * @param {{ orgId: string, pattern: string, counterpartyId?: string|null, categoryId?: string|null,
 * subcategoryId?: string|null, economicType?: import('../domains/finance/domain/economic').EconomicType,
 * sourceAccountId?: string|null, matchSign?: 'ALL'|'POSITIVE'|'NEGATIVE' }} input
 */
export async function createClassificationRule({ pattern, counterpartyId, categoryId, subcategoryId, economicType = 'UNCLASSIFIED', sourceAccountId, matchSign = 'ALL', orgId }) {
  assertGenericEconomicType(economicType);
  const { data, error } = await supabase.from('eco_classification_rules').insert({
    organization_id: requireOrgId(orgId), name: `Regla: ${pattern.trim()}`, pattern: pattern.trim(), match_sign: matchSign,
    target_economic_type: economicType, source_account_id: sourceAccountId || null,
    target_counterparty_id: counterpartyId || null, target_category_id: categoryId || null,
    target_subcategory_id: subcategoryId || null, is_active: true,
  }).select().single();
  if (error) throw new Error(error.message);
  return data;
}
export async function applyClassificationRules(orgId) {
  return rpc('rpc_apply_finance_rules', { requested_organization_id: requireOrgId(orgId) });
}
export async function splitMovementAllocations(movementId, _originalAmount, allocationsList, orgId) {
  for (const allocation of allocationsList) assertGenericEconomicType(allocation.economic_type);
  return rpc('rpc_split_bank_movement', {
    requested_organization_id: requireOrgId(orgId), movement_id: movementId,
    allocations: allocationsList.map(a => {
      if (!/^-?\d+(?:\.\d{1,2})?$/.test(String(a.monto))) throw new Error('Importe de división inválido');
      return { ...a, monto: moneyToDecimal(Number(a.monto)) };
    }),
  });
}
export async function reconcileMovements({ orgId, allocationId, targetMovementId, reconciliationType }) {
  return rpc('rpc_finance_reconcile', { requested_organization_id: requireOrgId(orgId), allocation_id: allocationId,
    target_movement_id: targetMovementId, reconciliation_type: reconciliationType });
}
export async function softDeleteMovement(movementId, orgId) {
  return rpc('rpc_finance_soft_delete', { requested_organization_id: requireOrgId(orgId), movement_id: movementId });
}
export async function findOrCreateCounterparty(name, type = 'PROVEEDOR', orgId) {
  if (!name?.trim()) return null;
  const input = { organization_id: requireOrgId(orgId), name: name.trim(), type };
  const { data, error } = await supabase.from('eco_counterparties').upsert(input, { onConflict: 'organization_id,name' }).select('id').single();
  if (error) throw new Error(error.message);
  return data.id;
}
export async function createFinanceCatalogEntry(kind, input, orgId) {
  const tables = { account: 'eco_financial_accounts', category: 'eco_tax_categories', subcategory: 'eco_tax_subcategories' };
  if (!tables[kind]) throw new Error('Invalid catalog type');
  const { data, error } = await supabase.from(tables[kind]).insert({ ...input, organization_id: requireOrgId(orgId) }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateFinanceAccount(orgId, accountId, patch) {
  return rpc('rpc_update_finance_account', { requested_organization_id: requireOrgId(orgId), account_id: accountId, patch });
}
export async function updateClassificationRule(orgId, ruleId, patch) {
  assertGenericEconomicType(patch.target_economic_type);
  const allowed = ['pattern', 'name', 'match_sign', 'source_account_id', 'target_economic_type', 'target_category_id', 'target_subcategory_id', 'target_counterparty_id', 'is_active'];
  if (Object.keys(patch).some(key => !allowed.includes(key))) throw new Error('Invalid rule patch');
  const { data, error } = await supabase.from('eco_classification_rules').update(patch).eq('organization_id', requireOrgId(orgId)).eq('id', ruleId).select().single();
  if (error) throw new Error(error.message);
  return data;
}
export async function fetchTransferCandidates(orgId) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('eco_finance_match_candidates').select('*').eq('organization_id', requireOrgId(orgId)).order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
export async function detectTransferCandidates(orgId) {
  return rpc('rpc_detect_finance_transfers', { requested_organization_id: requireOrgId(orgId) });
}
export async function reviewTransferCandidate(orgId, candidateId, decision) {
  return rpc('rpc_review_finance_transfer', { requested_organization_id: requireOrgId(orgId), candidate_id: candidateId, decision });
}
export async function confirmFinanceSuggestions(orgId, allocations) {
  return rpc('rpc_confirm_finance_suggestions', { requested_organization_id: requireOrgId(orgId), reviews: allocations.map(a => ({ id: a.id, updated_at: a.updated_at })) });
}
