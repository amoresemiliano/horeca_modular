/**
 * HORECA Modular — Finance Parsers & Normalization Unit Tests (WP-FIN-001)
 * Tests detection, parsing, normalization, Spanish numbers/dates, and fingerprint determinism.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseSpanishMoney } from '../../src/domains/finance/domain/money';
import { 
  parseSpanishDate, 
  extractStatementContextFromHeaders 
} from '../../src/domains/finance/domain/dates';
import { generateMovementFingerprint } from '../../src/domains/finance/domain/fingerprint';
import { 
  detectBankSourceFormat, 
  FormatDetectionError 
} from '../../src/domains/finance/infrastructure/parsers/BankFormatDetector';
import { parseBankStatementBuffer } from '../../src/domains/finance/infrastructure/parsers';

const fixturesDir = path.resolve(__dirname, '../fixtures/finance');

describe('Finance Domain — Spanish / European Monetary Parsing', () => {
  it('parses standard Spanish numbers with dot thousands and comma decimals', () => {
    expect(parseSpanishMoney('1.303,55')).toBe(1303.55);
    expect(parseSpanishMoney('-1.303,55')).toBe(-1303.55);
    expect(parseSpanishMoney('1303,55')).toBe(1303.55);
    expect(parseSpanishMoney('0,00')).toBe(0);
    expect(parseSpanishMoney('-0,00')).toBe(0);
  });

  it('handles currency symbols and whitespace', () => {
    expect(parseSpanishMoney('-2.769,29 €')).toBe(-2769.29);
    expect(parseSpanishMoney('2.769,29 EUR')).toBe(2769.29);
    expect(parseSpanishMoney(' -39,95 ')).toBe(-39.95);
  });

  it('handles numbers directly and trailing negative signs', () => {
    expect(parseSpanishMoney(1303.55)).toBe(1303.55);
    expect(parseSpanishMoney(-1303.55)).toBe(-1303.55);
    expect(parseSpanishMoney('1.303,55-')).toBe(-1303.55);
  });

  it('handles null, undefined, blank and malformed values safely without crashing', () => {
    expect(parseSpanishMoney(null)).toBe(0);
    expect(parseSpanishMoney(undefined)).toBe(0);
    expect(parseSpanishMoney('')).toBe(0);
    expect(parseSpanishMoney('invalid_amount')).toBe(0);
  });
});

describe('Finance Domain — Date Normalization & Year-Boundary Resolution', () => {
  it('normalizes full Spanish dates (DD/MM/YYYY and YYYY-MM-DD)', () => {
    expect(parseSpanishDate('31/07/2026')).toBe('2026-07-31');
    expect(parseSpanishDate('01/08/2026')).toBe('2026-08-01');
    expect(parseSpanishDate('2026-07-30')).toBe('2026-07-30');
  });

  it('reconstructs short dates (DD/MM) from statement header context', () => {
    const context = { contextYear: 2026, statementMonth: 8 };
    expect(parseSpanishDate('23/07', context)).toBe('2026-07-23');
    expect(parseSpanishDate('02/08', context)).toBe('2026-08-02');
  });

  it('correctly resolves year-boundary cases (e.g. December transaction in January statement)', () => {
    // Statement context: January 2026
    const januaryContext = { contextYear: 2026, statementMonth: 1 };
    // December movement -> belongs to 2025
    expect(parseSpanishDate('28/12', januaryContext)).toBe('2025-12-28');
    // January movement -> belongs to 2026
    expect(parseSpanishDate('05/01', januaryContext)).toBe('2026-01-05');
  });

  it('extracts statement context from metadata rows', () => {
    const sampleRows = [
      ['Saldos y movimientos'],
      ['Total operaciones pendientes 08/2026:', null, '63,11 EUR']
    ];
    const ctx = extractStatementContextFromHeaders(sampleRows);
    expect(ctx.contextYear).toBe(2026);
    expect(ctx.statementMonth).toBe(8);
  });
});

describe('Finance Domain — Deterministic Fingerprint Generation', () => {
  it('generates deterministic identical fingerprint strings for identical inputs', async () => {
    const inputA = {
      bankAccountId: 'acc-123',
      bookingDate: '2026-07-31',
      valueDate: '2026-07-31',
      amount: -2769.29,
      normalizedDescription: 'CUOTAS DE LA SEGURIDAD SOCIAL · TGSS',
      runningBalance: 32670.98,
      bankNativeId: 'ES0182140000070415824104'
    };

    const inputB = {
      bankAccountId: 'acc-123',
      bookingDate: '2026-07-31',
      valueDate: '2026-07-31',
      amount: -2769.29,
      normalizedDescription: '  CUOTAS DE LA SEGURIDAD SOCIAL · TGSS  ',
      runningBalance: 32670.98,
      bankNativeId: 'ES0182140000070415824104'
    };

    const fpA = await generateMovementFingerprint(inputA);
    const fpB = await generateMovementFingerprint(inputB);

    expect(fpA).toBe(fpB);
    expect(fpA.length).toBe(64);
  });

  it('generates distinct fingerprints when accounts, dates or amounts differ', async () => {
    const base = {
      bankAccountId: 'acc-1',
      bookingDate: '2026-07-31',
      amount: -100,
      normalizedDescription: 'RESTAURANTE EL CRIOLLO'
    };

    const fp1 = await generateMovementFingerprint({ ...base, bankAccountId: 'acc-1' });
    const fp2 = await generateMovementFingerprint({ ...base, bankAccountId: 'acc-2' });
    const fp3 = await generateMovementFingerprint({ ...base, amount: -200 });

    expect(fp1).not.toBe(fp2);
    expect(fp1).not.toBe(fp3);
  });
});

describe('Finance Infrastructure — Source Format Detection & 5 Fixtures', () => {
  it('fails honestly when file structure is unknown or empty', () => {
    expect(() => detectBankSourceFormat([])).toThrow(FormatDetectionError);
    expect(() => detectBankSourceFormat([['Header 1', 'Header 2', 'Header 3'], ['Foo', 'Bar', 'Baz']])).toThrow(FormatDetectionError);
  });

  // 1. BBVA Account A Fixture
  it('parses BBVA Account A sanitized fixture correctly', async () => {
    const fileBuf = fs.readFileSync(path.join(fixturesDir, 'bbva_account_a_sanitized.xls'));
    const { parsedResult, detection } = await parseBankStatementBuffer(fileBuf.buffer, 'bbva_account_a_sanitized.xls');

    expect(detection.formatFamily).toBe('BBVA_ACCOUNT');
    expect(parsedResult.detectedFormat).toBe('BBVA_ACCOUNT');
    expect(parsedResult.movements.length).toBe(149);
    expect(parsedResult.fileHash.length).toBe(64);

    const firstMov = parsedResult.movements[0];
    expect(firstMov.bookingDate).toBe('2026-08-03');
    expect(firstMov.amount).toBe(-600.00);
    expect(firstMov.direction).toBe('DEBIT');
    expect(firstMov.runningBalance).toBe(32070.98);
  });

  // 2. BBVA Account B Fixture
  it('parses BBVA Account B sanitized fixture correctly with distinct account metadata', async () => {
    const fileBuf = fs.readFileSync(path.join(fixturesDir, 'bbva_account_b_sanitized.xls'));
    const { parsedResult, detection } = await parseBankStatementBuffer(fileBuf.buffer, 'bbva_account_b_sanitized.xls');

    expect(detection.formatFamily).toBe('BBVA_ACCOUNT');
    expect(parsedResult.detectedFormat).toBe('BBVA_ACCOUNT');
    expect(parsedResult.movements.length).toBe(234);

    const firstMov = parsedResult.movements[0];
    expect(firstMov.bookingDate).toBe('2026-08-03');
    expect(firstMov.amount).toBe(993.97);
    expect(firstMov.direction).toBe('CREDIT');
  });

  // 3. BBVA Card Fixture
  it('parses BBVA Card sanitized fixture and preserves signed settlement amounts', async () => {
    const fileBuf = fs.readFileSync(path.join(fixturesDir, 'bbva_card_sanitized.xls'));
    const { parsedResult, detection } = await parseBankStatementBuffer(fileBuf.buffer, 'bbva_card_sanitized.xls');

    expect(detection.formatFamily).toBe('BBVA_CARD');
    expect(parsedResult.detectedFormat).toBe('BBVA_CARD');
    expect(parsedResult.movements.length).toBe(84);

    // Verify negative purchases
    const purchaseMov = parsedResult.movements[0];
    expect(purchaseMov.bookingDate).toBe('2026-07-30');
    expect(purchaseMov.amount).toBe(-39.95);
    expect(purchaseMov.direction).toBe('DEBIT');
    expect(purchaseMov.valueDate).toBeNull(); // Not manufactured
  });

  // 4. Sabadell Account Fixture
  it('parses Sabadell Account sanitized fixture with bank native references', async () => {
    const fileBuf = fs.readFileSync(path.join(fixturesDir, 'sabadell_account_sanitized.xls'));
    const { parsedResult, detection } = await parseBankStatementBuffer(fileBuf.buffer, 'sabadell_account_sanitized.xls');

    expect(detection.formatFamily).toBe('SABADELL_ACCOUNT');
    expect(parsedResult.detectedFormat).toBe('SABADELL_ACCOUNT');
    expect(parsedResult.movements.length).toBe(2);

    const cardSettlement = parsedResult.movements[0];
    expect(cardSettlement.bookingDate).toBe('2026-07-16');
    expect(cardSettlement.amount).toBe(-240.56);
    expect(cardSettlement.direction).toBe('DEBIT');
    expect(cardSettlement.bankNativeId).toBe('281102975493-5566711029754014');
  });

  // 5. Sabadell Card Fixture
  it('parses Sabadell Card sanitized fixture with short date and year reconstruction', async () => {
    const fileBuf = fs.readFileSync(path.join(fixturesDir, 'sabadell_card_sanitized.xls'));
    const { parsedResult, detection } = await parseBankStatementBuffer(fileBuf.buffer, 'sabadell_card_sanitized.xls');

    expect(detection.formatFamily).toBe('SABADELL_CARD');
    expect(parsedResult.detectedFormat).toBe('SABADELL_CARD');
    expect(parsedResult.movements.length).toBe(7);

    const firstCardMov = parsedResult.movements[0];
    expect(firstCardMov.bookingDate).toBe('2026-07-23'); // Short date "23/07" + year 2026 from header
    expect(firstCardMov.amount).toBe(-4.98); // Signed expense
    expect(firstCardMov.direction).toBe('DEBIT');
    expect(firstCardMov.valueDate).toBeNull();
  });
});
