import { beforeEach, describe, it, expect, vi } from 'vitest';
const { q, from, rpc } = vi.hoisted(() => ({ q: { update: vi.fn(), insert: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn() }, from: vi.fn(), rpc: vi.fn() }));
vi.mock('../../src/lib/supabase.js', () => ({ supabase: { from, rpc } }));
import { renameFinanceCatalogEntry, createFinanceCatalogEntry, updateFinanceAccount } from '../../src/lib/extractosService';
describe('Scoped safe catalog management', () => {
    beforeEach(() => { vi.resetAllMocks(); from.mockReturnValue(q); for (const key of ['update', 'insert', 'eq', 'select'])
        q[key].mockReturnValue(q); q.single.mockResolvedValue({ data: { id: 'entry' }, error: null }); rpc.mockResolvedValue({ data: {}, error: null }); });
    it.each([['category', 'eco_tax_categories'], ['subcategory', 'eco_tax_subcategories'], ['counterparty', 'eco_counterparties']])('renames %s without relationship or identity changes', async (kind, table) => {
        await renameFinanceCatalogEntry(kind, 'entry', ' New name ', 'org');
        expect(from).toHaveBeenCalledWith(table);
        expect(q.update).toHaveBeenCalledWith({ name: 'New name' });
        expect(q.eq.mock.calls).toEqual([['organization_id', 'org'], ['id', 'entry']]);
    });
    it('fails closed without org and refuses unsupported or empty renames', async () => {
        for (const args of [['category', 'id', 'Name', ''], ['account', 'id', 'Name', 'org'], ['category', 'id', ' ', 'org']])
            await expect(renameFinanceCatalogEntry(...args)).rejects.toThrow();
        expect(from).not.toHaveBeenCalled();
    });
    it('creates Finance counterparties scoped to active organization', async () => { await createFinanceCatalogEntry('counterparty', { name: 'Synthetic', organization_id: 'foreign' }, 'org'); expect(from).toHaveBeenCalledWith('eco_counterparties'); expect(q.insert).toHaveBeenCalledWith({ name: 'Synthetic', organization_id: 'org' }); });
    it('preserves the protected account RPC contract', async () => { const patch = { name: 'Renamed', masked_identifier: '4321', is_active: false }; await updateFinanceAccount('org', 'account', patch); expect(rpc).toHaveBeenCalledWith('rpc_update_finance_account', { requested_organization_id: 'org', account_id: 'account', patch }); expect(from).not.toHaveBeenCalled(); });
    it('propagates RLS/constraint errors instead of reporting successful renames', async () => { q.single.mockResolvedValue({ data: null, error: { message: 'denied' } }); await expect(renameFinanceCatalogEntry('category', 'id', 'Name', 'org')).rejects.toThrow('denied'); });
});
