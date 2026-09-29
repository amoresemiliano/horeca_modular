/**
 * HORECA Modular — Supabase Finance Repository Adapter (WP-FIN-001)
 * Multi-tenant, fail-closed operational repository for bank statement imports and movements.
 */

import { supabase } from '../../../../lib/supabase.js';
import {
  BankAccount,
  CanonicalBankMovement,
  ImportConfirmationResult,
  ProductType
} from '../../domain/types';

import { FinanceRepository, FileDuplicate, PersistImportInput } from '../../application/FinanceRepository';
import { moneyToMinorUnits, moneyToDecimal } from '../../domain/money';

export class SupabaseFinanceRepository implements FinanceRepository {
  async requireConfirmationAuthorization(orgId: string): Promise<void> {
    this.requireOrg(orgId);
    const { data, error } = await supabase.rpc('can_execute_capability_for_org', {
      requested_organization_id: orgId, required_capability_code: 'STATEMENTS_IMPORT_CONFIRM',
    });
    if (error || data !== true) throw new Error('Bank import confirmation denied or authorization unavailable.');
  }

  private requireOrg(orgId: string): string {
    if (!orgId || typeof orgId !== 'string' || orgId.trim() === '') {
      throw new Error('FAIL-CLOSED: Active organizationId is strictly required for Finance repository operations.');
    }
    return orgId.trim();
  }

  /**
   * Fetches active bank accounts for an organization.
   */
  async fetchBankAccounts(orgId: string): Promise<BankAccount[]> {
    const activeOrgId = this.requireOrg(orgId);

    const { data, error } = await supabase
      .from('eco_financial_accounts')
      .select('*')
      .eq('organization_id', activeOrgId)
      .eq('is_active', true);

    if (error) {
      throw new Error(`FAIL-CLOSED: Error al consultar cuentas bancarias: ${error.message}`);
    }

    return (data || []).map(row => {
      const typeRaw = (row.product_type || row.account_type || '').toUpperCase();
      const productType: ProductType = typeRaw.includes('TARJETA') || typeRaw === 'CARD'
        ? 'CARD'
        : 'BANK_ACCOUNT';

      const institution = row.institution || row.bank_name;
      if (!institution || !['BANK_ACCOUNT', 'CARD', 'CUENTA', 'TARJETA'].includes(typeRaw)) throw new Error('FAIL-CLOSED: Unresolved bank account metadata.');
      const masked = row.masked_identifier || (row.iban ? `•••• ${row.iban.slice(-4)}` : row.code);

      return {
        id: row.id,
        organizationId: row.organization_id,
        institution: institution.toUpperCase(),
        displayName: row.name || row.display_name || `${institution} ${productType}`,
        productType,
        maskedIdentifier: masked,
        externalReference: row.external_reference || null,
        currency: row.currency || 'EUR',
        isActive: row.is_active === true,
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || new Date().toISOString(),
      };
    });
  }

  /**
   * Level A: Checks if exact file hash already exists in this organization.
   * FAIL-CLOSED: Infrastructure error throws rather than silently returning false.
   */
  async checkFileDuplicate(fileHash: string, orgId: string): Promise<FileDuplicate> {
    const activeOrgId = this.requireOrg(orgId);

    const { data, error } = await supabase
      .from('eco_source_files')
      .select('import_id, eco_source_imports!inner(bank_account_id, status)')
      .eq('organization_id', activeOrgId)
      .eq('sha256_hash', fileHash)
      .maybeSingle();

    if (error) {
      throw new Error(`FAIL-CLOSED: Error de infraestructura al verificar duplicados de archivo (Level A): ${error.message}`);
    }

    if (data) {
      const entry = data.eco_source_imports as unknown as { bank_account_id: string; status: string };
      if (!entry?.bank_account_id || entry.status !== 'COMPLETED') {
        throw new Error('FAIL-CLOSED: Incomplete source import requires recovery.');
      }
      return { isDuplicate: true, file: { import_id: data.import_id, bank_account_id: entry.bank_account_id } };
    }

    return { isDuplicate: false };
  }

