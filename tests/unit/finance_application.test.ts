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
import { SupabaseFinanceRepository } from '../../src/domains/finance/infrastructure/repositories/SupabaseFinanceRepository';

const fixturesDir = path.resolve(__dirname, '../fixtures/finance');

describe('Finance Application — Bank Account Resolver', () => {
  const mockOrgId = 'org-criollo-123';

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

describe('Finance Application — BankStatementImportService & Idempotency Engine', () => {
  const mockOrgId = 'org-criollo-123';
  let mockRepo: SupabaseFinanceRepository;
  let service: BankStatementImportService;

  beforeEach(() => {
    mockRepo = new SupabaseFinanceRepository();
    service = new BankStatementImportService(mockRepo);
  });

  it('generates a full canonical preview for a fresh bank statement file', async () => {
    const fileBuf = fs.readFileSync(path.join(fixturesDir, 'sabadell_account_sanitized.xls'));

    vi.spyOn(mockRepo, 'fetchBankAccounts').mockResolvedValue([
      {
        id: 'acc-sab-1',
        organizationId: mockOrgId,
        institution: 'SABADELL',
        displayName: 'Cuenta Sabadell',
        productType: 'BANK_ACCOUNT',
        maskedIdentifier: '•••• 0001',
        externalReference: 'ES9900810000000000000001',
        currency: 'EUR',
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      }
    ]);
    vi.spyOn(mockRepo, 'checkFileDuplicate').mockResolvedValue({ isDuplicate: false });
    vi.spyOn(mockRepo, 'fetchExistingFingerprints').mockResolvedValue(new Set());

    const preview = await service.generateImportPreview(
      fileBuf.buffer,
      'sabadell_account_sanitized.xls',
      mockOrgId
    );

    expect(preview.formatFamily).toBe('SABADELL_ACCOUNT');
    expect(preview.totalMovements).toBe(2);
    expect(preview.isExactFileDuplicate).toBe(false);
    expect(preview.resolvedAccountId).toBe('acc-sab-1');
    expect(preview.movements.every(m => m.duplicateStatus === 'UNIQUE')).toBe(true);
  });

  it('Level A Idempotency: Flags DEFINITE_DUPLICATE when the exact same file is re-imported', async () => {
    const fileBuf = fs.readFileSync(path.join(fixturesDir, 'sabadell_account_sanitized.xls'));

    vi.spyOn(mockRepo, 'fetchBankAccounts').mockResolvedValue([]);
    vi.spyOn(mockRepo, 'checkFileDuplicate').mockResolvedValue({
      isDuplicate: true,
      file: { id: 'file-123', import_id: 'import-prev-456' }
    });
    vi.spyOn(mockRepo, 'fetchExistingFingerprints').mockResolvedValue(new Set());

    const preview = await service.generateImportPreview(
      fileBuf.buffer,
      'sabadell_account_sanitized.xls',
      mockOrgId
    );

    expect(preview.isExactFileDuplicate).toBe(true);
    expect(preview.existingImportId).toBe('import-prev-456');
    expect(preview.movements.every(m => m.duplicateStatus === 'DEFINITE_DUPLICATE')).toBe(true);

    // Re-importing confirmed duplicate yields 0 persisted new records
    const result = await service.confirmBankImport(preview, 'acc-sab-1', mockOrgId);
    expect(result.persistedCount).toBe(0);
    expect(result.duplicateSuppressedCount).toBe(2);
  });

  it('Level C Idempotency: Flags POTENTIAL_OVERLAP for overlapping statements without silent data loss', async () => {
    const fileBuf = fs.readFileSync(path.join(fixturesDir, 'sabadell_account_sanitized.xls'));

    vi.spyOn(mockRepo, 'fetchBankAccounts').mockResolvedValue([
      {
        id: 'acc-sab-1',
        organizationId: mockOrgId,
        institution: 'SABADELL',
        displayName: 'Cuenta Sabadell',
        productType: 'BANK_ACCOUNT',
        maskedIdentifier: '•••• 0001',
        externalReference: 'ES9900810000000000000001',
        currency: 'EUR',
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      }
    ]);
    vi.spyOn(mockRepo, 'checkFileDuplicate').mockResolvedValue({ isDuplicate: false });
    
    // Simulate one movement fingerprint already existing from a prior statement
    vi.spyOn(mockRepo, 'fetchExistingFingerprints').mockImplementation(async (fps) => {
      return new Set([fps[0]]);
    });

    const preview = await service.generateImportPreview(
      fileBuf.buffer,
      'sabadell_account_sanitized.xls',
      mockOrgId
    );

    expect(preview.movements[0].duplicateStatus).toBe('POTENTIAL_OVERLAP');
    expect(preview.movements[1].duplicateStatus).toBe('UNIQUE');
  });

  it('fails closed when organizationId is missing', async () => {
    const fileBuf = fs.readFileSync(path.join(fixturesDir, 'sabadell_account_sanitized.xls'));
    await expect(service.generateImportPreview(fileBuf.buffer, 'test.xls', '')).rejects.toThrow('FAIL-CLOSED');
  });
});
