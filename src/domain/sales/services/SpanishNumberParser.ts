/**
 * Spanish/European localized number and monetary parser.
 * Invariant: Never use naive parseFloat directly on localized strings.
 * Examples:
 *   1.303,55 => 1303.55
 *   14.980,70 => 14980.70
 *   25,00 => 25.00
 *   0,50 => 0.50
 *   1303,55 => 1303.55
 *   12.5 => 12.50
 *   3.2 => 3.20
 */
export class SpanishNumberParser {
  public static parse(input: string | number | null | undefined): number | null {
    if (input === null || input === undefined) {
      return null;
    }

    if (typeof input === 'number') {
      if (isNaN(input) || !isFinite(input)) return null;
      return Math.round(input * 100) / 100;
    }

    let raw = String(input).trim();
    if (!raw) {
      return null;
    }

    // Strip currency symbols and letters (e.g. '€', 'EUR', whitespace)
    raw = raw.replace(/[€$£]/g, '').replace(/\bEUR\b/gi, '').trim();

    if (!raw) {
      return null;
    }

    // Check for standard European format with thousands separator dot and decimal comma: '1.303,55' or '14.980,70'
    if (raw.includes('.') && raw.includes(',')) {
      // Dots are thousands separators, comma is decimal separator
      raw = raw.replace(/\./g, '').replace(',', '.');
    } else if (raw.includes(',')) {
      // Only comma present, e.g. '1303,55' or '25,00' or '0,50'
      raw = raw.replace(',', '.');
    }
    // If only dot is present (e.g. standard ISO '12.5' or '1303.55'), keep as is

    const parsed = Number(raw);
    if (isNaN(parsed) || !isFinite(parsed)) {
      return null;
    }

    return Math.round(parsed * 100) / 100;
  }

  public static parseOrThrow(input: string | number | null | undefined, fieldName = 'number'): number {
    const val = SpanishNumberParser.parse(input);
    if (val === null) {
      throw new Error(`Invalid monetary or numeric value for field '${fieldName}': "${input}"`);
    }
    return val;
  }
}
