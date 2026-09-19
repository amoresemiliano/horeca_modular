/**
 * HORECA Modular — BBVA Card Statement Parser (WP-FIN-001)
 * Parses BBVA credit/debit card extracts, preserving signed settlement amounts
 * (negative purchases, positive account inflows/refunds) without manufacturing dates.
 */

import { ParsedBankFileResult, MovementDirection } from '../../domain/types';
import { parseSpanishMoney } from '../../domain/money';
import { parseSpanishDate, extractStatementContextFromHeaders } from '../../domain/dates';
import { DetectionResult } from './BankFormatDetector';

export function parseBbvaCard(
  rows: Array<any[]>,
  fileName: string,
  fileHash: string,
  detection: DetectionResult
): ParsedBankFileResult {
  const context = extractStatementContextFromHeaders(rows);

  let headerRowIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(30, rows.length); i++) {
    const row = rows[i] || [];
    const rowStr = row.map(c => String(c || '').toUpperCase().trim()).join(' ');
    if (rowStr.includes('FECHA DE OPERACIÓN') && rowStr.includes('IMPORTE')) {
      headerRowIndex = i;
      headers = row.map(c => String(c || '').toUpperCase().trim());
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('No se encontró la fila de cabecera estándar de tarjeta BBVA (FECHA DE OPERACIÓN, IMPORTE).');
  }

  const dateIdx = headers.indexOf('FECHA DE OPERACIÓN') >= 0 ? headers.indexOf('FECHA DE OPERACIÓN') : 2;
  const conceptIdx = headers.indexOf('CONCEPTO') >= 0 ? headers.indexOf('CONCEPTO') : 3;
  const typeIdx = headers.indexOf('TIPO DE MOVIMIENTO') >= 0 ? headers.indexOf('TIPO DE MOVIMIENTO') : 4;
  const amountIdx = headers.indexOf('IMPORTE') >= 0 ? headers.indexOf('IMPORTE') : 5;
  const currencyIdx = headers.indexOf('DIVISA') >= 0 ? headers.indexOf('DIVISA') : 6;

  const movements: ParsedBankFileResult['movements'] = [];

  for (let rIdx = headerRowIndex + 1; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    if (!row || row.length === 0) continue;

    const nonNullCells = row.filter(c => c !== null && c !== undefined && String(c).trim() !== '');
    if (nonNullCells.length < 2) continue;

    const rawDate = row[dateIdx];
    const bookingDate = parseSpanishDate(rawDate, context);
    if (!bookingDate) continue;

    const concept = String(row[conceptIdx] || '').trim();
    const movType = String(row[typeIdx] || '').trim();
    const rawAmount = row[amountIdx];
    const parsedAmount = parseSpanishMoney(rawAmount);

    if (parsedAmount === 0 && rawAmount === undefined) continue;

    // Preserve signed settlement amount:
    // In BBVA card extracts, purchases are already explicitly signed negative ("-39,95")
    // and account payments/refunds are positive.
    const amount = parsedAmount;
    const direction: MovementDirection = amount >= 0 ? 'CREDIT' : 'DEBIT';
    const currency = String(row[currencyIdx] || 'EUR').trim().toUpperCase() || 'EUR';

    const fullDescription = [concept, movType].filter(Boolean).join(' · ').trim() || 'Operación con tarjeta';

    movements.push({
      sourceRowNumber: rIdx + 1,
      bookingDate,
      valueDate: null, // Card extracts do not have accounting value dates; do not manufacture
      description: fullDescription,
      amount,
      currency,
      direction,
      runningBalance: null,
      bankNativeId: null,
      externalReference: detection.metadata.contractNumber || null,
      minimizedProvenance: {
        sourceRowNumber: rIdx + 1,
        rawConcept: concept || undefined,
        observations: movType ? `Tipo: ${movType}` : undefined,
      }
    });
  }

  return {
    fileName,
    fileHash,
    detectedFormat: 'BBVA_CARD',
    detectedAccountMeta: detection.metadata,
    periodStart: context.periodStart || null,
    periodEnd: context.periodEnd || null,
    totalRawRows: rows.length,
    movements
  };
}
