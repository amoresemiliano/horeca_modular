/**
 * HORECA Modular — Date Normalization Utilities (WP-FIN-001)
 * Handles Spanish banking date formats (DD/MM/YYYY, YYYY-MM-DD, DD/MM with context),
 * statement header year extraction, and year-boundary resolution.
 *
 * Invariant: Short dates (DD/MM) require documentary year context and never fall back to runtime current year.
 */

export class UnresolvedDateYearError extends Error {
  public readonly isUnresolvedDateYearError = true;
  constructor(message: string, public readonly rawDate: string) {
    super(message);
    this.name = 'UnresolvedDateYearError';
  }
}

function validDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseSpanishDate(
  val: unknown,
  context?: { contextYear?: number; statementMonth?: number }
): string | null {
  if (typeof val === 'number') {
    if (!Number.isInteger(val) || val < 1 || val > 2958465) return null;
    const date = new Date((val - 25569) * 86400000);
    return validDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  if (typeof val !== 'string') return null;
  const text = val.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const full = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  if (full) return validDate(Number(full[3]), Number(full[2]), Number(full[1]));
  const short = /^(\d{1,2})[/-](\d{1,2})$/.exec(text);
  if (!short || !context?.contextYear) return null;
  let year = context.contextYear;
  const month = Number(short[2]);
  if (context.statementMonth !== undefined) {
    if (context.statementMonth < 1 || context.statementMonth > 12) return null;
    // Statement/export context is the closing date; never manufacture a future year.
    if (context.statementMonth <= 2 && month >= 11) year--;
  }
  return validDate(year, month, Number(short[1]));
}

/**
 * Extracts context year and statement month from bank statement headers.
 * Example patterns:
 * - "Total operaciones pendientes 08/2026" -> year: 2026, month: 8
 * - "Periodo 04/05/2026-07/08/2026" -> year: 2026, month: 8
 * - "Julio 2026" -> year: 2026, month: 7
 * - "01/08/2026" -> year: 2026, month: 8
 */
export function extractStatementContextFromHeaders(rows: Array<any[]>): {
  contextYear?: number;
  statementMonth?: number;
  periodStart?: string;
  periodEnd?: string;
} {
  let foundYear: number | undefined = undefined;
  let foundMonth: number | undefined = undefined;
  let periodStart: string | undefined = undefined;
  let periodEnd: string | undefined = undefined;

  for (const row of rows) {
    if (!row) continue;
    const rowStr = row.map(c => String(c || '')).join(' ');

    // Match "Total operaciones pendientes MM/YYYY"
    const pendingMatch = rowStr.match(/pendientes\s+(\d{1,2})\/(\d{4})/i);
    if (pendingMatch) {
      foundMonth = parseInt(pendingMatch[1], 10);
      foundYear = parseInt(pendingMatch[2], 10);
      break;
    }

    // Match period range "DD/MM/YYYY-DD/MM/YYYY"
    const periodRangeMatch = rowStr.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (periodRangeMatch) {
      const pStart = parseSpanishDate(periodRangeMatch[1]);
      const pEnd = parseSpanishDate(periodRangeMatch[2]);
      if (pStart) periodStart = pStart;
      if (pEnd) {
        periodEnd = pEnd;
        const parts = periodEnd.split('-');
        foundYear = parseInt(parts[0], 10);
        foundMonth = parseInt(parts[1], 10);
      }
      break;
    }

    // Match month name and year e.g. "Julio 2026"
    const monthNames: Record<string, number> = {
      ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6,
      JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12
    };
    for (const [name, mNum] of Object.entries(monthNames)) {
      const regex = new RegExp(`${name}\\s+(\\d{4})`, 'i');
      const match = rowStr.match(regex);
      if (match) {
        foundMonth = mNum;
        foundYear = parseInt(match[1], 10);
        break;
      }
    }

    // Match standard header date e.g. "01/08/2026"
    const dateMatch = rowStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dateMatch && !foundMonth && /fecha.*(?:extracto|export|consulta)|emitido|statement|export/i.test(rowStr)) {
      foundMonth = parseInt(dateMatch[2], 10);
      foundYear = parseInt(dateMatch[3], 10);
    }
  }

  return {
    contextYear: foundYear,
    statementMonth: foundMonth,
    periodStart,
    periodEnd
  };
}
