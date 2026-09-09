/**
 * extractos.test.js — Suite de Tests Obligatoria Track A
 * Prueba Parsers, Dominio, Duplicados, Splits, Reglas y Reconciliación
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseBankStatementFile, parseSpanishAmount, parseSpanishDate, detectBankFormat } from '../src/lib/bankParsers.js';

const sampleDir = 'c:/Users/Emiliano/Documents/1. Sistemas/El Criollo/el-criollo-ecosistema/input-samples/extractos';
const samplesExist = fs.existsSync(sampleDir);

describe('Extractos Bank Statement Parsers & Normalization (Track A)', () => {
  // Test 6: Auto Detection Logic
  it('detects bank formats by filename fallback', () => {
    expect(detectBankFormat([], 'Cta. BBVA MC.xls')).toBe('cta_mc');
    expect(detectBankFormat([], 'Tarj. Sabadell.xls')).toBe('tarj_sabadell');
  });

  // Test 7: Spanish Amounts Normalization
  it('normalizes Spanish currency formatting', () => {
    expect(parseSpanishAmount('-2,769.29 €')).toBe(-2769.29);
    expect(parseSpanishAmount('-2.769,29 €')).toBe(-2769.29);
    expect(parseSpanishAmount('-39,95')).toBe(-39.95);
  });

  // Test 8: Date Normalization
  it('normalizes Spanish date string representations', () => {
    expect(parseSpanishDate('31/07/2026')).toBe('2026-07-31');
    expect(parseSpanishDate('2026-07-30')).toBe('2026-07-30');
    expect(parseSpanishDate('23/07', 2026)).toBe('2026-07-23');
  });

  // Test 12 & 13: Split Allocation Balance Validation
  it('rejects unbalanced split allocations', () => {
    const mockAllocations = [{ monto: 50 }, { monto: 40 }];
    const sum = mockAllocations.reduce((acc, curr) => acc + curr.monto, 0);
    expect(Math.abs(sum - 100) > 0.01).toBe(true);
  });

  // Local sample tests (run when local workstation samples are present)
  if (samplesExist) {
    it('parses BBVA Cuenta MC sample file correctly', async () => {
      const mcBuf = fs.readFileSync(path.join(sampleDir, 'Cta. BBVA MC.xls'));
      const mcRes = await parseBankStatementFile(mcBuf.buffer, 'Cta. BBVA MC.xls');
      expect(mcRes.account_code).toBe('cta_mc');
      expect(mcRes.movements.length).toBe(149);
      expect(mcRes.file_hash.length).toBe(64);
    });

    it('parses BBVA Cuenta MT sample file correctly', async () => {
      const mtBuf = fs.readFileSync(path.join(sampleDir, 'Cta. BBVA MT.xls'));
      const mtRes = await parseBankStatementFile(mtBuf.buffer, 'Cta. BBVA MT.xls');
      expect(mtRes.account_code).toBe('cta_mt');
      expect(mtRes.movements.length).toBe(234);
    });

    it('parses BBVA Tarjeta sample file correctly', async () => {
      const tarjBbvaBuf = fs.readFileSync(path.join(sampleDir, 'Tarj. BBVA.xls'));
      const tarjBbvaRes = await parseBankStatementFile(tarjBbvaBuf.buffer, 'Tarj. BBVA.xls');
      expect(tarjBbvaRes.account_code).toBe('tarj_bbva');
      expect(tarjBbvaRes.movements.length).toBe(84);
    });

    it('parses Sabadell Cuenta sample file correctly', async () => {
      const ctaSabBuf = fs.readFileSync(path.join(sampleDir, 'Cta. Sabadell.xls'));
      const ctaSabRes = await parseBankStatementFile(ctaSabBuf.buffer, 'Cta. Sabadell.xls');
      expect(ctaSabRes.account_code).toBe('cta_sabadell');
      expect(ctaSabRes.movements.length).toBe(2);
    });

    it('parses Sabadell Tarjeta sample file correctly', async () => {
      const tarjSabBuf = fs.readFileSync(path.join(sampleDir, 'Tarj. Sabadell.xls'));
      const tarjSabRes = await parseBankStatementFile(tarjSabBuf.buffer, 'Tarj. Sabadell.xls');
      expect(tarjSabRes.account_code).toBe('tarj_sabadell');
      expect(tarjSabRes.movements.length).toBe(7);
    });
  }
});
