import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || pathToFileURL(resolve('../el_criollo_modular/.local-data/tooling/node_modules/playwright/index.mjs')).href);
const server=await createServer({configFile:'tests/browser/finance.vite.config.mjs'});
let browser;
try {
 await server.listen();browser=await chromium.launch({channel:'chrome',headless:true});
 for(const platform of [false,true]){
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:5187'?route.continue():route.abort());
  await page.goto(`http://127.0.0.1:5187/shell-finance.html?large${platform?'&platform':''}&module=Bancos&section=Consolidado`);
  const heading=()=>page.getByRole('heading',{name:'Consolidado',exact:true});
  await heading().waitFor();await page.getByText('1–25 de 1208 movimientos').waitFor();
  assert.equal(await page.locator('table tbody tr').count(),25);
  await page.reload();await heading().waitFor();await page.getByText('1–25 de 1208 movimientos').waitFor();
  await page.getByRole('button',{name:'Siguiente',exact:true}).click();await page.getByText('26–50 de 1208 movimientos').waitFor();
  assert.equal(await page.locator('table tbody tr').count(),25);
  await page.reload();await page.getByText('26–50 de 1208 movimientos').waitFor();
  await page.getByLabel('Filas por página').selectOption('100');await page.getByText('1–100 de 1208 movimientos').waitFor();
  assert.equal(await page.locator('table tbody tr').count(),100);
  await page.getByRole('button',{name:'Siguiente',exact:true}).click();await page.getByText('101–200 de 1208 movimientos').waitFor();
  await page.getByLabel('Cuenta',{exact:true}).selectOption('a');
  await page.waitForFunction(()=>new URL(location.href).searchParams.get('page')==='1');
  await page.waitForFunction(()=>window.financeCalls.some(c=>c[0]==='page'&&c[1]===1&&c[2]===100&&c[3].account==='a'));
  await page.reload();await page.waitForFunction(()=>window.financeCalls.some(c=>c[0]==='page'&&c[1]===1&&c[2]===100&&c[3].account==='a'));
  assert.equal(await page.getByLabel('Cuenta',{exact:true}).inputValue(),'a');
  await page.getByLabel('Mes',{exact:true}).fill('2026-04');
  await page.getByLabel('Estado',{exact:true}).selectOption('PENDING');
  await page.waitForFunction(()=>window.financeCalls.some(c=>c[0]==='page'&&c[1]===1&&c[3].month==='2026-04'&&c[3].status==='PENDING'));
  await page.reload();await page.waitForFunction(()=>window.financeCalls.some(c=>c[0]==='page'&&c[3].month==='2026-04'&&c[3].status==='PENDING'));
  assert.equal(await page.getByLabel('Mes',{exact:true}).inputValue(),'2026-04');assert.equal(await page.getByLabel('Estado',{exact:true}).inputValue(),'PENDING');
  const calls=await page.evaluate(()=>window.financeCalls);
  assert(!calls.some(c=>c[0]==='full-history'));assert(calls.filter(c=>c[0]==='page').every(c=>c[2]<=100));
  await page.getByRole('navigation',{name:'Módulos operativos'}).getByRole('button',{name:'Dashboard'}).click();
  await page.getByRole('heading',{name:'Inicio',exact:true}).waitFor();await page.goBack();await heading().waitFor();
  await page.goForward();await page.getByRole('heading',{name:'Inicio',exact:true}).waitFor();
  await page.getByRole('navigation',{name:'Módulos operativos'}).getByRole('button',{name:'Bancos'}).click();await heading().waitFor();
  await page.getByRole('button',{name:'Remontar contexto'}).click();await heading().waitFor();
  if(platform){await page.reload();await heading().waitFor();await page.getByRole('navigation',{name:'Administración'}).getByRole('button',{name:'Configuración'}).click();await page.getByRole('button',{name:/Tenants.*Administración/}).click();await page.getByRole('heading',{name:'Administración de plataforma'}).waitFor();await page.goBack();await heading().waitFor();await page.getByRole('button',{name:'Remontar contexto'}).click();await heading().waitFor();await page.reload();await heading().waitFor();}
  else {await page.getByRole('navigation',{name:'Administración'}).getByRole('button',{name:'Configuración'}).click();await page.getByRole('button',{name:/Organización.*Información/}).waitFor();assert.equal(await page.getByRole('button',{name:/Tenants.*Administración/}).count(),0);assert.equal(await page.getByRole('button',{name:/Módulos.*Disponibilidad/}).count(),0);}
  console.log(`PASS ${platform?'platform admin':'authorized Banks'}: navigation and bounded pagination`);
  await page.close();
 }
} finally {await browser?.close();await server.close();}
