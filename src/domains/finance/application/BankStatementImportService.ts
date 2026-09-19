/**
 * HORECA Modular — Bank Statement Import Application Service (WP-FIN-001)
 * Coordinates format detection, parser routing, account resolution,
 * multi-layered idempotency, preview building, and confirmed persistence.
 */

import { 
  ImportPreviewDTO, 
  ImportConfirmationResult, 
  CanonicalBankMovement,
  DuplicateStatus,
  BankAccount
} from '../domain/types';
import { generateMovementFingerprint } from '../domain/fingerprint';
import { parseBankStatementBuffer } from '../infrastructure/parsers';
import { resolveBankAccount } from './BankAccountResolver';
import { SupabaseFinanceRepository } from '../infrastructure/repositories/SupabaseFinanceRepository';

export class BankStatementImportService {
  constructor(private repo: SupabaseFinanceRepository = new SupabaseFinanceRepository()) {}

  /**
   * Generates a canonical import preview from a bank statement file buffer.
   */
  async generateImportPreview(
    arrayBuffer: ArrayBuffer,
    fileName: string,
    organizationId: string,
    overrideAccountId?: string
  ): Promise<ImportPreviewDTO> {
    if (!organizationId) {
      throw new Error('FAIL-CLOSED: No active organization selected for bank statement preview.');
    }

    // 1. Parse buffer and detect format family
    const { parsedResult, detection } = await parseBankStatementBuffer(arrayBuffer, fileName);

    // 2. Fetch available bank accounts for the organization
    const availableAccounts = await this.repo.fetchBankAccounts(organizationId);

    // 3. Resolve target bank account
    let targetAccount: BankAccount | null = null;
    let requiresSelection = false;
    let compatibleAccounts: BankAccount[] = [];

    if (overrideAccountId) {
      targetAccount = availableAccounts.find(a => a.id === overrideAccountId) || null;
      if (!targetAccount) {
        throw new Error(`Cuenta bancaria seleccionada no encontrada en la organización activa.`);
      }
    } else {
      const resolution = resolveBankAccount(detection.formatFamily, detection.metadata, availableAccounts);
      targetAccount = resolution.resolvedAccount;
      requiresSelection = resolution.requiresSelection;
      compatibleAccounts = resolution.compatibleAccounts;
    }

    // 4. Level A: Check exact file duplicate
    const fileDupCheck = await this.repo.checkFileDuplicate(parsedResult.fileHash, organizationId);
    const isExactFileDuplicate = fileDupCheck.isDuplicate;
    const existingImportId = fileDupCheck.file?.import_id || null;

    // 5. Generate fingerprints for movements
    const resolvedAccountId = targetAccount?.id || 'unresolved_account';

    const fingerprintPromises = parsedResult.movements.map(async (m) => {
      const fp = await generateMovementFingerprint({
        bankAccountId: resolvedAccountId,
        bookingDate: m.bookingDate,
        valueDate: m.valueDate,
        amount: m.amount,
        normalizedDescription: m.description,
        runningBalance: m.runningBalance,
        bankNativeId: m.bankNativeId,
        externalReference: m.externalReference
      });
      return { ...m, fingerprint: fp };
    });

    const movementsWithFp = await Promise.all(fingerprintPromises);

    // 6. Level C: Check existing fingerprints in organization
    const fps = movementsWithFp.map(m => m.fingerprint);
    const existingFpSet = await this.repo.fetchExistingFingerprints(fps, organizationId);

    let totalIncome = 0;
    let totalExpense = 0;

    const previewMovements = movementsWithFp.map(m => {
      if (m.amount >= 0) {
        totalIncome += m.amount;
      } else {
        totalExpense += m.amount;
      }

      let duplicateStatus: DuplicateStatus = 'UNIQUE';
      let duplicateReason: string | undefined = undefined;

      if (isExactFileDuplicate) {
        duplicateStatus = 'DEFINITE_DUPLICATE';
        duplicateReason = 'Archivo exacto ya importado anteriormente (Nivel A SHA-256).';
      } else if (existingFpSet.has(m.fingerprint)) {
        duplicateStatus = 'POTENTIAL_OVERLAP';
        duplicateReason = 'Movimiento coincidente con extracto previo en este canal (Nivel C Fingerprint).';
      }

      return {
        sourceRowNumber: m.sourceRowNumber,
        bookingDate: m.bookingDate,
        valueDate: m.valueDate,
        description: m.description,
        amount: m.amount,
        currency: m.currency,
        direction: m.direction,
        runningBalance: m.runningBalance,
        bankNativeId: m.bankNativeId,
        fingerprint: m.fingerprint,
        duplicateStatus,
        duplicateReason,
        minimizedProvenance: m.minimizedProvenance
      };
    });

    return {
      fileName,
      fileHash: parsedResult.fileHash,
      formatFamily: detection.formatFamily,
      detectedAccountMeta: detection.metadata,
      resolvedAccountId: targetAccount?.id || null,
      resolvedAccountName: targetAccount?.displayName || null,
      requiresAccountSelection: requiresSelection,
      compatibleAccounts,
      totalMovements: previewMovements.length,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      netAmount: Math.round((totalIncome + totalExpense) * 100) / 100,
      isExactFileDuplicate,
      existingImportId,
      movements: previewMovements
    };
  }

  /**
   * Confirms and persists the bank statement import.
   * Enforces human gate: CONFIRM_BANK_STATEMENT_IMPORT.
   */
  async confirmBankImport(
    preview: ImportPreviewDTO,
    targetAccountId: string,
    organizationId: string
  ): Promise<ImportConfirmationResult> {
    if (!organizationId) {
      throw new Error('FAIL-CLOSED: Active organizationId is required to confirm bank import.');
    }
    if (!targetAccountId) {
      throw new Error('Es necesario seleccionar una cuenta bancaria de destino válida.');
    }

    // Re-verify exact file duplicate before inserting
    const fileDup = await this.repo.checkFileDuplicate(preview.fileHash, organizationId);
    if (fileDup.isDuplicate) {
      return {
        importId: fileDup.file.import_id,
        bankAccountId: targetAccountId,
        totalParsed: preview.totalMovements,
        persistedCount: 0,
        potentialOverlapCount: 0,
        duplicateSuppressedCount: preview.totalMovements,
        status: 'COMPLETED'
      };
    }

    // Build canonical movements
    const canonicalMovements: CanonicalBankMovement[] = preview.movements.map(m => ({
      organizationId,
      bankAccountId: targetAccountId,
      bookingDate: m.bookingDate,
      valueDate: m.valueDate,
      description: m.description,
      amount: m.amount,
      currency: m.currency,
      direction: m.direction,
      runningBalance: m.runningBalance,
      externalReference: m.bankNativeId || m.fingerprint,
      sourceRowNumber: m.sourceRowNumber,
      fingerprint: m.fingerprint,
      bankNativeId: m.bankNativeId,
      duplicateStatus: m.duplicateStatus,
      status: 'ACTIVE',
      minimizedProvenance: (m as any).minimizedProvenance || { sourceRowNumber: m.sourceRowNumber }
    }));

    return this.repo.persistConfirmedImport({
      organizationId,
      bankAccountId: targetAccountId,
      fileName: preview.fileName,
      fileHash: preview.fileHash,
      sourceFormat: preview.formatFamily,
      movements: canonicalMovements
    });
  }
}
