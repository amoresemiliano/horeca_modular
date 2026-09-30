import { beforeEach, describe, expect, it, vi } from 'vitest';
const { from, rpc, query } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(),
  query: { insert: vi.fn(), update: vi.fn(), upsert: vi.fn(), select: vi.fn(), eq: vi.fn(), single: vi.fn() } }));
vi.mock('../../src/lib/supabase.js', () => ({ supabase: { from, rpc } }));
import { updateAllocationClassification, createClassificationRule, updateClassificationRule, updateFinanceAccount,
  splitMovementAllocations, confirmFinanceSuggestions, reviewTransferCandidate, createFinanceCatalogEntry, findOrCreateCounterparty } from '../../src/lib/extractosService';

describe('Finance workflow service boundaries', () => {
  beforeEach(() => {
    vi.resetAllMocks(); from.mockReturnValue(query);
    for (const key of ['insert', 'update', 'upsert', 'select', 'eq'] as const) query[key].mockReturnValue(query);
    query.single.mockResolvedValue({ data: { id: 'new-id' }, error: null });
    rpc.mockResolvedValue({ data: 1, error: null });
  });
  it('sends human interpretation to the trusted RPC without touching bank facts', async () => {
    await updateAllocationClassification({ orgId: 'tenant', allocationId: 'line', economicType: 'FINANCING_INFLOW', categoryId: '', subcategoryId: '', counterpartyId: 'party', notes: 'Loan' });
    expect(rpc).toHaveBeenCalledWith('rpc_update_bank_allocation', { requested_organization_id: 'tenant', allocation_id: 'line', patch: {
      economic_type: 'FINANCING_INFLOW', classification_status: 'CONFIRMED', category_id: null, subcategory_id: null, counterparty_id: 'party', notes: 'Loan' } });
    expect(from).not.toHaveBeenCalled();
  });
  it('creates and edits scoped rules with account/sign/type and can deactivate', async () => {
    await createClassificationRule({ orgId: 'tenant', pattern: 'SHOP', economicType: 'OPERATING_EXPENSE', sourceAccountId: 'bank', matchSign: 'NEGATIVE' });
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ organization_id: 'tenant', source_account_id: 'bank', match_sign: 'NEGATIVE', target_economic_type: 'OPERATING_EXPENSE' }));
    await updateClassificationRule('tenant', 'rule', { is_active: false });
    expect(query.eq).toHaveBeenCalledWith('organization_id', 'tenant'); expect(query.eq).toHaveBeenCalledWith('id', 'rule');
    await expect(updateClassificationRule('tenant', 'rule', { organization_id: 'other' })).rejects.toThrow('Invalid');
  });
  it('returns created catalog identities so classification can select them immediately', async () => {
    expect(await createFinanceCatalogEntry('category', { name: 'Synthetic food', type: 'GASTO' }, 'tenant')).toEqual({ id: 'new-id' });
    expect(query.insert).toHaveBeenCalledWith({ organization_id: 'tenant', name: 'Synthetic food', type: 'GASTO' });
    await createFinanceCatalogEntry('subcategory', { name: 'Synthetic produce', category_id: 'category' }, 'tenant');
    expect(query.insert).toHaveBeenLastCalledWith({ organization_id: 'tenant', name: 'Synthetic produce', category_id: 'category' });
    expect(await findOrCreateCounterparty('Synthetic provider', 'PROVEEDOR', 'tenant')).toBe('new-id');
    expect(query.upsert).toHaveBeenCalledWith({ organization_id: 'tenant', name: 'Synthetic provider', type: 'PROVEEDOR' }, { onConflict: 'organization_id,name' });
  });
  it('sends only reviewed IDs/versions and explicit transfer decisions', async () => {
    await confirmFinanceSuggestions('tenant', [{ id: 'allocation', updated_at: '2026-04-08', monto: 999, economic_type: 'OPERATING_INCOME' }]);
    expect(rpc).toHaveBeenCalledWith('rpc_confirm_finance_suggestions', { requested_organization_id: 'tenant', reviews: [{ id: 'allocation', updated_at: '2026-04-08' }] });
    await reviewTransferCandidate('tenant', 'candidate', 'REJECTED');
    expect(rpc).toHaveBeenCalledWith('rpc_review_finance_transfer', { requested_organization_id: 'tenant', candidate_id: 'candidate', decision: 'REJECTED' });
    await updateFinanceAccount('tenant', 'account', { name: 'New name', masked_identifier: '1234', is_active: false });
    expect(rpc).toHaveBeenCalledWith('rpc_update_finance_account', { requested_organization_id: 'tenant', account_id: 'account', patch: { name: 'New name', masked_identifier: '1234', is_active: false } });
  });
  it('rejects internal transfers at every generic application boundary before network I/O', async () => {
    await expect(updateAllocationClassification({ orgId: 'tenant', allocationId: 'line', economicType: 'INTERNAL_TRANSFER' })).rejects.toThrow('paired transfer review');
    await expect(splitMovementAllocations('movement', -2, [{ monto: '-2.00', economic_type: 'INTERNAL_TRANSFER' }], 'tenant')).rejects.toThrow('paired transfer review');
    await expect(createClassificationRule({ orgId: 'tenant', pattern: 'transfer', economicType: 'INTERNAL_TRANSFER' })).rejects.toThrow('paired transfer review');
    await expect(updateClassificationRule('tenant', 'rule', { target_economic_type: 'INTERNAL_TRANSFER' })).rejects.toThrow('paired transfer review');
    expect(from).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
  });
});
