import { beforeEach, describe, expect, it, vi } from 'vitest';

const { from, query } = vi.hoisted(() => {
  const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), maybeSingle: vi.fn(), order: vi.fn() };
  return { from: vi.fn(), query };
});
vi.mock('../../src/lib/supabase.js', () => ({ supabase: { from } }));
import { SupabaseFinanceRepository } from '../../src/domains/finance/infrastructure/repositories/SupabaseFinanceRepository';

describe('Finance repository boundary (mocked database; no RLS proof)', () => {
  const repo = new SupabaseFinanceRepository();
  beforeEach(() => {
    vi.clearAllMocks();
    from.mockReturnValue(query);
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
  it('direct persistence is blocked without making partial database writes pending Core contract', async () => {
    await expect(repo.persistConfirmedImport({ organizationId: 'HORECA_TEST_ORG_A', bankAccountId: 'a', fileName: 'test.xls', fileHash: 'hash', sourceFormat: 'BBVA_ACCOUNT', movements: [], rejectedRows: [] })).rejects.toThrow('CCR-FIN-001');
    expect(from).not.toHaveBeenCalled();
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
