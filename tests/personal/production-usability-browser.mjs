import assert from 'node:assert/strict';import fs from 'node:fs';
const {chromium}=await import('../../../el_criollo_modular/.local-data/tooling/node_modules/playwright/index.mjs');
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
const page=await context.newPage(),errors=[],actions=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
const unit='20000000-0000-4000-8000-000000000001',eid='40000000-0000-4000-8000-000000000001';
const raw={units:[{id:unit,name:'Synthetic unit',timeZone:'Europe/Madrid'}],employees:[{id:eid,first_name:'Synthetic',last_name:'Employee',employment_status:'ACTIVE',revision:1}],employment:[{employee_id:eid,position:'Sala',start_date:'2026-01-01'}],assignments:[{employee_id:eid,operational_unit_id:unit}],schedules:[],scheduleRules:[],scheduleExceptions:[],punches:[],corrections:[],observations:[],devices:[]};
const url='https://synthetic.invalid/personal/fichaje/#activate='+'A'.repeat(43);
await page.route('**/api/personnel',async route=>{const body=route.request().postDataJSON();actions.push(body);const p=body.payload;let result={};
if(body.action==='snapshot')result=raw;
if(body.action==='device.activate')result={activationUrl:url,expiresIn:600};
if(body.action==='schedule.rule.save')raw.scheduleRules=[{id:'rule',employee_id:eid,weekdays:p.weekdays,start_time:p.start,end_time:p.end,valid_from:p.validFrom,valid_until:p.validUntil,revision:1}];
if(body.action==='schedule.exception.save')raw.scheduleExceptions=[{id:'exception',employee_id:eid,local_date:p.date,start_time:p.start,end_time:p.end,cancelled:p.cancelled,revision:1}];
await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});});
const button=(name,scope=page)=>scope.getByRole('button',{name,exact:true}),tab=name=>button(name,page.locator('aside')),dialog=()=>page.getByRole('dialog');
try {
 await page.goto('http://127.0.0.1:5198/context.html');await page.getByLabel('Unidad operativa activa').selectOption(unit);await tab('Horarios').click();await button('+ Horario habitual').waitFor();
 await page.clock.install();const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();await page.clock.fastForward(300000);await page.bringToFront();
 await page.evaluate(()=>window.dispatchEvent(new Event('fixture-refresh')));await button('+ Horario habitual').waitFor();
 assert.equal(await page.getByLabel('Unidad operativa activa').inputValue(),unit);assert(new URL(page.url()).searchParams.get('section')==='Horarios');
 await page.reload();await button('+ Horario habitual').waitFor();assert.equal(await page.getByLabel('Unidad operativa activa').inputValue(),unit);checks.push('Real AuthProvider revalidates context on auth refresh, five-minute return, focus/tab switch and reload');
 await button('+ Horario habitual').click();await dialog().getByLabel('Empleado',{exact:true}).selectOption(eid);await dialog().getByLabel('Desde',{exact:true}).fill('2040-01-02');await button('Guardar horario habitual',dialog()).click();await dialog().waitFor({state:'hidden'});await page.getByText('Sin fecha de fin',{exact:false}).waitFor();
 assert.deepEqual(actions.find(a=>a.action==='schedule.rule.save').payload.weekdays,[1,2,3,4,5]);
 await button('Cambiar un día').click();await dialog().getByLabel('Empleado',{exact:true}).selectOption(eid);await dialog().getByLabel('Fecha',{exact:true}).fill('2040-01-04');await dialog().getByLabel('Día sin trabajo').check();await button('Guardar cambio del día',dialog()).click();await dialog().waitFor({state:'hidden'});checks.push('Habitual schedule form and date cancellation save through the scoped adapter');
 await tab('Fichaje').click();await button('Activar dispositivo').click();await dialog().getByLabel('Nombre del dispositivo').fill('Shared tablet');await button('Generar',dialog()).click();await button('Copiar enlace',dialog()).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),url);await page.getByText('Enlace copiado',{exact:true}).waitFor();assert.equal(actions.filter(a=>a.action==='device.activate').length,1);assert.equal(await button('Cerrar y ocultar').count(),0);
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});const box=await dialog().boundingBox();assert(box.width<=440);assert(Math.abs(box.x+box.width/2-width/2)<2);assert(Math.abs(box.y+box.height/2-450)<3);}
 await button('Cerrar',dialog()).click();await dialog().waitFor({state:'hidden'});await button('Activar dispositivo').click();await button('Cancelar',dialog()).click();await dialog().waitFor({state:'hidden'});checks.push('Compact centered responsive activation dialog; copy exact URL once, no regeneration, X and Cancel');
 await page.evaluate(()=>sessionStorage.setItem('revoke-unit','true'));await page.reload();await page.getByLabel('Tenant activo').waitFor();assert.equal(await page.getByLabel('Unidad operativa activa').count(),0);checks.push('Revoked unit preference never restores unauthorized unit');
 await button('Cerrar sesión').click();await page.locator('#access-password').waitFor();assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('horeca-context')).length),0);assert(!new URL(page.url()).searchParams.has('module'));checks.push('Logout clears saved protected context and route');
 assert.deepEqual(errors,[]);fs.mkdirSync('.local-data/usability-evidence',{recursive:true});fs.writeFileSync('.local-data/usability-evidence/browser.json',JSON.stringify({status:'PASS',isolatedAuthAndApiFixtures:true,checks},null,2));console.log(JSON.stringify({status:'PASS',checks}));
}catch(error){console.log(JSON.stringify({body:(await page.locator('body').innerText()).slice(0,2500),errors}));throw error;}finally{await browser.close();}
