import { hasCell, isStructuralRow, rejectRow } from './rowValidation';
/**
 * HORECA Modular — BBVA Current Account Parser (WP-FIN-001)
 * Parses BBVA current account extracts (Accounts A & B), extracting booking date,
 * value date, concept, beneficiary, observations, signed amount, and running balance.
 */

import { ParsedBankFileResult, MovementDirection } from '../../domain/types';
import { parseSpanishMoney } from '../../domain/money';
import { parseSpanishDate, extractStatementContextFromHeaders } from '../../domain/dates';
import { DetectionResult } from './BankFormatDetector';

export function parseBbvaAccount(
  rows: Array<any[]>,
  fileName: string,
  fileHash: string,
  detection: DetectionResult
): ParsedBankFileResult {
  const context = extractStatementContextFromHeaders(rows);

  // Find header row index
  let headerRowIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(30, rows.length); i++) {
    const row = rows[i] || [];
    const rowStr = row.map(c => String(c || '').toUpperCase().trim()).join(' ');
    if (rowStr.includes('F. CONTABLE') && rowStr.includes('IMPORTE')) {
      headerRowIndex = i;
      headers = row.map(c => String(c || '').toUpperCase().trim());
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('No se encontró la fila de cabecera estándar de extracto BBVA (F. CONTABLE, IMPORTE).');
  }

  const dateIdx = headers.indexOf('F. CONTABLE') >= 0 ? headers.indexOf('F. CONTABLE') : 2;
  const valueDateIdx = headers.indexOf('F. VALOR') >= 0 ? headers.indexOf('F. VALOR') : 3;
  const conceptIdx = headers.indexOf('CONCEPTO') >= 0 ? headers.indexOf('CONCEPTO') : 5;
  const benIdx = headers.indexOf('BENEFICIARIO/ORDENANTE') >= 0 ? headers.indexOf('BENEFICIARIO/ORDENANTE') : 6;
  const obsIdx = headers.indexOf('OBSERVACIONES') >= 0 ? headers.indexOf('OBSERVACIONES') : 7;
  const amountIdx = headers.indexOf('IMPORTE') >= 0 ? headers.indexOf('IMPORTE') : 8;
  const balanceIdx = headers.indexOf('SALDO') >= 0 ? headers.indexOf('SALDO') : 9;
  const currencyIdx = headers.indexOf('DIVISA') >= 0 ? headers.indexOf('DIVISA') : 10;
  const remesaIdx = headers.indexOf('REMESA') >= 0 ? headers.indexOf('REMESA') : 12;

  const movements: ParsedBankFileResult['movements'] = [];
  const rejectedRows: ParsedBankFileResult['rejectedRows'] = [];

  for (let rIdx = headerRowIndex + 1; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    if (!row || row.length === 0) continue;

    if (isStructuralRow(row, dateIdx)) continue;

    const rawDate = row[dateIdx];
    const bookingDate = parseSpanishDate(rawDate, context);
    if (!bookingDate) {
      rejectRow(rejectedRows, rIdx + 1, 'BBVA_ACCOUNT', 'INVALID_DATE');
      continue;
    }

    const rawValueDate = row[valueDateIdx];
    const valueDate = hasCell(rawValueDate) ? parseSpanishDate(rawValueDate, context) : null;
    if (hasCell(rawValueDate) && !valueDate) {
      rejectRow(rejectedRows, rIdx + 1, 'BBVA_ACCOUNT', 'INVALID_VALUE_DATE');
      continue;
    }

    const rawAmount = row[amountIdx];
    let amount: number;
    try {
      amount = parseSpanishMoney(rawAmount);
    } catch {
      rejectRow(rejectedRows, rIdx + 1, 'BBVA_ACCOUNT', 'INVALID_AMOUNT');
      continue;
    }

    const rawBalance = row[balanceIdx];
    let runningBalance: number | null = null;
    if (rawBalance !== undefined && rawBalance !== null && String(rawBalance).trim() !== '') {
      try {
        runningBalance = parseSpanishMoney(rawBalance);
      } catch {
        rejectRow(rejectedRows, rIdx + 1, 'BBVA_ACCOUNT', 'INVALID_BALANCE');
        continue;
      }
    }

    const concept = String(row[conceptIdx] || '').trim();
    const beneficiary = String(row[benIdx] || '').trim();
    const obs = String(row[obsIdx] || '').trim();
    const remesa = String(row[remesaIdx] || '').trim();
    const currency = String(row[currencyIdx] || 'EUR').trim().toUpperCase() || 'EUR';

    const fullDescription = [concept, beneficiary, obs].filter(Boolean).join(' · ').trim() || 'Movimiento bancario';
    const direction: MovementDirection = amount >= 0 ? 'CREDIT' : 'DEBIT';

    // Bank native ID from remesa if available and not just "-"
    const bankNativeId = null; // Remittance references are not proven transaction identities.

    movements.push({
      sourceRowNumber: rIdx + 1,
      bookingDate,
      valueDate,
      description: fullDescription,
      amount,
      currency,
      direction,
      runningBalance,
      bankNativeId,
      externalReference: remesa && remesa !== '-' ? remesa : null,
      minimizedProvenance: {
        sourceRowNumber: rIdx + 1,
        rawConcept: concept || undefined,
        beneficiary: beneficiary || undefined,
        observations: obs || undefined,
        bankNativeId: bankNativeId || undefined,
      }
    });
  }

  return {
    fileName,
    fileHash,
    detectedFormat: 'BBVA_ACCOUNT',
    detectedAccountMeta: detection.metadata,
    periodStart: context.periodStart || null,
    periodEnd: context.periodEnd || null,
    totalRawRows: rows.length,
    movements,
    rejectedRows
  };
}
