/**
 * HORECA Modular — Bank Statement Import Application Service (WP-FIN-001)
 * Coordinates format detection, parser routing, account resolution,
 * multi-layered idempotency, preview building, and confirmed persistence.
 *
 * Invariants:
 * - Target BankAccount is revalidated strictly at confirmation time.
 * - Final fingerprints are ALWAYS recomputed with the verified final bankAccountId.
 * - Fails closed on any infrastructure error during duplicate checks.
 */

import {
  ImportPreviewDTO,
  ImportConfirmationResult,
  CanonicalBankMovement,
  DuplicateStatus,
  BankAccount,
  BankFormatFamily,
  ProductType
} from '../domain/types';
import { generateMovementFingerprint } from '../domain/fingerprint';
import { parseBankStatementBuffer } from '../infrastructure/parsers';
import { resolveBankAccount } from './BankAccountResolver';
import { FinanceRepository } from './FinanceRepository';
import { moneyToMinorUnits } from '../domain/money';

export class InvalidTargetAccountError extends Error {
  public readonly isInvalidTargetAccountError = true;
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTargetAccountError';
  }
}

export class BankStatementImportService {
  constructor(private repo: FinanceRepository) {}

  private validateAccountCompatibility(account: BankAccount, formatFamily: BankFormatFamily): void {
    if (!['BBVA_ACCOUNT', 'BBVA_CARD', 'SABADELL_ACCOUNT', 'SABADELL_CARD'].includes(formatFamily)) {
      throw new InvalidTargetAccountError('Unsupported source format.');
    }
    let expectedInstitution = 'BBVA';
    let expectedProductType: ProductType = 'BANK_ACCOUNT';

    if (formatFamily === 'BBVA_ACCOUNT') {
      expectedInstitution = 'BBVA';
      expectedProductType = 'BANK_ACCOUNT';
    } else if (formatFamily === 'BBVA_CARD') {
      expectedInstitution = 'BBVA';
      expectedProductType = 'CARD';
    } else if (formatFamily === 'SABADELL_ACCOUNT') {
      expectedInstitution = 'SABADELL';
      expectedProductType = 'BANK_ACCOUNT';
    } else if (formatFamily === 'SABADELL_CARD') {
      expectedInstitution = 'SABADELL';
      expectedProductType = 'CARD';
    }

    if (account.institution.toUpperCase() !== expectedInstitution.toUpperCase()) {
      throw new InvalidTargetAccountError(
        `La cuenta bancaria "${account.displayName}" (${account.institution}) no es compatible con el formato detectado (${expectedInstitution}).`
      );
    }

    if (account.productType !== expectedProductType) {
      throw new InvalidTargetAccountError(
        `El tipo de producto de la cuenta "${account.displayName}" (${account.productType}) no coincide con el archivo bancario (${expectedProductType}).`
      );
    }

    if (!account.isActive) {
      throw new InvalidTargetAccountError(
        `La cuenta bancaria seleccionada "${account.displayName}" se encuentra inactiva.`
      );
    }
  }

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
    const availableAccounts = (await this.repo.fetchBankAccounts(organizationId)).filter(a => a.organizationId === organizationId);

    // 3. Resolve target bank account
    let targetAccount: BankAccount | null = null;
    let requiresSelection = false;
    let compatibleAccounts: BankAccount[] = [];

    if (overrideAccountId) {
      targetAccount = availableAccounts.find(a => a.id === overrideAccountId) || null;
      if (!targetAccount) {
        throw new InvalidTargetAccountError(`Cuenta bancaria seleccionada no encontrada en la organización activa.`);
      }
      this.validateAccountCompatibility(targetAccount, detection.formatFamily);
      compatibleAccounts = availableAccounts.filter(acc =>
        acc.isActive &&
        acc.institution.toUpperCase() === targetAccount?.institution.toUpperCase() &&
        acc.productType === targetAccount?.productType
      );
    } else {
      const resolution = resolveBankAccount(detection.formatFamily, detection.metadata, availableAccounts);
      targetAccount = resolution.resolvedAccount;
      requiresSelection = resolution.requiresSelection;
      compatibleAccounts = resolution.compatibleAccounts;
    }

    // 4. Level A: Check exact file duplicate (fail-closed if DB error)
    const fileDupCheck = await this.repo.checkFileDuplicate(parsedResult.fileHash, organizationId);
    const isExactFileDuplicate = fileDupCheck.isDuplicate;
    const existingImportId = fileDupCheck.isDuplicate ? fileDupCheck.file.import_id : null;

    // 5. Generate fingerprints for movements
    const resolvedAccountId = targetAccount?.id;

    const fingerprintPromises = parsedResult.movements.map(async (m) => {
      const fp = resolvedAccountId ? await generateMovementFingerprint({
        bankAccountId: resolvedAccountId,
        bookingDate: m.bookingDate,
        valueDate: m.valueDate,
        amount: m.amount,
        normalizedDescription: m.description,
        runningBalance: m.runningBalance,
        bankNativeId: m.bankNativeId,
        externalReference: m.externalReference
      }) : "";
      return { ...m, fingerprint: fp };
    });

    const movementsWithFp = await Promise.all(fingerprintPromises);

