import Papa from 'papaparse';
import { sha256Hex, generateUuid } from '../../../shared/utils/crypto';
import { ISaleRepository } from '../../../domain/sales/repositories/ISaleRepository';
import { ISalesImportRepository } from '../../../domain/sales/repositories/ISalesImportRepository';
import { Sale } from '../../../domain/sales/models/Sale';
import { SaleLine } from '../../../domain/sales/models/SaleLine';
import { SalesImport, SalesImportStatus } from '../../../domain/sales/models/SalesImport';
import { SpanishNumberParser } from '../../../domain/sales/services/SpanishNumberParser';
import { ProductLineParser } from '../../../domain/sales/services/ProductLineParser';
import { SourceClassifier } from '../../../domain/sales/services/SourceClassifier';
import { ExternalIdentityResolver, RawTicketRow } from '../../../domain/sales/services/ExternalIdentityResolver';

export interface IngestSalesCsvInput {
  organizationId: string;
  csvContent: string;
  filename: string;
  operationalUnitId?: string | null;
}

export interface IngestSalesCsvResult {
  importId: string;
  organizationId: string;
  filename: string;
  status: SalesImportStatus;
  rowsAttempted: number;
  rowsAccepted: number;
  rowsDuplicate: number;
  rowsRejected: number;
  totalRevenue: number;
  diagnostics: Array<{
    rowNumber?: number;
    code?: string;
    message: string;
    level: 'INFO' | 'WARN' | 'ERROR';
  }>;
}

export class IngestSalesCsvUseCase {
  constructor(
    private readonly saleRepository: ISaleRepository,
    private readonly salesImportRepository: ISalesImportRepository
  ) {}

