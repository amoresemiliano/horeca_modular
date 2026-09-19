import { SupabaseClient } from '@supabase/supabase-js';
import { ISalesImportRepository } from '../../../domain/sales/repositories/ISalesImportRepository';
import { SalesImport, SalesImportStatus } from '../../../domain/sales/models/SalesImport';

export class SupabaseSalesImportRepository implements ISalesImportRepository {
  constructor(private readonly client: SupabaseClient) {}

  public async save(salesImport: SalesImport): Promise<void> {
    const row = {
      id: salesImport.id,
      organization_id: salesImport.organizationId,
      source_system: salesImport.sourceSystem,
      export_type: salesImport.exportType,
      filename: salesImport.filename,
      file_hash: salesImport.fileHash || null,
      status: salesImport.status,
      rows_attempted: salesImport.rowsAttempted,
      rows_accepted: salesImport.rowsAccepted,
      rows_duplicate: salesImport.rowsDuplicate,
      rows_rejected: salesImport.rowsRejected,
      total_revenue: salesImport.totalRevenue,
      error_summary: salesImport.errorSummary || null,
      diagnostics: salesImport.diagnostics,
      created_at: salesImport.createdAt.toISOString(),
      updated_at: salesImport.updatedAt.toISOString(),
    };

    const { error } = await this.client.from('sales_imports').upsert(row);
    if (error) {
      throw new Error(`SupabaseSalesImportRepository.save error: ${error.message}`);
    }
  }

  public async findById(organizationId: string, importId: string): Promise<SalesImport | null> {
    const { data, error } = await this.client
      .from('sales_imports')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('id', importId)
      .single();

    if (error || !data) return null;
    return this.mapRowToImport(data);
  }

  public async findByFileHash(organizationId: string, fileHash: string): Promise<SalesImport | null> {
    const { data, error } = await this.client
      .from('sales_imports')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('file_hash', fileHash)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapRowToImport(data);
  }

  public async listRecent(organizationId: string, limit = 20): Promise<SalesImport[]> {
    const { data, error } = await this.client
      .from('sales_imports')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`SupabaseSalesImportRepository.listRecent error: ${error.message}`);
    return (data || []).map(r => this.mapRowToImport(r));
  }

  private mapRowToImport(row: Record<string, unknown>): SalesImport {
    return SalesImport.create({
      id: String(row.id),
      organizationId: String(row.organization_id),
      sourceSystem: String(row.source_system),
      exportType: String(row.export_type),
      filename: String(row.filename),
      fileHash: row.file_hash ? String(row.file_hash) : null,
      status: (row.status as SalesImportStatus) || 'COMPLETED',
      rowsAttempted: Number(row.rows_attempted || 0),
      rowsAccepted: Number(row.rows_accepted || 0),
      rowsDuplicate: Number(row.rows_duplicate || 0),
      rowsRejected: Number(row.rows_rejected || 0),
      totalRevenue: Number(row.total_revenue || 0),
      errorSummary: row.error_summary ? String(row.error_summary) : null,
      diagnostics: (row.diagnostics as SalesImport['diagnostics']) || [],
      createdAt: new Date(String(row.created_at)),
      updatedAt: new Date(String(row.updated_at)),
    });
  }
}
