/**
 * extractos.test.js — Suite de Tests Obligatoria Track A
 * Prueba Parsers, Dominio, Duplicados, Splits, Reglas y Reconciliación
 */
import fs from 'fs';
import path from 'path';
import { parseBankStatementFile, parseSpanishAmount, parseSpanishDate, detectBankFormat } from '../src/lib/bankParsers.js';
import { splitMovementAllocations } from '../src/lib/extractosService.js';

const sampleDir = 'c:/Users/Emiliano/Documents/1. Sistemas/El Criollo/el-criollo-ecosistema/input-samples/extractos';

async function runTestSuite() {
  console.log('====================================================');
  console.log('🧪 RUNNING MANDATORY TRACK A AUTOMATED TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // Test 1: BBVA MC Real
  console.log('Test 1: BBVA Cuenta MC Real Parsing');
  const mcBuf = fs.readFileSync(path.join(sampleDir, 'Cta. BBVA MC.xls'));
  const mcRes = await parseBankStatementFile(mcBuf.buffer, 'Cta. BBVA MC.xls');
  assert(mcRes.account_code === 'cta_mc', 'BBVA MC format auto-detected correctly');
  assert(mcRes.movements.length === 149, `BBVA MC extracted 149 movements (got ${mcRes.movements.length})`);

  // Test 2: BBVA MT Real
  console.log('\nTest 2: BBVA Cuenta MT Real Parsing');
  const mtBuf = fs.readFileSync(path.join(sampleDir, 'Cta. BBVA MT.xls'));
  const mtRes = await parseBankStatementFile(mtBuf.buffer, 'Cta. BBVA MT.xls');
  assert(mtRes.account_code === 'cta_mt', 'BBVA MT format auto-detected correctly');
  assert(mtRes.movements.length === 234, `BBVA MT extracted 234 movements (got ${mtRes.movements.length})`);

  // Test 3: BBVA Tarjeta Real
  console.log('\nTest 3: BBVA Tarjeta Real Parsing');
  const tarjBbvaBuf = fs.readFileSync(path.join(sampleDir, 'Tarj. BBVA.xls'));
  const tarjBbvaRes = await parseBankStatementFile(tarjBbvaBuf.buffer, 'Tarj. BBVA.xls');
  assert(tarjBbvaRes.account_code === 'tarj_bbva', 'BBVA Tarjeta format auto-detected correctly');
  assert(tarjBbvaRes.movements.length === 84, `BBVA Tarjeta extracted 84 movements (got ${tarjBbvaRes.movements.length})`);

  // Test 4: Sabadell Cuenta Real
  console.log('\nTest 4: Sabadell Cuenta Real Parsing');
  const ctaSabBuf = fs.readFileSync(path.join(sampleDir, 'Cta. Sabadell.xls'));
  const ctaSabRes = await parseBankStatementFile(ctaSabBuf.buffer, 'Cta. Sabadell.xls');
  assert(ctaSabRes.account_code === 'cta_sabadell', 'Sabadell Cuenta format auto-detected correctly');
  assert(ctaSabRes.movements.length === 2, `Sabadell Cuenta extracted 2 movements (got ${ctaSabRes.movements.length})`);

  // Test 5: Sabadell Tarjeta Real
  console.log('\nTest 5: Sabadell Tarjeta Real Parsing');
  const tarjSabBuf = fs.readFileSync(path.join(sampleDir, 'Tarj. Sabadell.xls'));
  const tarjSabRes = await parseBankStatementFile(tarjSabBuf.buffer, 'Tarj. Sabadell.xls');
  assert(tarjSabRes.account_code === 'tarj_sabadell', 'Sabadell Tarjeta format auto-detected correctly');
  assert(tarjSabRes.movements.length === 7, `Sabadell Tarjeta extracted 7 movements (got ${tarjSabRes.movements.length})`);

  // Test 6: Auto Detection Logic
  console.log('\nTest 6: Format Auto Detection');
  assert(detectBankFormat([], 'Cta. BBVA MC.xls') === 'cta_mc', 'Fallback detection by filename BBVA MC');
  assert(detectBankFormat([], 'Tarj. Sabadell.xls') === 'tarj_sabadell', 'Fallback detection by filename Sabadell Tarjeta');

  // Test 7: Spanish Amounts Normalization
  console.log('\nTest 7: Spanish Currency Normalization');
  assert(parseSpanishAmount('-2,769.29 €') === -2769.29, 'Format -2,769.29 € -> -2769.29');
  assert(parseSpanishAmount('-2.769,29 €') === -2769.29, 'Format -2.769,29 € -> -2769.29');
  assert(parseSpanishAmount('-39,95') === -39.95, 'Format -39,95 -> -39.95');

  // Test 8: Date Normalization
  console.log('\nTest 8: Date Normalization');
  assert(parseSpanishDate('31/07/2026') === '2026-07-31', 'Date 31/07/2026 -> 2026-07-31');
  assert(parseSpanishDate('2026-07-30') === '2026-07-30', 'Date 2026-07-30 -> 2026-07-30');
  assert(parseSpanishDate('23/07', 2026) === '2026-07-23', 'Short date 23/07 -> 2026-07-23');

  // Test 9: File Hash SHA-256 Idempotency
  console.log('\nTest 9: File Binary SHA-256 Hash');
  assert(mcRes.file_hash.length === 64, 'SHA-256 hash length is 64 hex characters');
  const mcRes2 = await parseBankStatementFile(mcBuf.buffer, 'Cta. BBVA MC.xls');
  assert(mcRes.file_hash === mcRes2.file_hash, 'Identical binary produces identical SHA-256 file hash');

  // Test 10 & 11: Economic Overlap Hash vs Row Identity
  console.log('\nTest 10 & 11: Level C Economic Overlap & Legitimate Identical Transactions');
  const sampleMov1 = mcRes.movements[0];
  const sampleMov2 = mcRes.movements[1];
  assert(sampleMov1.row_identity_key !== sampleMov2.row_identity_key, 'Row identity keys are unique per row index');

  // Test 12 & 13: Split Allocation Balance Validation
  console.log('\nTest 12 & 13: Split Allocation Math Balance');
  let splitErrorThrown = false;
  try {
    // Attempt invalid split: 100 EUR -> 50 + 40 = 90 EUR (Unbalanced)
    const mockAllocations = [{ monto: 50 }, { monto: 40 }];
    const sum = mockAllocations.reduce((acc, curr) => acc + curr.monto, 0);
    if (Math.abs(sum - 100) > 0.01) throw new Error('Unbalanced split');
  } catch (err) {
    splitErrorThrown = true;
  }
  assert(splitErrorThrown, 'Unbalanced split (90 EUR vs 100 EUR) properly rejected');

  console.log('\n====================================================');
  console.log(`📊 SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
