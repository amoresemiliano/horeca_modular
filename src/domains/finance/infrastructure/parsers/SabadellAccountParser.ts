import { hasCell, isStructuralRow, rejectRow } from './rowValidation';
/**
 * HORECA Modular — Banco Sabadell Current Account Parser (WP-FIN-001)
 * Parses Sabadell current account extracts, mapping operative date, value date,
 * concept, signed amounts, running balances, and native bank reference numbers.
 */

import { ParsedBankFileResult, MovementDirection } from '../../domain/types';
import { parseSpanishMoney } from '../../domain/money';
import { parseSpanishDate, extractStatementContextFromHeaders } from '../../domain/dates';
import { DetectionResult } from './BankFormatDetector';

export function parseSabadellAccount(
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
    if (rowStr.includes('F. OPERATIVA') && rowStr.includes('IMPORTE')) {
      headerRowIndex = i;
      headers = row.map(c => String(c || '').toUpperCase().trim());
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('No se encontró la fila de cabecera estándar de cuenta Sabadell (F. Operativa, Importe).');
  }

  const opDateIdx = headers.indexOf('F. OPERATIVA') >= 0 ? headers.indexOf('F. OPERATIVA') : 0;
  const conceptIdx = headers.indexOf('CONCEPTO') >= 0 ? headers.indexOf('CONCEPTO') : 1;
  const valDateIdx = headers.indexOf('F. VALOR') >= 0 ? headers.indexOf('F. VALOR') : 2;
  const amountIdx = headers.indexOf('IMPORTE') >= 0 ? headers.indexOf('IMPORTE') : 3;
  const balanceIdx = headers.indexOf('SALDO') >= 0 ? headers.indexOf('SALDO') : 4;
  const ref1Idx = headers.indexOf('REFERENCIA 1') >= 0 ? headers.indexOf('REFERENCIA 1') : 5;
  const ref2Idx = headers.indexOf('REFERENCIA 2') >= 0 ? headers.indexOf('REFERENCIA 2') : 6;

  const movements: ParsedBankFileResult['movements'] = [];
  const rejectedRows: ParsedBankFileResult['rejectedRows'] = [];

  for (let rIdx = headerRowIndex + 1; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    if (!row || row.length === 0) continue;

    if (isStructuralRow(row, opDateIdx)) continue;

    const rawOpDate = row[opDateIdx];
    const bookingDate = parseSpanishDate(rawOpDate, context);
    if (!bookingDate) {
      rejectRow(rejectedRows, rIdx + 1, 'SABADELL_ACCOUNT', 'INVALID_DATE');
      continue;
    }

    const rawValDate = row[valDateIdx];
    const valueDate = hasCell(rawValDate) ? parseSpanishDate(rawValDate, context) : null;
    if (hasCell(rawValDate) && !valueDate) {
      rejectRow(rejectedRows, rIdx + 1, 'SABADELL_ACCOUNT', 'INVALID_VALUE_DATE');
      continue;
    }

    const rawAmount = row[amountIdx];
    let amount: number;
    try {
      amount = parseSpanishMoney(rawAmount);
    } catch {
      rejectRow(rejectedRows, rIdx + 1, 'SABADELL_ACCOUNT', 'INVALID_AMOUNT');
      continue;
    }

    const rawBalance = row[balanceIdx];
    let runningBalance: number | null = null;
    if (rawBalance !== undefined && rawBalance !== null && String(rawBalance).trim() !== '') {
      try {
        runningBalance = parseSpanishMoney(rawBalance);
      } catch {
        rejectRow(rejectedRows, rIdx + 1, 'SABADELL_ACCOUNT', 'INVALID_BALANCE');
        continue;
      }
    }

    const concept = String(row[conceptIdx] || '').trim() || 'Movimiento Bancario';
    const ref1 = String(row[ref1Idx] || '').trim();
    const ref2 = String(row[ref2Idx] || '').trim();

    // Combine stable bank native references
    const bankNativeRefs = [ref1, ref2].filter(r => r && r !== 'null' && r !== 'undefined');
    const bankNativeId = null; // References are not proven unique transaction identifiers.
    const externalReference = bankNativeRefs.length > 0 ? bankNativeRefs.join('-') : null;

    const direction: MovementDirection = amount >= 0 ? 'CREDIT' : 'DEBIT';

    movements.push({
      sourceRowNumber: rIdx + 1,
      bookingDate,
      valueDate,
      description: concept,
      amount,
      currency: 'EUR',
      direction,
      runningBalance,
      bankNativeId,
      externalReference,
      minimizedProvenance: {
        sourceRowNumber: rIdx + 1,
        rawConcept: concept,
        reference1: ref1 || undefined,
        reference2: ref2 || undefined,
        bankNativeId: bankNativeId || undefined,
      }
    });
  }

  return {
    fileName,
    fileHash,
    detectedFormat: 'SABADELL_ACCOUNT',
    detectedAccountMeta: detection.metadata,
    periodStart: context.periodStart || null,
    periodEnd: context.periodEnd || null,
    totalRawRows: rows.length,
    movements,
    rejectedRows
  };
}
