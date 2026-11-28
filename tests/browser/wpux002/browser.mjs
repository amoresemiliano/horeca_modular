import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||pathToFileURL(resolve('../el_criollo_modular/.local-data/tooling/node_modules/playwright/index.mjs')).href);
const root=resolve('tests/browser/wpux002');const config={configFile:false,root,envDir:false,plugins:[{name:'fixtures',enforce:'pre',resolveId(source){if(source.endsWith('/context/AuthContext'))return resolve(root,'auth.jsx');if(source.endsWith('/lib/extractosService'))return resolve('tests/browser/financeService.js');if(source.endsWith('/lib/tenantAdminService'))return resolve('tests/browser/role_governance/service.js');if(/\/lib\/supabase(\.js)?$/.test(source))return resolve('tests/browser/financeSupabase.js');}},react()],server:{host:'127.0.0.1',port:5199,strictPort:true,fs:{allow:[resolve('.')]}},define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('https://example.invalid'),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('synthetic-key-only')}};
const server=await createServer(config);let browser;
try {await server.listen();browser=await chromium.launch({channel:'chrome',headless:true});
 for(const [width,height] of [[1440,900],[1280,800],[390,844]])for(const platform of [false,true]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/personnel',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({units:[{id:'unit',name:'Local principal',timeZone:'Europe/Madrid'}],employees:[],employment:[],assignments:[],schedules:[],punches:[],corrections:[],observations:[],devices:[]})}));
  await page.goto('http://127.0.0.1:5199/?module=Bancos&section=Consolidado'+(platform?'&platform':''));await page.getByRole('heading',{name:'Movimientos bancarios'}).waitFor();await page.locator('tbody tr').first().waitFor();
  const calls=await page.evaluate(()=>window.financeCalls);assert(calls.some(c=>c[0]==='page'&&c[2]===25));assert(calls.some(c=>c[0]==='catalogs'));assert(!calls.some(c=>['full-history','transfer-candidates'].includes(c[0])||(c[0]==='page'&&c[2]===100)));console.log('INITIAL CALLS',JSON.stringify(calls.map(c=>c[0])));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await page.getByLabel('Tenant activo').inputValue(),'synthetic-org');assert.equal(await page.getByLabel('Unidad operativa activa').inputValue(),'unit');
  if(width>=1280){const layout=await page.locator('.shell-header').evaluate(e=>{const [a,b]=Array.from(e.children).map(n=>n.getBoundingClientRect());return {separate:a.right<=b.left+1,overlap:Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top),height:e.getBoundingClientRect().height}});assert(layout.separate&&layout.overlap&&layout.height<90,'Header wraps');}
  await page.getByRole('button',{name:'Más filtros'}).click();await page.getByLabel('Tipo económico').waitFor();await page.getByRole('button',{name:'Más filtros'}).click();
  await page.getByRole('button',{name:'Editar clasificación'}).first().click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.getByRole('button',{name:'Abrir clasificación asistida'}).click();await page.getByText('Revisa operaciones similares y aplica una clasificación de forma conjunta.').waitFor();assert((await page.evaluate(()=>window.financeCalls)).some(c=>c[0]==='page'&&c[2]===100));
  await page.getByLabel('Filas por página').selectOption('50');await page.waitForFunction(()=>window.financeCalls.some(c=>c[0]==='page'&&c[2]===50));
  await page.getByRole('button',{name:'Transferencias',exact:true}).click();await page.getByRole('dialog').waitFor();assert((await page.evaluate(()=>window.financeCalls)).some(c=>c[0]==='transfer-candidates'));await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.locator('.shell-section-navigation').getByRole('button',{name:'Resumen',exact:true}).click();await page.getByRole('heading',{name:'Resumen bancario'}).waitFor();
  await page.locator('.shell-section-navigation').getByRole('button',{name:'Métricas',exact:true}).click();await page.getByRole('heading',{name:/Métricas|Gráficas/}).first().waitFor();
  await page.getByLabel('Abrir módulos').click();await page.locator('.shell-launcher-menu').getByRole('button',{name:'Personal'}).click();await page.getByLabel('Personal persistente').count().then(n=>assert.equal(n,0));
  const sections=page.locator('.shell-section-navigation');for(const name of ['Hoy','Asistencia','Horarios','Empleados','Fichaje']){await sections.getByRole('button',{name,exact:true}).click();assert.equal(await page.locator('.shell-section-navigation').getByRole('button',{name,exact:true}).count(),1);}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);await page.close();console.log('PASS',width,platform?'platform':'tenant');
 }
}finally{await browser?.close();await server.close();}
