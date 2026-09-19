import { describe, it, expect } from 'vitest';
import { ProductLineParser } from '../../../src/domain/sales/services/ProductLineParser';

describe('ProductLineParser Unit Tests', () => {
  it('parses single product lines without modifiers', () => {
    const raw = '1x CERVEZAS - Amstel Tostada 0.0';
    const lines = ProductLineParser.parse(raw);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({
      lineIndex: 0,
      depth: 0,
      parentLineIndex: null,
      rawText: '1x CERVEZAS - Amstel Tostada 0.0',
      displayText: 'CERVEZAS - Amstel Tostada 0.0',
      quantity: 1,
      itemType: 'PRODUCT',
      notes: null,
    });
  });

  it('parses multiple products on separate lines', () => {
    const raw = `1x TACOS - Carnitas
1x TACOS - Cochinita Pibil
2x TACOS - Tinga de Pollo`;
    const lines = ProductLineParser.parse(raw);

    expect(lines).toHaveLength(3);
    expect(lines[0].displayText).toBe('TACOS - Carnitas');
    expect(lines[0].quantity).toBe(1);
    expect(lines[1].displayText).toBe('TACOS - Cochinita Pibil');
    expect(lines[1].quantity).toBe(1);
    expect(lines[2].displayText).toBe('TACOS - Tinga de Pollo');
    expect(lines[2].quantity).toBe(2);
  });

  it('parses tab-indented and space-indented modifiers and links them to parent products', () => {
    const raw = `1x Perrón
\t1x SALSA - Guacamole
\t1x TACOS - Carnitas
1x Jarritos 370ml
\t1x Mandarina`;
    const lines = ProductLineParser.parse(raw);

    expect(lines).toHaveLength(5);

    // Line 0: Parent Perrón
    expect(lines[0].displayText).toBe('Perrón');
    expect(lines[0].depth).toBe(0);
    expect(lines[0].itemType).toBe('PRODUCT');
    expect(lines[0].parentLineIndex).toBeNull();

    // Line 1: Modifier under Perrón
    expect(lines[1].displayText).toBe('SALSA - Guacamole');
    expect(lines[1].depth).toBe(1);
    expect(lines[1].itemType).toBe('MODIFIER');
    expect(lines[1].parentLineIndex).toBe(0);

    // Line 2: Modifier under Perrón
    expect(lines[2].displayText).toBe('TACOS - Carnitas');
    expect(lines[2].depth).toBe(1);
    expect(lines[2].itemType).toBe('MODIFIER');
    expect(lines[2].parentLineIndex).toBe(0);

    // Line 3: Parent Jarritos
    expect(lines[3].displayText).toBe('Jarritos 370ml');
    expect(lines[3].depth).toBe(0);
    expect(lines[3].itemType).toBe('PRODUCT');
    expect(lines[3].parentLineIndex).toBeNull();

    // Line 4: Modifier under Jarritos
    expect(lines[4].displayText).toBe('Mandarina');
    expect(lines[4].depth).toBe(1);
    expect(lines[4].itemType).toBe('MODIFIER');
    expect(lines[4].parentLineIndex).toBe(3);
  });

  it('preserves exact rawText with whitespace and handles empty lines safely', () => {
    const raw = `
1x Costra de Birria + Caldo

\t1x Salsa Picante
`;
    const lines = ProductLineParser.parse(raw);
    expect(lines).toHaveLength(2);
    expect(lines[0].rawText).toBe('1x Costra de Birria + Caldo');
    expect(lines[1].rawText).toBe('\t1x Salsa Picante');
  });

  it('handles lines without quantity prefix gracefully (defaults quantity to 1)', () => {
    const raw = `Para Llevar
\tCebolla y cilantro`;
    const lines = ProductLineParser.parse(raw);
    expect(lines).toHaveLength(2);
    expect(lines[0].quantity).toBe(1);
    expect(lines[0].displayText).toBe('Para Llevar');
    expect(lines[1].quantity).toBe(1);
    expect(lines[1].displayText).toBe('Cebolla y cilantro');
    expect(lines[1].itemType).toBe('MODIFIER');
  });

  it('returns empty array for null/empty/whitespace inputs', () => {
    expect(ProductLineParser.parse(null)).toEqual([]);
    expect(ProductLineParser.parse('')).toEqual([]);
    expect(ProductLineParser.parse('   \n  ')).toEqual([]);
  });
});
