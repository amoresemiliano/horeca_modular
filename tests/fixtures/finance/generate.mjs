// Entirely synthetic HORECA fixtures; no input bank exports are read.
// Run: node tests/fixtures/finance/generate.mjs
import XLSX from 'xlsx';
import { writeFileSync } from 'node:fs';

function write(name, sheet, rows) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), sheet);
  writeFileSync(new URL(name + '_sanitized.xls', import.meta.url), XLSX.write(book, { type: 'buffer', bookType: 'biff8' }));
}

const accountHeader = ['F. CONTABLE', 'F. VALOR', 'CONCEPTO', 'BENEFICIARIO/ORDENANTE', 'OBSERVACIONES', 'IMPORTE', 'SALDO', 'DIVISA', 'REMESA'];
for (const [suffix, iban, count, firstAmount] of [
  ['a', 'ES9901824924000000000001', 149, '-600,00'],
  ['b', 'ES9901824924000000000002', 234, '993,97'],
]) {
  write(`bbva_account_${suffix}`, 'Historico', [
    ['HORECA_TEST synthetic account'], ['CUENTA', iban], accountHeader,
    ...Array.from({ length: count }, (_, i) => ['03/08/2026', i ? '03/08/2026' : '', `HORECA_TEST transaction ${i + 1}`, '', '', i ? '-10,05' : firstAmount, '32.070,98', 'EUR', '']),
  ]);
}
write('bbva_card', 'Listado', [
  ['EXTRACTO DE TARJETA', 'HORECA_TEST'], ['NO DE CONTRATO', '000000000000000000000001'],
  ['FECHA DE OPERACI\u00d3N', 'CONCEPTO', 'TIPO DE MOVIMIENTO', 'IMPORTE', 'DIVISA'],
  ...Array.from({ length: 84 }, (_, i) => ['30/07/2026', `HORECA_TEST purchase ${i + 1}`, 'COMPRA', i ? '-10,00' : '-39,95', 'EUR']),
]);
write('sabadell_account', 'Hoja1', [
  ['CONSULTA DE MOVIMIENTOS', 'HORECA_TEST'], ['CUENTA:', 'ES9900810000000000000001'],
  ['F. OPERATIVA', 'CONCEPTO', 'F. VALOR', 'IMPORTE', 'SALDO', 'REFERENCIA 1', 'REFERENCIA 2'],
  ['16/07/2026', 'HORECA_TEST settlement', '', '-240,56', '759,44', 'HORECA_TEST_REF_1', ''],
  ['17/07/2026', 'HORECA_TEST receipt', '18/07/2026', '100,00', '859,44', '', ''],
]);
write('sabadell_card', 'Sheet0', [
  ['SALDOS Y MOVIMIENTOS', 'HORECA_TEST'], ['Total operaciones pendientes 08/2026'],
  ['FECHA', 'CONCEPTO', 'LOCALIDAD', 'IMPORTE', 'DIVISA'],
  ...Array.from({ length: 7 }, (_, i) => ['23/07', `HORECA_TEST purchase ${i + 1}`, 'TEST', i ? '10,00' : '4,98', 'EUR']),
]);
