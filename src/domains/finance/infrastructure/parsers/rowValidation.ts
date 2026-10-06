import { BankFormatFamily, RejectedBankRow } from '../../domain/types';

const reasons: Record<RejectedBankRow['code'], string> = {
  INVALID_AMOUNT: 'Missing or invalid transaction amount.',
  INVALID_DATE: 'Invalid booking date or unresolved statement year.',
  INVALID_VALUE_DATE: 'Invalid value date.',
  INVALID_BALANCE: 'Invalid running balance.',
};

export function rejectRow(
  rows: RejectedBankRow[], sourceRowNumber: number,
  sourceFormat: BankFormatFamily, code: RejectedBankRow['code'],
): void {
  rows.push({ sourceRowNumber, sourceFormat, code, reason: reasons[code] });
}

export const hasCell = (value: unknown): boolean => value !== null && value !== undefined && String(value).trim() !== '';

/** Ignore blank rows and explicit statement totals, never malformed transaction rows. */
export function isStructuralRow(row: unknown[], dateIndex: number): boolean {
  if (!row.some(hasCell)) return true;
  const first = row.find(hasCell);
  return /^(?:TOTAL(?:\s|$)|SALDO (?:ANTERIOR|INICIAL|FINAL))/i.test(String(first)) && !/^\d/.test(String(row[dateIndex] ?? ''));
}
