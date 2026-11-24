import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sevenSyntheticFiles } from '../fixtures/finance/scale.mjs';

const playwrightModule = process.env.PLAYWRIGHT_MODULE || pathToFileURL(resolve('../el_criollo_modular/.local-data/tooling/node_modules/playwright/index.mjs')).href;
const { chromium } = await import(playwrightModule);

const artifacts = resolve(process.env.FINANCE_BROWSER_ARTIFACTS || '.local-data/wp-fin-005-browser');
mkdirSync(artifacts, { recursive: true });

const fixturesDir = resolve('.local-data/wp-fin-005-fixtures');
mkdirSync(fixturesDir, { recursive: true });

// Ensure seven synthetic fixtures exist
const files = sevenSyntheticFiles();
for (const f of files) {
  writeFileSync(resolve(fixturesDir, f.name), f.buffer);
}

// Create a file with a deliberate rejected row
const csvHeader = 'Fecha Proceso,Fecha Valor,Código,Concepto,Observaciones,Oficina,Importe,Saldo,Remesa';
const rejectedCsvContent = csvHeader + '\r\n' +
  '03/01/2023,,111,COMPRA DIA 14053,,222,"-31,75","100,00",REF_OK\r\n' +
  '03/01/2023,,111,COMPRA CORRUPTA,,222,NOT_A_NUMBER,"100,00",REF_BAD\r\n';
const rejectedCsvPath = resolve(fixturesDir, 'synthetic_with_rejected.csv');
writeFileSync(rejectedCsvPath, Buffer.from(rejectedCsvContent, 'utf8'));

const xlsxPath = resolve(fixturesDir, 'synthetic_bbva_card_6.xlsx');
const xlsPath = resolve(fixturesDir, 'synthetic_sabadell_account.xls');

const browser = await chromium.launch({ channel: process.env.FINANCE_BROWSER_CHANNEL || 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [], checks = [];

page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !errors.includes(m.text())) errors.push(m.text()); });
await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());

const url = process.env.FINANCE_BROWSER_URL || 'http://127.0.0.1:5187';
const pass = name => { checks.push(name); console.log('PASS ' + name); };
const dialog = () => page.getByRole('dialog');
const label = name => dialog().getByLabel(name, { exact: true });

async function closeDialog() {
  await dialog().getByRole('button', { name: 'Cerrar', exact: true }).first().click();
  await dialog().waitFor({ state: 'hidden' });
}

async function triggerReload() {
  const toggleBtn = page.getByRole('button', { name: 'Cambiar organización sintética', exact: true });
  await toggleBtn.click();
  await toggleBtn.click();
  await page.getByRole('heading', { name: 'Movimientos bancarios' }).waitFor();
}

