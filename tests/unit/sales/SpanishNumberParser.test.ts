import { describe, it, expect } from 'vitest';
import { SpanishNumberParser } from '../../../src/domain/sales/services/SpanishNumberParser';

describe('SpanishNumberParser Unit Tests', () => {
  it('parses Spanish thousands and decimal separators correctly (1.303,55 => 1303.55)', () => {
    expect(SpanishNumberParser.parse('1.303,55')).toBe(1303.55);
    expect(SpanishNumberParser.parse('14.980,70')).toBe(14980.70);
    expect(SpanishNumberParser.parse('1.000.000,50')).toBe(1000000.50);
  });

  it('parses comma-only decimal values (25,00 => 25.00, 0,50 => 0.50, 1303,55 => 1303.55)', () => {
    expect(SpanishNumberParser.parse('25,00')).toBe(25.00);
    expect(SpanishNumberParser.parse('0,50')).toBe(0.50);
    expect(SpanishNumberParser.parse('1303,55')).toBe(1303.55);
    expect(SpanishNumberParser.parse('3,2')).toBe(3.20);
  });

  it('parses standard dot-decimal values without thousands dots (12.5 => 12.50, 1541.45 => 1541.45)', () => {
    expect(SpanishNumberParser.parse('12.5')).toBe(12.50);
    expect(SpanishNumberParser.parse('1541.45')).toBe(1541.45);
    expect(SpanishNumberParser.parse('0')).toBe(0.00);
  });

  it('safely strips currency symbols and EUR noise', () => {
    expect(SpanishNumberParser.parse('1.303,55 €')).toBe(1303.55);
    expect(SpanishNumberParser.parse(' 14.980,70 EUR ')).toBe(14980.70);
    expect(SpanishNumberParser.parse('$25,00')).toBe(25.00);
  });

  it('handles null, undefined, empty, or invalid strings safely', () => {
    expect(SpanishNumberParser.parse(null)).toBeNull();
    expect(SpanishNumberParser.parse(undefined)).toBeNull();
    expect(SpanishNumberParser.parse('')).toBeNull();
    expect(SpanishNumberParser.parse('   ')).toBeNull();
    expect(SpanishNumberParser.parse('invalid_number')).toBeNull();
    expect(SpanishNumberParser.parse('NaN')).toBeNull();
  });

  it('parseOrThrow throws controlled errors on invalid inputs', () => {
    expect(() => SpanishNumberParser.parseOrThrow('invalid', 'Total')).toThrowError(
      /Invalid monetary or numeric value for field 'Total'/
    );
    expect(SpanishNumberParser.parseOrThrow('14.980,70', 'Total')).toBe(14980.70);
  });
});