  public async execute(input: IngestSalesCsvInput): Promise<IngestSalesCsvResult> {
    const { organizationId, csvContent, filename, operationalUnitId } = input;

    if (!organizationId || organizationId.trim() === '') {
      throw new Error('IngestSalesCsvUseCase requires an explicit, validated organizationId');
    }

    if (!csvContent || csvContent.trim() === '') {
      throw new Error('CSV content is empty');
    }

    const importId = generateUuid();
    const fileHash = sha256Hex(csvContent);
    const diagnostics: IngestSalesCsvResult['diagnostics'] = [];

    // 1. Parse CSV structure
    const parsed = Papa.parse<Record<string, string>>(csvContent, {
      header: true,
      skipEmptyLines: true,
    });

    const headers = parsed.meta.fields || [];

    // 2. Classify Source Schema
    const classification = SourceClassifier.classify(headers);

    if (!classification.isValidForTicketIngestion) {
      for (const diag of classification.diagnostics) {
        diagnostics.push({
          level: 'ERROR',
          message: diag,
        });
      }

      const rejectedImport = SalesImport.create({
        id: importId,
        organizationId,
        sourceSystem: classification.sourceSystem,
        exportType: classification.exportType,
        filename,
        fileHash,
        status: 'REJECTED',
        rowsAttempted: parsed.data.length,
        rowsAccepted: 0,
        rowsDuplicate: 0,
        rowsRejected: parsed.data.length,
        totalRevenue: 0,
        errorSummary: classification.rejectionReason || 'Rejected by source classification rules',
        diagnostics,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await this.salesImportRepository.save(rejectedImport);

      return {
        importId,
        organizationId,
        filename,
        status: 'REJECTED',
        rowsAttempted: parsed.data.length,
        rowsAccepted: 0,
        rowsDuplicate: 0,
        rowsRejected: parsed.data.length,
        totalRevenue: 0,
        diagnostics,
      };
    }

    // 3. Process Rows
    const rawRows = parsed.data;
    const candidates: Array<{
      rowIndex: number;
      identityKey: string;
      algorithm: 'LASTAPP_INVOICE_V1' | 'LASTAPP_CODE_TIME_V1';
      code: string;
      invoiceNumber: string | null;
      location: string;
      occurredAt: Date;
      channel: string | null;
      paymentMethod: string | null;
      total: number;
      paidAmount: number | null;
      productsRaw: string;
      rawRow: Record<string, string>;
    }> = [];

    let rowsRejected = 0;

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNumber = i + 2; // header is row 1

      // Find field values by flexible header name lookup
      const location = this.getField(row, ['Ubicación', 'Ubicaci\ufffdn', 'location']) || 'Default Location';
      const code = this.getField(row, ['Código', 'C\ufffddigo', 'Codigo', 'code']) || `TICKET-${rowNumber}`;
      const invoiceNumber = this.getField(row, ['Factura nº', 'Factura n\ufffd', 'Factura no', 'invoice']) || null;
      const createdAtStr = this.getField(row, ['Hora de creación', 'Hora de creaci\ufffdn', 'Hora de activacion', 'created_at']);
      const channel = this.getField(row, ['Fuente', 'Marca virtual', 'channel', 'source']) || null;
      const paymentMethod = this.getField(row, ['Método de pago', 'M\ufffdtodo de pago', 'M\u01f8todo de pago', 'payment_method']) || null;
      const totalStr = this.getField(row, ['Total', 'total', 'Price']);
      const paidStr = this.getField(row, ['Pagado', 'pagado', 'paid']);
      const productsRaw = this.getField(row, ['Productos', 'productos', 'items']) || '';

      const total = SpanishNumberParser.parse(totalStr);
      if (total === null) {
        rowsRejected++;
        diagnostics.push({
          rowNumber,
          code,
          level: 'ERROR',
          message: `Row ${rowNumber} (Ticket ${code}) has an invalid monetary total: "${totalStr}"`,
        });
        continue;
      }

      const paidAmount = SpanishNumberParser.parse(paidStr);

      let occurredAt = new Date();
      if (createdAtStr) {
        const d = new Date(createdAtStr);
        if (!isNaN(d.getTime())) {
          occurredAt = d;
        }
      }

      const rawIdentityInput: RawTicketRow = {
        ubicacion: location,
        codigo: code,
        facturaNo: invoiceNumber,
        horaCreacion: createdAtStr || occurredAt.toISOString(),
      };

      const identityRes = ExternalIdentityResolver.resolveLastAppIdentity(organizationId, rawIdentityInput);

      candidates.push({
        rowIndex: rowNumber,
        identityKey: identityRes.identityKey,
        algorithm: identityRes.algorithm,
        code,
        invoiceNumber,
        location,
        occurredAt,
        channel,
        paymentMethod,
        total,
        paidAmount,
        productsRaw,
        rawRow: row,
      });
    }

    // 4. Batch Lookup Existing Identities to prevent duplicates and detect within-file repeats
    const allKeys = candidates.map(c => c.identityKey);
    const existingDbSales = await this.saleRepository.findByExternalIdentityKeys(organizationId, allKeys);

    const seenInBatch = new Set<string>();
    const salesToInsert: Array<{ sale: Sale; lines: SaleLine[] }> = [];
    const salesToUpdate: Sale[] = [];
    let rowsDuplicate = 0;
    let acceptedRevenue = 0;

    for (const cand of candidates) {
      if (seenInBatch.has(cand.identityKey)) {
        // Within-file duplicate
        rowsDuplicate++;
        diagnostics.push({
          rowNumber: cand.rowIndex,
          code: cand.code,
          level: 'INFO',
          message: `Row ${cand.rowIndex} is a duplicate within the same import file. Skipped.`,
        });
        continue;
      }
      seenInBatch.add(cand.identityKey);

      const existing = existingDbSales.get(cand.identityKey);
      if (existing) {
        rowsDuplicate++;
        // Check if any mutable attribute changed (correction / re-export)
        if (existing.total !== cand.total || existing.sourcePaymentMethod !== cand.paymentMethod) {
          const updated = Sale.create({
            ...existing.toJSON(),
            total: cand.total,
            paidAmount: cand.paidAmount,
            sourcePaymentMethod: cand.paymentMethod,
            sourceChannel: cand.channel,
            updatedAt: new Date(),
          });
          salesToUpdate.push(updated);
          diagnostics.push({
            rowNumber: cand.rowIndex,
            code: cand.code,
            level: 'INFO',
            message: `Ticket ${cand.code} already existed in database. Updated source total (${existing.total} => ${cand.total} EUR).`,
          });
        }
        continue;
      }

      // Create new canonical Sale
      const saleId = generateUuid();
      const sale = Sale.create({
        id: saleId,
        organizationId,
        operationalUnitId: operationalUnitId || null,
        salesImportId: importId,
        sourceSystem: 'lastapp',
        exportType: 'INDIVIDUAL_SALES_EXPORT',
        sourceLocation: cand.location,
        externalTicketCode: cand.code,
        externalInvoiceNumber: cand.invoiceNumber,
        externalIdentityKey: cand.identityKey,
        externalIdentityAlgorithm: cand.algorithm,
        occurredAt: cand.occurredAt,
        sourceChannel: cand.channel,
        sourcePaymentMethod: cand.paymentMethod,
        total: cand.total,
        paidAmount: cand.paidAmount,
        currency: 'EUR',
        status: 'CONFIRMED',
        rawPayload: cand.rawRow,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Parse SaleLines
      const parsedLines = ProductLineParser.parse(cand.productsRaw);
      const saleLines: SaleLine[] = [];
      const lineIdMap = new Map<number, string>(); // lineIndex -> UUID

      // First pass: generate IDs
      for (const pl of parsedLines) {
        const lineId = generateUuid();
        lineIdMap.set(pl.lineIndex, lineId);
      }

      // Second pass: instantiate SaleLine with parent link
      for (const pl of parsedLines) {
        const lineId = lineIdMap.get(pl.lineIndex)!;
        const parentLineId = pl.parentLineIndex !== null && pl.parentLineIndex !== undefined
          ? lineIdMap.get(pl.parentLineIndex) || null
          : null;

        saleLines.push(
          SaleLine.create({
            id: lineId,
            organizationId,
            saleId,
            lineIndex: pl.lineIndex,
            depth: pl.depth,
            parentLineId,
            rawText: pl.rawText,
            displayText: pl.displayText,
            quantity: pl.quantity,
            itemType: pl.itemType,
            notes: pl.notes,
            createdAt: new Date(),
          })
        );
      }

      salesToInsert.push({ sale, lines: saleLines });
      acceptedRevenue = Math.round((acceptedRevenue + cand.total) * 100) / 100;
    }

    // 5. Persist batches
    if (salesToInsert.length > 0) {
      await this.saleRepository.saveBatch(salesToInsert);
    }
    if (salesToUpdate.length > 0) {
      await this.saleRepository.updateBatch(salesToUpdate);
    }

    const rowsAccepted = salesToInsert.length;
    const finalStatus: SalesImportStatus =
      rowsRejected === 0 ? 'COMPLETED' : rowsAccepted > 0 ? 'PARTIAL' : 'FAILED';

    const salesImport = SalesImport.create({
      id: importId,
      organizationId,
      sourceSystem: 'lastapp',
      exportType: 'INDIVIDUAL_SALES_EXPORT',
      filename,
      fileHash,
      status: finalStatus,
      rowsAttempted: rawRows.length,
      rowsAccepted,
      rowsDuplicate,
      rowsRejected,
      totalRevenue: acceptedRevenue,
      diagnostics,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.salesImportRepository.save(salesImport);

    return {
      importId,
      organizationId,
      filename,
      status: finalStatus,
      rowsAttempted: rawRows.length,
      rowsAccepted,
      rowsDuplicate,
      rowsRejected,
      totalRevenue: acceptedRevenue,
      diagnostics,
    };
  }

  private getField(row: Record<string, string>, possibleNames: string[]): string | undefined {
    for (const name of possibleNames) {
      if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
        return row[name];
      }
    }
    // Try case-insensitive / normalized match
    const rowKeys = Object.keys(row);
    for (const name of possibleNames) {
      const normName = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const foundKey = rowKeys.find(
        k => k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === normName
      );
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
        return row[foundKey];
      }
    }
    return undefined;
  }
}
