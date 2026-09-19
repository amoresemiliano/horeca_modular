/**
 * HORECA Modular — Date Normalization Utilities (WP-FIN-001)
 * Handles Spanish banking date formats (DD/MM/YYYY, YYYY-MM-DD, DD/MM with context),
 * statement header year extraction, and year-boundary resolution.
 */

export function parseSpanishDate(
  val: unknown,
  statementContext?: { contextYear?: number; statementMonth?: number }
): string | null {
  if (!val) return null;
  const str = String(val).trim();
  if (!str) return null;

  // 1. ISO format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // 2. Full date format: DD/MM/YYYY or DD-MM-YYYY
  const matchFull = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (matchFull) {
    const [, d, m, y] = matchFull;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // 3. Short date format: DD/MM or DD-MM (e.g. Sabadell Card "23/07")
  const matchShort = str.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (matchShort) {
    const [, d, m] = matchShort;
    const movementMonth = parseInt(m, 10);
    const movementDay = parseInt(d, 10);

    let year = statementContext?.contextYear || new Date().getFullYear();

    // Year-boundary resolution:
    // If the statement is from early in the year (e.g. January/February)
    // but the transaction month is November/December (11 or 12), the movement belongs to the previous year.
    if (statementContext?.statementMonth !== undefined) {
      const stmtMonth = statementContext.statementMonth;
      if (stmtMonth <= 2 && movementMonth >= 11) {
        year = year - 1;
      } else if (stmtMonth >= 11 && movementMonth <= 2) {
        // Conversely, statement at end of year referring to next billing cycle
        year = year + 1;
      }
    }

    return `${year}-${String(movementMonth).padStart(2, '0')}-${String(movementDay).padStart(2, '0')}`;
  }

  // 4. Excel serial date number check
  if (typeof val === 'number' && val > 30000 && val < 60000) {
    const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(dateObj.getTime())) {
      const y = dateObj.getUTCFullYear();
      const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  return null;
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
  contextYear: number;
  statementMonth?: number;
  periodStart?: string;
  periodEnd?: string;
} {
  const currentYear = new Date().getFullYear();
  let foundYear = currentYear;
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
      periodStart = parseSpanishDate(periodRangeMatch[1]) || undefined;
      periodEnd = parseSpanishDate(periodRangeMatch[2]) || undefined;
      if (periodEnd) {
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
    if (dateMatch && !foundMonth) {
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