  /**
   * Level C: Fetches existing movement fingerprints in this organization for overlap detection.
   * FAIL-CLOSED: Infrastructure error throws rather than silently returning an empty set.
   */
  async fetchExistingFingerprints(fingerprints: string[], orgId: string): Promise<Set<string>> {
    const activeOrgId = this.requireOrg(orgId);
    if (!fingerprints || fingerprints.length === 0) return new Set();

    const { data, error } = await supabase
      .from('eco_financial_movements')
      .select('financial_fingerprint')
      .eq('organization_id', activeOrgId)
      .in('financial_fingerprint', fingerprints);

    if (error) {
      throw new Error(`FAIL-CLOSED: Error de infraestructura al verificar huellas de movimientos (Level C): ${error.message}`);
    }

    return new Set((data || []).map(r => r.financial_fingerprint).filter(Boolean));
  }

  /**
   * Confirms via the single server-authorized atomic persistence boundary.
   */
  async persistConfirmedImport(input: PersistImportInput): Promise<ImportConfirmationResult> {
    const activeOrgId = this.requireOrg(input.organizationId);

    // This RPC repeats authorization and account validation inside the transaction.
    // Preview fingerprints, overlap flags and raw banking rows are not trusted inputs.
    const { data, error } = await supabase.rpc('rpc_confirm_bank_statement_import', {
      requested_organization_id: activeOrgId,
      bank_account_id: input.bankAccountId,
      file_hash: input.fileHash,
      source_format: input.sourceFormat,
      movements: input.movements.map(m => ({
        bookingDate: m.bookingDate, valueDate: m.valueDate, description: m.description,
        amount: moneyToDecimal(m.amount), currency: m.currency, direction: m.direction,
        runningBalance: m.runningBalance === null ? null : moneyToDecimal(m.runningBalance),
        sourceRowNumber: m.sourceRowNumber, bankNativeId: m.bankNativeId, externalReference: m.externalReference,
      })),
      rejected_rows: input.rejectedRows.map(r => ({ sourceRowNumber: r.sourceRowNumber, code: r.code })),
    });
    if (error) throw new Error(`Import confirmation failed: ${error.message}`);
    if (!data || data.status !== 'COMPLETED' || !data.importId || !data.bankAccountId ||
        !Number.isSafeInteger(data.persistedCount) || data.persistedCount < 0) {
      throw new Error('Invalid confirmation response. Reload import state before retrying.');
    }
    return data as ImportConfirmationResult;
  }

  /**
   * Fetches persisted canonical movements.
   */
  async fetchMovements(orgId: string): Promise<CanonicalBankMovement[]> {
    const activeOrgId = this.requireOrg(orgId);

    const { data, error } = await supabase
      .from('eco_financial_movements')
      .select(`
        *,
        source_account:eco_financial_accounts(*)
      `)
      .eq('organization_id', activeOrgId)
      .eq('status', 'ACTIVE')
      .order('fecha', { ascending: false });

    if (error) {
      throw new Error(`FAIL-CLOSED: Error al consultar movimientos: ${error.message}`);
    }

    return (data || []).map(row => {
      const amount = Number(row.monto);
      if (row.monto === null || row.monto === undefined || row.monto === '') throw new Error('Missing persisted amount.');
      moneyToMinorUnits(amount);
      const payload = row.normalized_payload || {};
      if (!payload.currency || !payload.direction || !row.financial_fingerprint || !row.source_row_number) throw new Error('Incomplete canonical movement.');
      return {
        id: row.id,
        organizationId: row.organization_id,
        bankAccountId: row.source_account_id,
        importId: row.import_id,
        bookingDate: row.fecha,
        valueDate: row.fecha_valor || null, // Preserves null
        description: row.descripcion,
        amount,
        currency: payload.currency,
        direction: payload.direction,
        runningBalance: payload.running_balance ?? null,
        externalReference: payload.external_reference ?? null,
        sourceRowNumber: row.source_row_number,
        fingerprint: row.financial_fingerprint,
        bankNativeId: row.bank_native_id ?? null,
        duplicateStatus: row.duplicate_status || 'UNIQUE',
        status: 'ACTIVE',
        minimizedProvenance: row.raw_payload || {},
        createdAt: row.created_at
      };
    });
  }
}
