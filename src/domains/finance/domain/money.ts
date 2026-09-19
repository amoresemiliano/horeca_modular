/**
 * HORECA Modular — Spanish / European Monetary & Decimal Parser (WP-FIN-001)
 * Handles thousands separators (.), decimal commas (,), currency symbols, signed values,
 * and preserves exact 2-decimal precision without binary floating point artifacts.
 */

export function parseSpanishMoney(val: unknown): number {
  if (val === null || val === undefined || val === '') {
    return 0;
  }

  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return 0;
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  let str = String(val).trim();
  if (!str) return 0;

  // Remove currency symbols, NBSP, and extra whitespace
  str = str.replace(/[€$£\u00A0\s]/g, '');

  // Check for trailing negative sign e.g. "1.303,55-" or standard "-1.303,55"
  let isNegative = false;
  if (str.startsWith('-')) {
    isNegative = true;
    str = str.substring(1);
  } else if (str.endsWith('-')) {
    isNegative = true;
    str = str.substring(0, str.length - 1);
  } else if (str.startsWith('+')) {
    str = str.substring(1);
  }

  str = str.trim();

  // Determine decimal separator format:
  // Spanish standard: "1.234,56" or "1234,56"
  // Anglo standard (if present in some raw bank exports): "1,234.56" or "1234.56"
  if (str.includes('.') && str.includes(',')) {
    const dotIndex = str.indexOf('.');
    const commaIndex = str.indexOf(',');
    if (dotIndex < commaIndex) {
      // Spanish format: dot is thousands, comma is decimal: "1.234,56"
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Anglo format: comma is thousands, dot is decimal: "1,234.56"
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Only comma present: "1234,56" -> "1234.56"
    str = str.replace(',', '.');
  }

  const parsed = parseFloat(str);
  if (isNaN(parsed) || !isFinite(parsed)) {
    return 0;
  }

  const finalVal = isNegative ? -Math.abs(parsed) : Math.abs(parsed);
  return Math.round((finalVal + Number.EPSILON) * 100) / 100;
}

export function formatEuro(amount: number): string {
  return amount.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
