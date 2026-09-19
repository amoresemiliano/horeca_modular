/**
 * HORECA Modular — Banco Sabadell Card Statement Parser (WP-FIN-001)
 * Parses Sabadell credit card extracts, reconstructing years from statement header context,
 * resolving year-boundaries deterministically, and preserving original FX details in provenance.
 */

import { ParsedBankFileResult, MovementDirection } from '../../domain/types';
import { parseSpanishMoney } from '../../domain/money';
import { parseSpanishDate, extractStatementContextFromHeaders } from '../../domain/dates';
import { DetectionResult } from './BankFormatDetector';

export function parseSabadellCard(
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
    if (rowStr.includes('FECHA') && rowStr.includes('CONCEPTO') && rowStr.includes('IMPORTE')) {
      headerRowIndex = i;
      headers = row.map(c => String(c || '').toUpperCase().trim());
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('No se encontró la cabecera estándar de movimientos de crédito Sabadell (FECHA, CONCEPTO, IMPORTE).');
  }

  const dateIdx = headers.indexOf('FECHA') >= 0 ? headers.indexOf('FECHA') : 0;
  const conceptIdx = headers.indexOf('CONCEPTO') >= 0 ? headers.indexOf('CONCEPTO') : 1;
  const locIdx = headers.indexOf('LOCALIDAD') >= 0 ? headers.indexOf('LOCALIDAD') : 2;
  
  // Find amount column (first column after concept/locality with 'IMPORTE' or index 4)
  let amountIdx = headers.indexOf('IMPORTE');
  if (amountIdx === -1) {
    amountIdx = 4;
  }
  let currencyIdx = headers.indexOf('DIVISA');
  if (currencyIdx === -1) {
    currencyIdx = 5;
  }

  const movements: ParsedBankFileResult['movements'] = [];

  for (let rIdx = headerRowIndex + 1; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    if (!row || row.length === 0) continue;

    const nonNullCells = row.filter(c => c !== null && c !== undefined && String(c).trim() !== '');
    if (nonNullCells.length < 2) continue;

    const rawDate = row[dateIdx];
    const bookingDate = parseSpanishDate(rawDate, context);
    if (!bookingDate) continue;

    const rawConcept = String(row[conceptIdx] || '').trim();
    const locality = String(row[locIdx] || '').trim();
    const rawAmount = row[amountIdx];
    const parsedAmount = parseSpanishMoney(rawAmount);

    if (parsedAmount === 0 && rawAmount === undefined) continue;

    // Sabadell Card records credit card purchases as positive absolute numbers e.g. "4,98"
    // Convert purchases to negative signed amount for canonical expense representation,
    // while keeping refunds/payments positive if explicitly negative in source.
    let amount: number;
    if (typeof rawAmount === 'string' && rawAmount.includes('-')) {
      // Explicit refund or credit
      amount = Math.abs(parsedAmount);
    } else {
      // Normal purchase
      amount = -Math.abs(parsedAmount);
    }

    const direction: MovementDirection = amount >= 0 ? 'CREDIT' : 'DEBIT';

    // Foreign currency provenance check
    const rowCurrency = String(row[currencyIdx] || 'EUR').trim().toUpperCase();
    let originalCurrency: string | undefined = undefined;
    let originalFxAmount: number | undefined = undefined;

    // Look for extra columns if transaction occurred in foreign currency
    if (rowCurrency && rowCurrency !== 'EUR') {
      originalCurrency = rowCurrency;
      originalFxAmount = Math.abs(parsedAmount);
    }

    const fullDescription = [rawConcept, locality].filter(Boolean).join(' · ').trim() || 'Operación tarjeta Sabadell';

    movements.push({
      sourceRowNumber: rIdx + 1,
      bookingDate,
      valueDate: null, // Card statement has only transaction/booking date
      description: fullDescription,
      amount,
      currency: 'EUR',
      direction,
      runningBalance: null,
      bankNativeId: null,
      externalReference: detection.metadata.cardIdentifier || detection.metadata.contractNumber || null,
      minimizedProvenance: {
        sourceRowNumber: rIdx + 1,
        rawConcept,
        observations: locality ? `Localidad: ${locality}` : undefined,
        originalCurrency,
        originalFxAmount
      }
    });
  }

  return {
    fileName,
    fileHash,
    detectedFormat: 'SABADELL_CARD',
    detectedAccountMeta: detection.metadata,
    periodStart: context.periodStart || null,
    periodEnd: context.periodEnd || null,
    totalRawRows: rows.length,
    movements
  };
}
