import { beforeEach, describe, expect, it, vi } from 'vitest';

const { from, query, rpc } = vi.hoisted(() => {
  const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), maybeSingle: vi.fn(), order: vi.fn() };
  return { from: vi.fn(), query, rpc: vi.fn() };
});
vi.mock('../../src/lib/supabase.js', () => ({ supabase: { from, rpc } }));
import { SupabaseFinanceRepository } from '../../src/domains/finance/infrastructure/repositories/SupabaseFinanceRepository';

describe('Finance repository boundary (mocked database; no RLS proof)', () => {
  const repo = new SupabaseFinanceRepository();
  beforeEach(() => {
    vi.clearAllMocks();
    from.mockReturnValue(query);
    rpc.mockResolvedValue({ data: true, error: null });
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.in.mockResolvedValue({ data: [], error: null });
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
  });
  it('Level A database errors block duplicate classification', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: { message: 'unavailable' } });
    await expect(repo.checkFileDuplicate('a'.repeat(64), 'HORECA_TEST_ORG_A')).rejects.toThrow('Level A');
    expect(query.eq).toHaveBeenCalledWith('organization_id', 'HORECA_TEST_ORG_A');
  });
  it('Level C database errors block duplicate classification', async () => {
    query.in.mockResolvedValue({ data: null, error: { message: 'unavailable' } });
    await expect(repo.fetchExistingFingerprints(['hash'], 'HORECA_TEST_ORG_A')).rejects.toThrow('Level C');
  });
  it('an incomplete prior import is an operational error, not a successful duplicate', async () => {
    query.maybeSingle.mockResolvedValue({ data: { import_id: 'partial', eco_source_imports: { bank_account_id: 'a', status: 'FAILED' } }, error: null });
    await expect(repo.checkFileDuplicate('hash', 'HORECA_TEST_ORG_A')).rejects.toThrow('recovery');
  });
  it('preflight uses the exact Core capability and fails closed', async () => {
    await repo.requireConfirmationAuthorization('HORECA_TEST_ORG_A');
    expect(rpc).toHaveBeenCalledWith('can_execute_capability_for_org', { requested_organization_id: 'HORECA_TEST_ORG_A', required_capability_code: 'STATEMENTS_IMPORT_CONFIRM' });
    rpc.mockResolvedValue({ data: false, error: null });
    await expect(repo.requireConfirmationAuthorization('HORECA_TEST_ORG_A')).rejects.toThrow('denied');
  });
  it('persists through one atomic RPC and omits untrusted fingerprints and raw provenance', async () => {
    rpc.mockResolvedValue({ data: { status: 'COMPLETED', importId: 'i', bankAccountId: 'a', persistedCount: 1 }, error: null });
    await repo.persistConfirmedImport({ organizationId: 'HORECA_TEST_ORG_A', bankAccountId: 'a', fileName: 'private-name.xls', fileHash: 'a'.repeat(64), sourceFormat: 'BBVA_ACCOUNT', rejectedRows: [], movements: [{
      organizationId: 'HORECA_TEST_ORG_A', bankAccountId: 'a', bookingDate: '2026-01-01', valueDate: null, description: 'TEST', amount: -10.25,
      currency: 'EUR', direction: 'DEBIT', runningBalance: null, externalReference: null, sourceRowNumber: 4, bankNativeId: null,
      fingerprint: 'untrusted', duplicateStatus: 'UNIQUE', status: 'ACTIVE', minimizedProvenance: {sourceRowNumber:4,beneficiary:'PRIVATE'},
    }] });
    expect(from).not.toHaveBeenCalled(); expect(rpc).toHaveBeenCalledTimes(1);
    const payload = rpc.mock.calls[0][1];
    expect(JSON.stringify(payload)).not.toContain('operation_type');
    expect(Object.keys(payload).sort()).toEqual(['bank_account_id', 'file_hash', 'movements', 'rejected_rows', 'requested_organization_id', 'source_format']);
    expect(payload.movements[0]).toMatchObject({ amount: '-10.25', valueDate: null });
    expect(JSON.stringify(payload)).not.toMatch(/PRIVATE|untrusted|private-name/);
    expect(rpc.mock.calls[0][0]).toBe('rpc_confirm_bank_statement_import');
  });
  it('never reports success when the RPC fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'rollback' } });
    await expect(repo.persistConfirmedImport({ organizationId: 'HORECA_TEST_ORG_A', bankAccountId: 'a', fileName: 'test.xls', fileHash: 'hash', sourceFormat: 'BBVA_ACCOUNT', movements: [], rejectedRows: [] })).rejects.toThrow('rollback');
  });
  it('reloads all canonical fields, including a null value date, without manufacturing facts', async () => {
    query.order.mockResolvedValue({ error: null, data: [{
      id: 'movement', organization_id: 'HORECA_TEST_ORG_A', source_account_id: 'account', import_id: 'import',
      fecha: '2026-01-01', fecha_valor: null, descripcion: 'HORECA_TEST', monto: '-10.25', source_row_number: 4,
      financial_fingerprint: 'hash', bank_native_id: null, duplicate_status: 'POTENTIAL_OVERLAP',
      raw_payload: { sourceRowNumber: 4 }, normalized_payload: { currency: 'USD', direction: 'DEBIT', running_balance: 100, external_reference: 'HORECA_TEST_REF' },
    }] });
    const [movement] = await repo.fetchMovements('HORECA_TEST_ORG_A');
    expect(movement).toMatchObject({ organizationId: 'HORECA_TEST_ORG_A', bankAccountId: 'account', importId: 'import',
      bookingDate: '2026-01-01', valueDate: null, amount: -10.25, currency: 'USD', direction: 'DEBIT', runningBalance: 100,
      sourceRowNumber: 4, fingerprint: 'hash', bankNativeId: null, duplicateStatus: 'POTENTIAL_OVERLAP',
      externalReference: 'HORECA_TEST_REF', minimizedProvenance: { sourceRowNumber: 4 } });
  });
});
