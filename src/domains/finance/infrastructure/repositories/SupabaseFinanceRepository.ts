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

export interface PersistImportInput {
  organizationId: string;
  bankAccountId: string;
  fileName: string;
  fileHash: string;
  sourceFormat: string;
  movements: CanonicalBankMovement[];
}

export class SupabaseFinanceRepository {
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
      console.error('Error fetching bank accounts:', error);
      return [];
    }

    return (data || []).map(row => {
      const typeRaw = (row.account_type || row.product_type || 'CUENTA').toUpperCase();
      const productType: ProductType = typeRaw.includes('TARJETA') || typeRaw === 'CARD' 
        ? 'CARD' 
        : 'BANK_ACCOUNT';

      const institution = row.bank_name || row.institution || (row.name?.includes('BBVA') ? 'BBVA' : 'Sabadell');
      const masked = row.masked_identifier || (row.iban ? `•••• ${row.iban.slice(-4)}` : row.code);

      return {
        id: row.id,
        organizationId: row.organization_id,
        institution: institution.toUpperCase(),
        displayName: row.name || row.display_name || `${institution} ${productType}`,
        productType,
        maskedIdentifier: masked,
        externalReference: row.iban || row.external_reference || row.code,
        currency: row.currency || 'EUR',
        isActive: row.is_active !== false,
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || new Date().toISOString(),
      };
    });
  }

  /**
   * Level A: Checks if exact file hash already exists in this organization.
   */
  async checkFileDuplicate(fileHash: string, orgId: string): Promise<{ isDuplicate: boolean; file?: any }> {
    const activeOrgId = this.requireOrg(orgId);

    try {
      const { data, error } = await supabase
        .from('eco_source_files')
        .select('id, import_id, original_name, created_at')
        .eq('organization_id', activeOrgId)
        .eq('sha256_hash', fileHash)
        .maybeSingle();

      if (!error && data) {
        return { isDuplicate: true, file: data };
      }
    } catch (err) {
      console.warn('Level A duplicate check exception:', err);
    }

    return { isDuplicate: false };
  }

  /**
   * Level C: Fetches existing movement fingerprints in this organization for overlap detection.
   */
  async fetchExistingFingerprints(fingerprints: string[], orgId: string): Promise<Set<string>> {
    const activeOrgId = this.requireOrg(orgId);
    if (!fingerprints || fingerprints.length === 0) return new Set();

    try {
      const { data, error } = await supabase
        .from('eco_financial_movements')
        .select('financial_fingerprint')
        .eq('organization_id', activeOrgId)
        .in('financial_fingerprint', fingerprints);

      if (error) {
        console.warn('Error querying existing fingerprints:', error);
        return new Set();
      }

      return new Set((data || []).map(r => r.financial_fingerprint).filter(Boolean));
    } catch (err) {
      console.warn('Exception querying existing fingerprints:', err);
      return new Set();
    }
  }

  /**
   * Persists confirmed bank statement import and its canonical movements.
   */
  async persistConfirmedImport(input: PersistImportInput): Promise<ImportConfirmationResult> {
    const activeOrgId = this.requireOrg(input.organizationId);

    // 1. Create source import record
    const { data: importEntry, error: importErr } = await supabase
      .from('eco_source_imports')
      .insert({
        organization_id: activeOrgId,
        source_type: 'BANCO',
        operation_type: 'BANCO',
        status: 'PROCESSING',
        total_rows: input.movements.length,
      })
      .select()
      .single();

    if (importErr || !importEntry) {
      throw new Error(`Error al registrar importación: ${importErr?.message || 'Error desconocido'}`);
    }

    // 2. Create source file entry (Level A hash saved)
    const { error: fileErr } = await supabase
      .from('eco_source_files')
      .insert({
        import_id: importEntry.id,
        organization_id: activeOrgId,
        original_name: input.fileName,
        storage_path: `bank_statements/${importEntry.id}_${input.fileName}`,
        size_bytes: 0,
        sha256_hash: input.fileHash,
        source_type: input.sourceFormat,
      });

    if (fileErr) {
      console.warn('Warning: Could not save eco_source_files record:', fileErr.message);
    }

    // 3. Batch insert canonical movements
    let insertedCount = 0;
    let potentialOverlapCount = 0;

    const movementInserts = input.movements.map(m => {
      if (m.duplicateStatus === 'POTENTIAL_OVERLAP') {
        potentialOverlapCount++;
      }

      return {
        organization_id: activeOrgId,
        import_id: importEntry.id,
        source_account_id: input.bankAccountId,
        source_type: input.sourceFormat,
        operation_type: m.amount >= 0 ? 'INGRESO' : 'GASTO',
        status: 'ACTIVE',
        identity_key: m.fingerprint,
        financial_fingerprint: m.fingerprint,
        fecha: m.bookingDate,
        fecha_valor: m.valueDate || m.bookingDate,
        descripcion: m.description,
        monto: m.amount,
        duplicate_status: m.duplicateStatus,
        row_hash: m.fingerprint,
        raw_payload: m.minimizedProvenance,
        normalized_payload: {
          description: m.description,
          direction: m.direction,
          currency: m.currency,
          running_balance: m.runningBalance,
          bank_native_id: m.bankNativeId,
          source_row_number: m.sourceRowNumber,
        }
      };
    });

    if (movementInserts.length > 0) {
      const { data: insertedRows, error: movErr } = await supabase
        .from('eco_financial_movements')
        .insert(movementInserts)
        .select('id');

      if (movErr) {
        throw new Error(`Error al persistir movimientos bancarios: ${movErr.message}`);
      }
      insertedCount = insertedRows?.length || movementInserts.length;
    }

    // 4. Update import status to COMPLETED
    await supabase
      .from('eco_source_imports')
      .update({
        status: 'COMPLETED',
        accepted_rows: insertedCount,
        duplicate_rows: potentialOverlapCount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', importEntry.id);

    return {
      importId: importEntry.id,
      bankAccountId: input.bankAccountId,
      totalParsed: input.movements.length,
      persistedCount: insertedCount,
      potentialOverlapCount,
      duplicateSuppressedCount: 0,
      status: 'COMPLETED'
    };
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
      console.error('Error fetching movements:', error);
      return [];
    }

    return (data || []).map(row => {
      const amount = parseFloat(row.monto) || 0;
      return {
        id: row.id,
        organizationId: row.organization_id,
        bankAccountId: row.source_account_id,
        importId: row.import_id,
        bookingDate: row.fecha,
        valueDate: row.fecha_valor,
        description: row.descripcion,
        amount,
        currency: 'EUR',
        direction: amount >= 0 ? 'CREDIT' : 'DEBIT',
        runningBalance: null,
        externalReference: row.row_hash,
        sourceRowNumber: row.raw_payload?.sourceRowNumber || 0,
        fingerprint: row.financial_fingerprint || row.identity_key,
        bankNativeId: row.raw_payload?.bankNativeId || null,
        duplicateStatus: row.duplicate_status || 'UNIQUE',
        status: 'ACTIVE',
        minimizedProvenance: row.raw_payload || {},
        createdAt: row.created_at
      };
    });
  }
}
