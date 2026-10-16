import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const artifacts=resolve('.local-data/production-ux');mkdirSync(artifacts,{recursive:true});
const report={checks:[],layouts:[],pageErrors:[],externalRequests:0};
const pass=name=>{report.checks.push(name);console.log('PASS '+name);};
const server=await createServer({configFile:false,root:resolve('.'),plugins:[react()],optimizeDeps:{entries:['tests/browser/production/index.html']},server:{host:'127.0.0.1',port:5192,strictPort:true,watch:{ignored:['**/.local-data/**']}}});
let browser,lastPage;
try{
 await server.listen();const origin='http://127.0.0.1:5192';browser=await chromium.launch({channel:process.env.PRODUCTION_BROWSER_CHANNEL||'chrome',headless:true});
 async function open(scenario,width=390,extra=''){
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<768});
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin===origin)return route.continue();report.externalRequests++;return route.abort();});
  const page=await context.newPage();lastPage=page;page.on('pageerror',e=>report.pageErrors.push(e.message));
  await page.goto(origin+'/tests/browser/production/index.html?scenario='+scenario+extra,{waitUntil:'commit'});await page.getByRole('heading',{name:scenario==='denied'?'Producción no disponible':'Producción',exact:true}).waitFor();
  if(scenario!=='denied')await page.getByText('Cargando Producción…').waitFor({state:'hidden'});
  return {context,page};
 }
 async function fill(page,count='20'){
  await page.getByLabel('Producto',{exact:true}).selectOption('50000000-0000-4000-8000-000000000001');
  await page.getByLabel('Envase',{exact:true}).selectOption('60000000-0000-4000-8000-000000000001');
  await page.getByLabel('Destino',{exact:true}).selectOption('70000000-0000-4000-8000-000000000001');
  await page.getByLabel('Número de envases').fill(count);
 }
 async function detail(page){await page.getByRole('button',{name:'Abrir lote',exact:true}).click();await page.getByRole('heading',{name:'Detalle del lote'}).waitFor();}
 {
  const {page,context}=await open('denied');assert.equal(await page.getByRole('button',{name:'Nueva producción'}).count(),0);pass('Missing access denies module entry');await context.close();
 }
 {
  const {page,context}=await open('reader');assert.equal(await page.getByRole('button',{name:'Nueva producción'}).count(),0);await detail(page);
  for(const name of ['Editar borrador','Revisar confirmación','Corregir producción','Revertir producción','Registrar merma'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),0);
  assert(await page.getByText('Historial inmutable.',{exact:false}).isVisible());pass('Read-only detail is immutable and hides mutation actions');await context.close();
 }
 {
  const {page,context}=await open('unavailable');assert(await page.getByText('Stock no disponible',{exact:true}).isVisible());
  await page.getByRole('button',{name:'Nueva producción'}).click();assert.equal(await page.getByLabel('Producto',{exact:true}).isEnabled(),false);assert.equal(await page.getByRole('button',{name:'Revisar borrador'}).isEnabled(),false);
  assert(await page.getByText('Conversión no disponible',{exact:true}).isVisible());assert.equal(await page.evaluate(()=>window.productionTest.commands.length),0);pass('Unavailable owners block entry without fake references or stock');await context.close();
 }
 {
  const {page,context}=await open('unknown');await page.getByRole('button',{name:'Nueva producción'}).click();await fill(page);
  assert(await page.getByText('Conversión no disponible',{exact:true}).isVisible());assert.equal(await page.getByRole('button',{name:'Revisar borrador'}).isEnabled(),false);pass('Unknown conversion fails closed');await context.close();
 }
 {
  const {page,context}=await open('operator');await page.getByRole('button',{name:'Nueva producción'}).click();await fill(page);await page.getByLabel('Fecha efectiva',{exact:true}).fill('2026-10-15');
  assert(await page.getByText('= 30 kg',{exact:true}).isVisible());assert(await page.getByText('Salida manual:',{exact:false}).isVisible());
  await page.screenshot({path:artifacts+'/mobile-entry.png',fullPage:true});
  await page.getByRole('button',{name:'Revisar borrador'}).click();await page.getByRole('button',{name:'Guardar borrador',exact:true}).dblclick();await page.getByRole('heading',{name:'Detalle del lote'}).waitFor();
  const created=await page.evaluate(()=>window.productionTest.commands);assert.equal(created.filter(r=>r.command==='create_draft').length,1);assert.equal(created[0].body.effective_date,'2026-10-15');assert.equal(created[0].body.mode,'MANUAL_OUTPUT');
  assert.equal(await page.getByRole('button',{name:'Revisar confirmación'}).count(),0);assert.equal(await page.getByRole('button',{name:'Corregir producción'}).count(),0);
  await page.getByRole('button',{name:'Editar borrador',exact:true}).click();await page.getByLabel('Número de envases').fill('21');assert(await page.getByText('= 31.5 kg',{exact:true}).isVisible());
  await page.getByRole('button',{name:'Revisar borrador'}).click();await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.getByRole('heading',{name:'Detalle del lote'}).waitFor();
  await page.getByRole('button',{name:'Editar borrador',exact:true}).click();await page.getByLabel('Número de envases').fill('22');await page.getByRole('button',{name:'Revisar borrador'}).click();
  await page.evaluate(()=>{window.productionTest.failNext='OWNER_CONTRACT_UNAVAILABLE';});await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.getByRole('alert').first().waitFor();
  assert((await page.getByRole('alert').first().innerText()).includes('todavía no están disponibles'));await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.getByRole('heading',{name:'Detalle del lote'}).waitFor();
  const retries=await page.evaluate(()=>window.productionTest.commands.slice(-2));assert.equal(retries[0].request_id,retries[1].request_id);
  await page.getByRole('button',{name:'Editar borrador',exact:true}).click();await page.getByLabel('Número de envases').fill('23');await page.getByRole('button',{name:'Revisar borrador'}).click();
  await page.evaluate(()=>{window.productionTest.failNext='STALE_REVISION';});await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.getByRole('alert').first().waitFor();
  assert((await page.getByRole('alert').first().innerText()).includes('Este lote ha cambiado'));assert.equal(await page.getByRole('button',{name:'Guardar borrador',exact:true}).isEnabled(),false);
  pass('Mobile draft create/edit/date/conversion, single submit, operator gate and stale revision');await context.close();
 }
 {
  const {page,context}=await open('owner');await detail(page);await page.getByRole('button',{name:'Revisar confirmación'}).click();assert.equal(await page.getByRole('button',{name:'Confirmar producción',exact:true}).isEnabled(),false);
  await page.getByLabel('He revisado la producción declarada').check();await page.getByRole('button',{name:'Confirmar producción',exact:true}).dblclick();await page.getByText('Confirmado',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Editar borrador',exact:true}).count(),0);assert.equal(await page.evaluate(()=>window.productionTest.commands.filter(r=>r.command==='confirm_batch').length),1);
  await page.getByRole('button',{name:'Corregir producción',exact:true}).click();assert(await page.getByText('Valores originales',{exact:false}).isVisible());await page.getByLabel('Número de envases').fill('18');await page.getByLabel('Motivo de corrección').fill('Isolated correction check');
  await page.getByRole('button',{name:'Revisar corrección'}).click();await page.getByRole('button',{name:'Crear revisión corregida'}).click();await page.getByText('Corregido',{exact:true}).waitFor();assert(await page.getByText('Revisión 3 · Corrección',{exact:true}).isVisible());
  await page.getByRole('button',{name:'Registrar merma',exact:true}).click();await page.getByLabel('Salida declarada',{exact:true}).selectOption('80000000-0000-4000-8000-000000000001');await page.getByLabel('Cantidad de merma',{exact:false}).fill('1');await page.getByLabel('Motivo de merma').fill('Isolated output loss');await page.getByRole('button',{name:'Guardar merma sin confirmar'}).click();await page.getByText('Merma registrada · sin confirmar',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Revisar merma',exact:true}).click();await page.getByRole('button',{name:'Confirmar merma',exact:true}).click();await page.getByText('Merma confirmada',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Registrar merma',exact:true}).click();await page.getByLabel('Tipo de merma').selectOption('PROCESS_ALREADY_CONSUMED');await page.getByLabel('Consumo real declarado',{exact:true}).selectOption('80000000-0000-4000-8000-000000000002');assert(await page.getByText('No solicita una segunda retirada del material consumido.',{exact:true}).isVisible());
  await page.getByLabel('Cantidad de merma',{exact:false}).fill('0.5');await page.getByLabel('Motivo de merma').fill('Isolated process loss');await page.getByRole('button',{name:'Guardar merma sin confirmar'}).click();await page.getByText('Pérdida de material ya consumido',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Registrar merma',exact:true}).click();await page.getByLabel('Tipo de merma').selectOption('STOCK_REMOVAL');await page.getByLabel('Material',{exact:true}).selectOption('50000000-0000-4000-8000-000000000001');await page.getByLabel('Origen de stock').selectOption('70000000-0000-4000-8000-000000000001');await page.getByLabel('Cantidad de merma',{exact:false}).fill('0.2');await page.getByLabel('Motivo de merma').fill('Isolated stock removal');await page.getByRole('button',{name:'Guardar merma sin confirmar'}).click();await page.getByText('Retirada de material en stock',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Revertir producción',exact:true}).click();await page.getByLabel('Motivo',{exact:true}).fill('Isolated reversal check');await page.getByRole('button',{name:'Confirmar reversión'}).click();await page.getByText('Revertido',{exact:true}).waitFor();
  assert(await page.getByText('Compensación de ejecución anterior · Pendiente',{exact:true}).first().isVisible());assert(await page.getByText(/Revisión .* · Reversión/).isVisible());
  await page.getByText('Consumos declarados de esta ejecución',{exact:true}).last().click();assert(await page.getByText(/35 kg · origen/).last().isVisible());
  await page.screenshot({path:artifacts+'/mobile-history.png',fullPage:true});
  await page.getByRole('button',{name:'Historial',exact:true}).click();await page.getByLabel('Estado',{exact:true}).selectOption('REVERSED');await page.getByRole('button',{name:'Abrir lote',exact:true}).waitFor();
  await page.getByRole('button',{name:'Test scope switch'}).click();await page.getByText('Cargando Producción…').waitFor({state:'hidden'});assert.equal(await page.getByRole('button',{name:'Abrir lote',exact:true}).count(),0);
  pass('Deliberate confirm, immutable correction/reversal, three waste classes, pending posting and scope switch');await context.close();
 }
 for(const [actual,label] of [['29','Crítico'],['30','Necesario'],['47.5','Óptimo'],['100','Óptimo'],['101','Exceso'],['','Stock no disponible']]){
  const {page,context}=await open('owner',390,'&actual='+actual);assert(await page.getByText(label,{exact:true}).isVisible());if(actual==='')assert.equal(await page.getByText(/Producción sugerida:/).count(),0);await context.close();
 }
 pass('Planning equality boundaries and UNKNOWN presentation');
 {
  const {page,context}=await open('owner');await page.evaluate(()=>{window.productionTest.failReads=true;});await page.getByRole('button',{name:'Actualizar datos'}).click();await page.getByRole('alert').waitFor();
  assert((await page.getByRole('alert').innerText()).includes('No se ha podido cargar Producción'));await page.evaluate(()=>{window.productionTest.failReads=false;});await page.getByRole('button',{name:'Actualizar datos'}).click();await page.getByRole('button',{name:'Abrir lote',exact:true}).waitFor();
  pass('Read failure is understandable and retriable without fabricated data');await context.close();
 }
 for(const width of [320,390,768,1440]){
  const {page,context}=await open('owner',width);await page.getByRole('button',{name:'Nueva producción'}).click();await fill(page);
  const layout=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,touchTargets:[...document.querySelectorAll('.prod-workspace button,.prod-workspace input,.prod-workspace select')].filter(e=>e.getBoundingClientRect().height>0).every(e=>e.getBoundingClientRect().height>=44)}));
  assert(layout.width<=layout.viewport,JSON.stringify(layout));assert(layout.touchTargets);report.layouts.push(layout);if(width===1440)await page.screenshot({path:artifacts+'/desktop-entry.png',fullPage:true});await context.close();
 }
 pass('320/390/768/1440 layouts have no horizontal overflow and 44px controls');
 assert.deepEqual(report.pageErrors,[]);assert.equal(report.externalRequests,0);report.status='PASS';
}catch(error){
 report.status='FAIL';report.failure=error.message;
 if(lastPage&&!lastPage.isClosed()){writeFileSync(artifacts+'/failure.txt',await lastPage.content());await lastPage.screenshot({path:artifacts+'/failure.png',fullPage:true});}
 throw error;
}finally{
 writeFileSync(artifacts+'/evidence.json',JSON.stringify(report,null,2));await browser?.close();await server.close();
}
