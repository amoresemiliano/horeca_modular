/**
 * HORECA Modular — Finance Application Layer Tests (WP-FIN-001)
 * Tests BankStatementImportService, BankAccountResolver, Idempotency Hierarchy (Level A, Level C),
 * and Account vs Card product separation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { BankAccount } from '../../src/domains/finance/domain/types';
import { resolveBankAccount } from '../../src/domains/finance/application/BankAccountResolver';
import { BankStatementImportService } from '../../src/domains/finance/application/BankStatementImportService';
import { FinanceRepository, PersistImportInput } from '../../src/domains/finance/application/FinanceRepository';
import { generateMovementFingerprint } from '../../src/domains/finance/domain/fingerprint';

const fixturesDir = path.resolve(__dirname, '../fixtures/finance');

// The service receives a complete repository double. Importing it never initializes Supabase.
describe('Finance confirmation boundary', () => {
  const org = 'HORECA_TEST_ORG_A';
  const account: BankAccount = {
    id: 'account-a', organizationId: org, institution: 'SABADELL', productType: 'BANK_ACCOUNT',
    displayName: 'HORECA_TEST account', maskedIdentifier: '0001', externalReference: 'ES9900810000000000000001',
    currency: 'EUR', isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
  let repo: FinanceRepository;
  let service: BankStatementImportService;
  let saved: PersistImportInput | undefined;
  const preview = () => {
    const bytes = fs.readFileSync(path.join(fixturesDir, 'sabadell_account_sanitized.xls'));
    return service.generateImportPreview(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 'test.xls', org);
  };
  beforeEach(() => {
    saved = undefined;
    repo = {
      requireConfirmationAuthorization: vi.fn().mockResolvedValue(undefined),
      fetchBankAccounts: vi.fn().mockResolvedValue([account, { ...account, id: 'account-b', externalReference: null }]),
      checkFileDuplicate: vi.fn().mockResolvedValue({ isDuplicate: false }),
      fetchExistingFingerprints: vi.fn().mockResolvedValue(new Set()),
      persistConfirmedImport: vi.fn(async (input: PersistImportInput) => {
        saved = input;
        return { importId: 'test-import', bankAccountId: input.bankAccountId, persistedCount: input.movements.length,
          potentialOverlapCount: input.movements.filter(m => m.duplicateStatus === 'POTENTIAL_OVERLAP').length,
          duplicateSuppressedCount: 0, totalParsed: input.movements.length, status: 'COMPLETED' as const };
      }),
    };
    service = new BankStatementImportService(repo);
  });

  it('previews canonical rows and preserves null value dates', async () => {
    const result = await preview();
    expect(result.totalMovements).toBe(2);
    expect(result.rejectedRows).toEqual([]);
    expect(result.movements[0].valueDate).toBeNull();
    expect(result.resolvedAccountId).toBe(account.id);
  });

  it('requires confirmation authorization even for a duplicate', async () => {
    const input = await preview();
    vi.mocked(repo.requireConfirmationAuthorization).mockRejectedValue(new Error('Missing CONFIRM_BANK_STATEMENT_IMPORT'));
    await expect(service.confirmBankImport(input, account.id, org)).rejects.toThrow('CONFIRM_BANK_STATEMENT_IMPORT');
    expect(repo.persistConfirmedImport).not.toHaveBeenCalled();
  });

  it.each([
    { organizationId: 'HORECA_TEST_ORG_B' }, { isActive: false }, { institution: 'BBVA' }, { productType: 'CARD' as const },
  ])('revalidates account compatibility at confirmation: %j', async (change) => {
    const input = await preview();
    vi.mocked(repo.fetchBankAccounts).mockResolvedValue([{ ...account, ...change }]);
    await expect(service.confirmBankImport(input, account.id, org)).rejects.toThrow();
    expect(repo.persistConfirmedImport).not.toHaveBeenCalled();
  });

  it('rejects a preview from another active organization', async () => {
    await expect(service.confirmBankImport(await preview(), account.id, 'HORECA_TEST_ORG_B')).rejects.toThrow('organization');
    expect(repo.persistConfirmedImport).not.toHaveBeenCalled();
  });

  it.each(['checkFileDuplicate', 'fetchExistingFingerprints'] as const)('fails closed when %s throws after account validation', async (method) => {
    const input = await preview();
    vi.mocked(repo[method]).mockRejectedValue(new Error('Operational lookup failure'));
    await expect(service.confirmBankImport(input, account.id, org)).rejects.toThrow('Operational lookup failure');
    expect(repo.requireConfirmationAuthorization).toHaveBeenCalledWith(org);
    expect(repo.persistConfirmedImport).not.toHaveBeenCalled();
    if (method === 'fetchExistingFingerprints') {
      const finalFingerprint = await generateMovementFingerprint({ bankAccountId: account.id,
        ...input.movements[0], normalizedDescription: input.movements[0].description });
      expect(repo.fetchExistingFingerprints).toHaveBeenLastCalledWith(expect.arrayContaining([finalFingerprint]), org);
    }
  });

  it('recomputes fingerprints and overlaps with the final account while retaining legitimate movements', async () => {
    const input = await preview();
    vi.mocked(repo.fetchExistingFingerprints).mockImplementation(async fps => new Set([fps[0]]));
    const result = await service.confirmBankImport(input, 'account-b', org);
    expect(result.persistedCount).toBe(2);
    expect(result.potentialOverlapCount).toBe(1);
    expect(saved!.movements[0].fingerprint).not.toBe(input.movements[0].fingerprint);
    expect(saved!.movements[0].bankAccountId).toBe('account-b');
    expect(saved!.movements[0].duplicateStatus).toBe('POTENTIAL_OVERLAP');
    expect(saved!.movements[0].valueDate).toBeNull();
    expect(saved!.movements[0].externalReference).toBe(input.movements[0].externalReference);
  });

  it('suppresses exact-file reimport and returns the original account identity', async () => {
    const input = await preview();
    vi.mocked(repo.checkFileDuplicate).mockResolvedValue({ isDuplicate: true, file: { import_id: 'prior', bank_account_id: account.id } });
    const result = await service.confirmBankImport(input, 'account-b', org);
    expect(result.persistedCount).toBe(0);
    expect(result.bankAccountId).toBe(account.id);
    expect(repo.persistConfirmedImport).not.toHaveBeenCalled();
  });

  it('propagates persistence failure without reporting success', async () => {
    vi.mocked(repo.persistConfirmedImport).mockRejectedValue(new Error('Transaction failed'));
    await expect(service.confirmBankImport(await preview(), account.id, org)).rejects.toThrow('Transaction failed');
  });
});

describe('Finance Application — Bank Account Resolver', () => {
  const mockOrgId = 'HORECA_TEST_ORG_A';

  const mockAccounts: BankAccount[] = [
    {
      id: 'acc-bbva-mc',
      organizationId: mockOrgId,
      institution: 'BBVA',
      displayName: 'Cuenta MC · BBVA',
      productType: 'BANK_ACCOUNT',
      maskedIdentifier: '•••• 0001',
      externalReference: 'ES9901824924000000000001',
      currency: 'EUR',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'acc-bbva-mt',
      organizationId: mockOrgId,
      institution: 'BBVA',
      displayName: 'Cuenta MT · BBVA',
      productType: 'BANK_ACCOUNT',
      maskedIdentifier: '•••• 0002',
      externalReference: 'ES9901824924000000000002',
      currency: 'EUR',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'acc-bbva-card',
      organizationId: mockOrgId,
      institution: 'BBVA',
      displayName: 'Tarjeta Negocios · BBVA',
      productType: 'CARD',
      maskedIdentifier: '•••• 0001',
      externalReference: '01824924061500000041000001',
      currency: 'EUR',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'acc-sabadell-cta',
      organizationId: mockOrgId,
      institution: 'SABADELL',
      displayName: 'Cuenta Operativa · Sabadell',
      productType: 'BANK_ACCOUNT',
      maskedIdentifier: '•••• 0001',
      externalReference: 'ES9900810000000000000001',
      currency: 'EUR',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    }
  ];

  it('resolves BBVA Account A (MC) automatically when matching IBAN is in metadata', () => {
    const res = resolveBankAccount(
      'BBVA_ACCOUNT',
      { iban: 'ES9901824924000000000001' },
      mockAccounts
    );

    expect(res.requiresSelection).toBe(false);
    expect(res.resolvedAccount?.id).toBe('acc-bbva-mc');
  });

  it('resolves BBVA Account B (MT) independently as a distinct account identity', () => {
    const res = resolveBankAccount(
      'BBVA_ACCOUNT',
      { iban: 'ES9901824924000000000002' },
      mockAccounts
    );

    expect(res.requiresSelection).toBe(false);
    expect(res.resolvedAccount?.id).toBe('acc-bbva-mt');
  });

  it('preserves CARD vs BANK_ACCOUNT product semantics and matches card contract', () => {
    const res = resolveBankAccount(
      'BBVA_CARD',
      { contractNumber: '01824924061500000041000001' },
      mockAccounts
    );

    expect(res.requiresSelection).toBe(false);
    expect(res.resolvedAccount?.id).toBe('acc-bbva-card');
    expect(res.resolvedAccount?.productType).toBe('CARD');
  });

  it('requires user selection when multiple compatible accounts exist and no IBAN matched', () => {
    const res = resolveBankAccount(
      'BBVA_ACCOUNT',
      {}, // Missing IBAN in metadata
      mockAccounts
    );

    expect(res.requiresSelection).toBe(true);
    expect(res.resolvedAccount).toBeNull();
    expect(res.compatibleAccounts.length).toBe(2);
    expect(res.compatibleAccounts.map(a => a.id)).toContain('acc-bbva-mc');
    expect(res.compatibleAccounts.map(a => a.id)).toContain('acc-bbva-mt');
  });
});