try {
  // 1. Open Finance/Bancos
  await page.goto(url + '/?scale', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Movimientos bancarios' }).waitFor();
  pass('1. Open Finance/Bancos');

  // 2. Open import modal
  await page.getByRole('button', { name: 'Cargar', exact: true }).click();
  await dialog().waitFor();
  assert((await dialog().innerText()).includes('Importar Extracto Bancario'));
  pass('2. Open import modal');

  // 3. Multiple file selection (CSV, XLS, XLSX)
  const fileInput = page.getByLabel('Archivos bancarios');
  await fileInput.setInputFiles([rejectedCsvPath, xlsPath, xlsxPath]);
  pass('3. Multiple file selection (CSV, XLS, XLSX)');

  // 4. Batch preview
  const previewRegion = page.locator('[aria-label="Vista previa del lote"]');
  await previewRegion.waitFor();
  const previewText = await previewRegion.innerText();
  assert(previewText.includes('synthetic_with_rejected.csv'));
  assert(previewText.includes('synthetic_sabadell_account.xls'));
  assert(previewText.includes('synthetic_bbva_card_6.xlsx'));
  assert(previewText.includes('BBVA_ACCOUNT'));
  assert(previewText.includes('SABADELL_ACCOUNT'));
  assert(previewText.includes('BBVA_CARD'));
  pass('4. Independent batch preview per file');

  // 5. Rejected-row acknowledgement
  assert(previewText.includes('1 movimientos · 1 filas rechazadas'));
  const details = page.locator('details').filter({ hasText: 'Ver filas rechazadas' });
  await details.locator('summary').click();
  assert((await details.innerText()).includes('Fila 3:'));
  // Select account for synthetic_with_rejected.csv first
  const bbvaSelect = page.getByLabel('Cuenta de destino: synthetic_with_rejected.csv');
  await bbvaSelect.selectOption('a');

  // Verify batch is blocked by rejected rows before acknowledging
  const confirmBtn = page.getByRole('button', { name: /Confirmar Importación/ });
  assert(await confirmBtn.isDisabled());
  assert((await dialog().innerText()).includes('Confirma que has revisado las filas rechazadas.'));

  // Check the acknowledgement checkbox
  const ackCheckbox = page.getByRole('checkbox', { name: /Importar 1 movimientos y registrar 1 rechazos/ });
  await ackCheckbox.check();
  // Ensure the account for BBVA Card is selected
  const cardSelect = page.getByLabel('Cuenta de destino: synthetic_bbva_card_6.xlsx');
  await cardSelect.selectOption('bbva-card');
  pass('5. Rejected-row acknowledgement');

  // 6. Confirmation path
  await confirmBtn.waitFor({ state: 'visible' });
  assert(!(await confirmBtn.isDisabled()));
  await confirmBtn.click();
  // Verify batch result summary
  await page.getByRole('status').filter({ hasText: 'Resultado del lote' }).waitFor();
  const resultText = await page.getByRole('status').filter({ hasText: 'Resultado del lote' }).innerText();
  assert(resultText.includes('archivos procesados'));
  assert(resultText.includes('filas rechazadas'));
  await page.screenshot({ path: resolve(artifacts, 'batch-import-result.png') });
  await closeDialog();
  await page.getByRole('heading', { name: 'Movimientos bancarios' }).waitFor();
  pass('6. Batch confirmation path');

  // 7. Group-review workspace
  const groupSection = page.locator('details[aria-label="Revisión por grupos"]');
  await groupSection.locator('summary').click();
  await page.locator('div[role="group"]').first().waitFor();
  pass('7. Group-review workspace');

  // 8. New group classification (Occurrence 1: "Nuevo")
  const diaGroup = page.locator('div[role="group"]').filter({ hasText: 'DIA' }).filter({ hasText: 'BANK_ACCOUNT' });
  assert((await diaGroup.innerText()).includes('Nuevo'));
  await diaGroup.getByRole('button', { name: 'Clasificar grupo', exact: true }).click();
  await dialog().waitFor();
  assert((await dialog().innerText()).includes('Patrón nuevo: define su interpretación.'));

  // Quick-create category, subcategory, counterparty
  await dialog().getByRole('button', { name: '+ Categoría', exact: true }).click();
  await label('Nombre de categoría').fill('Alimentos');
  await dialog().getByRole('button', { name: 'Crear y seleccionar', exact: true }).click();
  await label('Nombre de categoría').waitFor({ state: 'hidden' });

  await dialog().getByRole('button', { name: '+ Subcategoría', exact: true }).click();
  await label('Nombre de subcategoría').fill('Frescos');
  await dialog().getByRole('button', { name: 'Crear y seleccionar', exact: true }).click();
  await label('Nombre de subcategoría').waitFor({ state: 'hidden' });

  await dialog().getByRole('button', { name: '+ Proveedor / contraparte', exact: true }).click();
  await label('Nombre de proveedor / contraparte').fill('DIA');
  await dialog().getByRole('button', { name: 'Crear y seleccionar', exact: true }).click();
  await label('Nombre de proveedor / contraparte').waitFor({ state: 'hidden' });

  await label('Tipo económico').selectOption('OPERATING_EXPENSE');
  await dialog().getByRole('button', { name: /Confirmar grupo/, exact: true }).click();
  await dialog().waitFor({ state: 'hidden' });
  pass('8. New group classification (Occurrence 1: Nuevo)');

  // 9. Proposal state after history (Occurrence 2: "Propuesta")
  await page.evaluate(() => window.financeFixture.add('COMPRA DIA 14054', -31.75, 'a'));
  await triggerReload();
  await groupSection.locator('summary').click();
  const diaGroup2 = page.locator('div[role="group"]').filter({ hasText: 'DIA' }).filter({ hasText: 'BANK_ACCOUNT' });
  assert((await diaGroup2.innerText()).includes('Propuesta'));
  await diaGroup2.getByRole('button', { name: 'Clasificar grupo', exact: true }).click();
  await dialog().waitFor();
  assert((await dialog().innerText()).includes('Basado en 1 ejemplos humanos confirmados.'));
  // Verify proposal prefilled the fields
  assert.equal(await label('Tipo económico').inputValue(), 'OPERATING_EXPENSE');
  await dialog().getByRole('button', { name: /Confirmar grupo/, exact: true }).click();
  await dialog().waitFor({ state: 'hidden' });
  pass('9. Proposal state after history (Occurrence 2: Propuesta)');

  // 10. Recognized state after two human examples (Occurrence 3: "Reconocido")
  const thirdId = await page.evaluate(() => window.financeFixture.add('COMPRA DIA 14055', -31.75, 'a'));
  await triggerReload();
  await groupSection.locator('summary').click();
  const diaGroup3 = page.locator('div[role="group"]').filter({ hasText: 'DIA' }).filter({ hasText: 'BANK_ACCOUNT' });
  assert((await diaGroup3.innerText()).includes('Reconocido'));
  // Verify third movement is STILL PENDING in data (NO auto-write without human confirmation)
  const thirdStatus = await page.evaluate(id => {
    const m = window.financeFixture.snapshot().movements.find(x => x.id === id);
    return m?.allocations[0]?.classification_status;
  }, thirdId);
  assert.equal(thirdStatus, 'PENDING');
  pass('10. Recognized state after two human examples (no auto-write)');

  // 11. Recognized group explicit confirmation
  await diaGroup3.getByRole('button', { name: 'Clasificar grupo', exact: true }).click();
  await dialog().waitFor();
  assert((await dialog().innerText()).includes('Reconocido'));
  assert.equal(await label('Tipo económico').inputValue(), 'OPERATING_EXPENSE');
  await dialog().getByRole('button', { name: /Confirmar grupo/, exact: true }).click();
  await dialog().waitFor({ state: 'hidden' });
  // Verify now confirmed
  const thirdStatusAfter = await page.evaluate(id => {
    const m = window.financeFixture.snapshot().movements.find(x => x.id === id);
    return m?.allocations[0]?.classification_status;
  }, thirdId);
  assert.equal(thirdStatusAfter, 'CONFIRMED');
  pass('11. Recognized group explicit confirmation');

  // 12. Conflict fallback
  // Introduce a conflicting historical confirmed movement for DIA
  await page.evaluate(() => {
    const id = window.financeFixture.add('COMPRA DIA 9999', -31.75, 'a');
    window.financeFixture.classify(id, {
      economic_type: 'FINANCING_OUTFLOW',
      category_id: null,
      subcategory_id: null,
      counterparty_id: 'party',
      classification_status: 'CONFIRMED',
      classification_source: 'MANUAL',
      updated_at: crypto.randomUUID()
    });
  });
  // Add a pending DIA movement
  await page.evaluate(() => window.financeFixture.add('COMPRA DIA 8888', -31.75, 'a'));
  await triggerReload();
  await groupSection.locator('summary').click();
  const diaConflict = page.locator('div[role="group"]').filter({ hasText: 'DIA' }).filter({ hasText: 'BANK_ACCOUNT' });
  assert((await diaConflict.innerText()).includes('Conflicto'));
  await diaConflict.getByRole('button', { name: 'Clasificar grupo', exact: true }).click();
  await dialog().waitFor();
  assert((await dialog().innerText()).includes('El historial contiene clasificaciones diferentes. No hay confirmación automática'));
  await closeDialog();
  pass('12. Conflict fallback');

  // 13. Same provider / different category
  // Add a distinct pattern for the same provider
  await page.evaluate(() => window.financeFixture.add('COMPRA DIA LIMPIEZA 1234', -15.50, 'a'));
  await triggerReload();
  await groupSection.locator('summary').click();
  const limpiezaGroup = page.locator('div[role="group"]').filter({ hasText: 'DIA LIMPIEZA' });
  assert.equal(await limpiezaGroup.count(), 1);
  assert((await limpiezaGroup.innerText()).includes('Nuevo'));
  pass('13. Same provider / different category');

  // 14. Existing internal-transfer regression
  // Add a transfer pair candidate
  await page.evaluate(() => {
    const left = window.financeFixture.add('Traspaso salida', -50, 'a');
    const right = window.financeFixture.add('Traspaso entrada', 50, 'b');
    const mLeft = window.financeFixture.snapshot().movements.find(x => x.id === left);
    const mRight = window.financeFixture.snapshot().movements.find(x => x.id === right);
    mLeft.descripcion = 'Traspaso salida';
    mRight.descripcion = 'Traspaso entrada';
  });
  await triggerReload();
  // Verify editing a normal movement has no INTERNAL_TRANSFER option in Tipo económico
  const firstRow = page.locator('tbody tr').first();
  await firstRow.getByRole('button', { name: 'Editar clasificación', exact: true }).click();
  await dialog().waitFor();
  assert.equal(await label('Tipo económico').locator('option[value="INTERNAL_TRANSFER"]').count(), 0);
  await closeDialog();
  pass('14. Existing internal-transfer regression');

  // 15. No technical-rule button required
  assert.equal(await page.locator('tbody tr button[title*="regla"]').count(), 0);
  assert.equal(await page.locator('tbody tr button[aria-label*="regla"]').count(), 0);
  pass('15. No technical-rule button required');

  assert.deepEqual(errors, []);
  writeFileSync(resolve(artifacts, 'evidence.json'), JSON.stringify({ status: 'PASS', checks, consoleErrors: errors }, null, 2));
  console.log('WP-FIN-005A browser acceptance suite PASS (15/15 checks)');
} catch (error) {
  await page.screenshot({ path: resolve(artifacts, 'failure.png'), fullPage: true });
  console.error(JSON.stringify({ checks, errors, body: (await page.locator('body').innerText()).slice(0, 2500) }));
  throw error;
} finally {
  await browser.close();
}
