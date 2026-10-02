import { describe, expect, it } from 'vitest';
import { parseSpanishMoney, moneyToDecimal } from '../../src/domains/finance/domain/money';
import { parseSpanishDate } from '../../src/domains/finance/domain/dates';
import { parseBbvaAccount, parseBbvaCard, parseSabadellAccount, parseSabadellCard } from '../../src/domains/finance/infrastructure/parsers';
import { BankFormatFamily } from '../../src/domains/finance/domain/types';

describe('Strict source validation', () => {
  it.each(['12.34.56,78', '1,2,3', '1.000,001', '1 2,00', 'NaN', 'Infinity', '', ' ', null, undefined, NaN, Infinity, 1.001])('rejects malformed money %j', value => {
    expect(() => parseSpanishMoney(value)).toThrow();
  });
  it.each(['1.303,55', '+1.303,55', '1303,55', 1303.55])('normalizes exact decimal %j', value => {
    expect(moneyToDecimal(parseSpanishMoney(value))).toBe('1303.55');
  });
  it('preserves signed zero as exact zero', () => {
    expect(moneyToDecimal(parseSpanishMoney('-0,00'))).toBe('0.00');
  });
  it.each(['2026-02-30', '31/04/2026', '01/01/2026 garbage', '00/01/2026', '23/07'])('rejects invalid or unresolved date %s', date => {
    expect(parseSpanishDate(date)).toBeNull();
  });

  const scenarios = [
    { family: 'BBVA_ACCOUNT', parser: parseBbvaAccount, header: ['F. CONTABLE', 'F. VALOR', 'CONCEPTO', 'IMPORTE', 'SALDO'], row: ['01/01/2026', '', 'HORECA_TEST', '0,00', '10,00'], amount: 3 },
    { family: 'BBVA_CARD', parser: parseBbvaCard, header: ['FECHA DE OPERACIÓN', 'CONCEPTO', 'TIPO DE MOVIMIENTO', 'IMPORTE', 'DIVISA'], row: ['01/01/2026', 'HORECA_TEST', 'COMPRA', '0,00', 'EUR'], amount: 3 },
    { family: 'SABADELL_ACCOUNT', parser: parseSabadellAccount, header: ['F. OPERATIVA', 'CONCEPTO', 'F. VALOR', 'IMPORTE', 'SALDO'], row: ['01/01/2026', 'HORECA_TEST', '', '0,00', '10,00'], amount: 3 },
    { family: 'SABADELL_CARD', parser: parseSabadellCard, header: ['FECHA', 'CONCEPTO', 'LOCALIDAD', 'IMPORTE', 'DIVISA'], row: ['01/01/2026', 'HORECA_TEST', 'TEST', '0,00', 'EUR'], amount: 3 },
  ];
  for (const scenario of scenarios) {
    it(`${scenario.family} separates accepted, rejected and blank rows with minimal provenance`, () => {
      const missing = [...scenario.row]; missing[scenario.amount] = '';
      const malformed = [...scenario.row]; malformed[scenario.amount] = 'PRIVATE_BANK_TEXT';
      const unresolved = [...scenario.row]; unresolved[0] = '28/12';
      const result = scenario.parser([scenario.header, scenario.row, [], missing, malformed, unresolved], 'test.xls', 'test-hash', {
        formatFamily: scenario.family as BankFormatFamily, metadata: {}, confidence: 100, detectionMarkers: [],
      });
      expect(result.movements).toHaveLength(1);
      expect(result.movements[0].amount).toBe(0);
      expect(result.movements[0].valueDate).toBeNull();
      expect(result.rejectedRows.map(r => [r.sourceRowNumber, r.code])).toEqual([[4, 'INVALID_AMOUNT'], [5, 'INVALID_AMOUNT'], [6, 'INVALID_DATE']]);
      expect(JSON.stringify(result.rejectedRows)).not.toContain('PRIVATE_BANK_TEXT');
    });
  }
  it('resolves a December card transaction from a January document, including numeric refunds', () => {
    const result = parseSabadellCard([
      ['Total operaciones pendientes 01/2026'],
      ['FECHA', 'CONCEPTO', 'LOCALIDAD', 'IMPORTE', 'DIVISA'],
      ['28/12', 'HORECA_TEST refund', '', -10.25, 'EUR'],
    ], 'test.xls', 'hash', { formatFamily: 'SABADELL_CARD', metadata: {}, confidence: 100, detectionMarkers: [] });
    expect(result.movements[0]).toMatchObject({ bookingDate: '2025-12-28', amount: 10.25, valueDate: null });
  });
});
