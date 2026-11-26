import { createServer } from 'vite';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || pathToFileURL(resolve('../el_criollo_modular/.local-data/tooling/node_modules/playwright/index.mjs')).href);
const server=await createServer({configFile:'tests/browser/finance.vite.config.mjs'});
const out=resolve('.local-data/wp-ux-001b');mkdirSync(out,{recursive:true});let browser;
try {
 await server.listen();browser=await chromium.launch({channel:'chrome',headless:true});
 for(const [name,viewport] of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]]){
  const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:5187'?route.continue():route.abort());
  const shot=screen=>page.screenshot({path:resolve(out,`${name}-${screen}.png`)});
  await page.goto('http://127.0.0.1:5187/shell-finance.html?dense&platform');await page.getByRole('heading',{name:'Inicio',exact:true}).waitFor();await shot('dashboard');
  await page.getByRole('navigation',{name:'Módulos operativos'}).getByRole('button',{name:'Bancos'}).click();await page.getByRole('heading',{name:'Consolidado',exact:true}).waitFor();await page.getByText(/movimientos$/, {exact:false}).first().waitFor();await shot('consolidado');
  await page.getByRole('button',{name:'Filtros',exact:true}).click();await page.getByLabel('Subcategoría',{exact:true}).selectOption('fresh');await page.waitForFunction(()=>window.financeCalls.some(c=>c[0]==='page'&&c[3].subcategory==='fresh'));await page.getByLabel('Subcategoría',{exact:true}).selectOption('');await page.locator('button[aria-controls="finance-extra-filters"]').click();
  await page.getByRole('button',{name:'Editar clasificación'}).first().click();await page.getByRole('dialog',{name:'Clasificar movimiento'}).waitFor();await page.getByRole('dialog',{name:'Clasificar movimiento'}).getByRole('button',{name:'Cerrar'}).click();
  await page.getByRole('button',{name:/Abrir clasificación asistida/}).click();await page.getByRole('region',{name:'Clasificación asistida'}).waitFor();await shot('asistida');
  await page.locator('table').getByRole('button',{name:'Revisar propuesta'}).first().click();const proposal=page.getByRole('dialog',{name:'Clasificar movimiento'});await proposal.waitFor();assert.equal(await proposal.getByLabel('Tipo económico').inputValue(),'OPERATING_EXPENSE');assert.equal(await proposal.getByLabel('Categoría',{exact:true}).inputValue(),'food');await proposal.getByRole('button',{name:'Cerrar'}).click();
  await page.getByRole('region',{name:'Clasificación asistida'}).getByRole('button',{name:/Clasificar grupo|Revisar grupo|Revisar propuesta|Revisar diferencias/}).first().click();await page.getByRole('dialog',{name:'Clasificar grupo'}).waitFor();await page.getByRole('dialog',{name:'Clasificar grupo'}).getByRole('button',{name:'Cerrar'}).click();
  await page.getByRole('button',{name:'Aprobar propuesta'}).first().click();await page.waitForFunction(()=>window.financeCalls.filter(c=>c[0]==='pattern-review').length===1);await page.getByRole('button',{name:/Abrir clasificación asistida/}).click();await page.getByRole('region',{name:'Clasificación asistida'}).waitFor();
  const recognized=page.getByRole('group').filter({has:page.getByRole('button',{name:'Aprobar grupo'})}).first();await recognized.getByText(/Gasto operativo.*Alimentos.*Frescos.*Proveedor sintético/).waitFor();await recognized.getByRole('button',{name:'Aprobar grupo'}).click();await page.waitForFunction(()=>window.financeCalls.some(c=>c[0]==='pattern-review'));
  await page.getByRole('button',{name:'Resumen',exact:true}).click();await page.getByRole('heading',{name:'Resumen bancario'}).waitFor();await shot('resumen');await page.getByRole('button',{name:/Clasificación asistida ·/}).click();await page.getByRole('region',{name:'Clasificación asistida'}).waitFor();await page.getByRole('button',{name:'Volver al resumen'}).click();await page.getByRole('button',{name:'Revisar pendientes'}).click();await page.getByLabel('Estado',{exact:true}).waitFor();assert.equal(await page.getByLabel('Estado',{exact:true}).inputValue(),'PENDING');
  await page.getByRole('button',{name:'Métricas',exact:true}).click();await page.getByRole('heading',{name:'Métricas',exact:true}).first().waitFor();await shot('metricas');
  const nav=page.getByRole('navigation',{name:'Administración'});assert.equal(await nav.getByRole('button',{name:'Tenants'}).count(),0);await nav.getByRole('button',{name:'Configuración'}).click();await page.getByRole('button',{name:/Auditoría.*Consulta/}).waitFor();await shot('configuracion');
  await page.getByRole('button',{name:/Auditoría.*Consulta/}).click();await page.getByRole('heading',{name:'Auditoría de accesos'}).waitFor();assert.equal(await page.locator('table tbody tr').count(),20);await page.getByRole('button',{name:'Detalles',exact:true}).first().click();await page.getByRole('dialog',{name:'Detalles de auditoría'}).waitFor();await page.getByRole('dialog',{name:'Detalles de auditoría'}).getByRole('button',{name:'Cerrar'}).click();await page.getByRole('button',{name:'Siguiente',exact:true}).click();await page.getByText(/Página 2 de 3/).waitFor();await shot('auditoria');
  assert.deepEqual(errors,[]);console.log(`PASS ${name}: dashboard, Finance, summary CTA, metrics, configuration and audit`);await page.close();
 }
} finally {await browser?.close();await server.close();}