    // 6. Level C: Check existing fingerprints in organization (fail-closed if DB error)
    const fps = movementsWithFp.map(m => m.fingerprint).filter(Boolean);
    const existingFpSet = await this.repo.fetchExistingFingerprints(fps, organizationId);

    let totalIncome = 0;
    let totalExpense = 0;

    const previewMovements = movementsWithFp.map(m => {
      if (m.amount >= 0) {
        totalIncome += moneyToMinorUnits(m.amount);
      } else {
        totalExpense += moneyToMinorUnits(m.amount);
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
        externalReference: m.externalReference,
        minimizedProvenance: m.minimizedProvenance
      };
    });

    if (!Number.isSafeInteger(totalIncome) || !Number.isSafeInteger(totalExpense)) throw new Error('Money totals exceed the supported range.');
    return {
      organizationId,
      rejectedRows: parsedResult.rejectedRows,
      fileName,
      fileHash: parsedResult.fileHash,
      formatFamily: detection.formatFamily,
      detectedAccountMeta: detection.metadata,
      resolvedAccountId: targetAccount?.id || null,
      resolvedAccountName: targetAccount?.displayName || null,
      requiresAccountSelection: requiresSelection,
      compatibleAccounts,
      totalMovements: previewMovements.length,
      totalIncome: totalIncome / 100,
      totalExpense: totalExpense / 100,
      netAmount: (totalIncome + totalExpense) / 100,
      isExactFileDuplicate,
      existingImportId,
      movements: previewMovements
    };
  }

  /**
   * Confirms and persists the bank statement import.
   * Enforces human gate: CONFIRM_BANK_STATEMENT_IMPORT.
   * Re-validates target account compatibility and re-computes all canonical fingerprints.
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

    if (preview.organizationId !== organizationId) throw new Error('Preview organization does not match active organization.');
    await this.repo.requireConfirmationAuthorization(organizationId);

    // 1. Re-validate target account exists, belongs to organization, and is compatible
    const availableAccounts = (await this.repo.fetchBankAccounts(organizationId)).filter(a => a.organizationId === organizationId);
    const verifiedAccount = availableAccounts.find(a => a.id === targetAccountId);
    if (!verifiedAccount) {
      throw new InvalidTargetAccountError(`La cuenta bancaria con ID "${targetAccountId}" no existe en la organización activa.`);
    }
    this.validateAccountCompatibility(verifiedAccount, preview.formatFamily);

    // 2. Re-verify exact file duplicate (Level A) fail-closed
    const fileDup = await this.repo.checkFileDuplicate(preview.fileHash, organizationId);
    if (fileDup.isDuplicate) {
      return {
        importId: fileDup.file.import_id,
        bankAccountId: fileDup.file.bank_account_id,
        totalParsed: preview.totalMovements,
        persistedCount: 0,
        potentialOverlapCount: 0,
        duplicateSuppressedCount: preview.totalMovements,
        status: 'COMPLETED'
      };
    }

    // 3. RECOMPUTE all fingerprints using the verified final bankAccountId
    const recomputedMovementsPromises = preview.movements.map(async (m) => {
      const finalFp = await generateMovementFingerprint({
        bankAccountId: verifiedAccount.id,
        bookingDate: m.bookingDate,
        valueDate: m.valueDate,
        amount: m.amount,
        normalizedDescription: m.description,
        runningBalance: m.runningBalance,
        bankNativeId: m.bankNativeId,
        externalReference: m.externalReference
      });

      return {
        ...m,
        fingerprint: finalFp
      };
    });

    const recomputedMovements = await Promise.all(recomputedMovementsPromises);

    // 4. Re-check existing fingerprints for Level C Overlap with final account ID
    const finalFps = recomputedMovements.map(m => m.fingerprint);
    const existingFinalFpSet = await this.repo.fetchExistingFingerprints(finalFps, organizationId);

    // 5. Build canonical movements with final verified fingerprints and overlap statuses
    const canonicalMovements: CanonicalBankMovement[] = recomputedMovements.map(m => {
      const isOverlap = existingFinalFpSet.has(m.fingerprint);
      const finalDuplicateStatus: DuplicateStatus = isOverlap ? 'POTENTIAL_OVERLAP' : 'UNIQUE';

      return {
        organizationId,
        bankAccountId: verifiedAccount.id,
        bookingDate: m.bookingDate,
        valueDate: m.valueDate || null, // Invariant: DO NOT manufacture missing value dates
        description: m.description,
        amount: m.amount,
        currency: m.currency,
        direction: m.direction,
        runningBalance: m.runningBalance,
        externalReference: m.externalReference,
        sourceRowNumber: m.sourceRowNumber,
        fingerprint: m.fingerprint,
        bankNativeId: m.bankNativeId,
        duplicateStatus: finalDuplicateStatus,
        status: 'ACTIVE',
        minimizedProvenance: m.minimizedProvenance
      };
    });

    return this.repo.persistConfirmedImport({
      organizationId,
      bankAccountId: verifiedAccount.id,
      fileName: preview.fileName,
      fileHash: preview.fileHash,
      sourceFormat: preview.formatFamily,
      rejectedRows: preview.rejectedRows,
      movements: canonicalMovements
    });
  }
}
