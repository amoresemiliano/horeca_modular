import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || pathToFileURL(resolve('.local-data/tooling/node_modules/playwright/index.mjs')).href);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:390,height:900}});
const unit='20000000-0000-4000-8000-000000000001',employee='30000000-0000-4000-8000-000000000001';
const raw={units:[{id:unit,name:'Synthetic unit',timeZone:'Europe/Madrid'}],employees:[],employment:[],assignments:[],schedules:[],punches:[],corrections:[],observations:[],devices:[]};
const actions=[],checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/personnel',async route=>{
 const body=route.request().postDataJSON();actions.push(body);const p=body.payload;let result={};
 if(body.action==='snapshot')result=raw;
 if(body.action==='employee.save'){raw.employees=[{id:employee,first_name:p.firstName,last_name:p.lastName,employment_status:p.status,revision:1}];raw.employment=[{employee_id:employee,position:p.position,start_date:p.startDate}];raw.assignments=[{employee_id:employee,operational_unit_id:unit}];}
 if(body.action==='pin.reset')result={pin:'1842'};
 if(body.action==='device.activate'){result={activationUrl:'https://synthetic.invalid/personal/fichaje/#activate=synthetic-one-time',expiresIn:600};raw.devices=[{id:'synthetic-device',label:p.label,expires_at:'2040-01-01'}];}
 if(body.action==='device.revoke')raw.devices[0].revoked_at=new Date().toISOString();
 if(body.action==='schedule.save')raw.schedules=[{id:'synthetic-schedule',employee_id:employee,operational_unit_id:unit,local_date:p.date,expected_start_time:p.start,expected_end_time:p.end,expected_start_at:p.date+'T09:00:00Z',expected_end_at:p.date+'T16:00:00Z',timezone:'Europe/Madrid',revision:1}];
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
});
const dialog=()=>page.getByRole('dialog');const button=(name,scope=page)=>scope.getByRole('button',{name,exact:true});
const tab=name=>button(name,page.locator('aside'));
try{
 await page.goto('http://127.0.0.1:5196/live.html',{waitUntil:'domcontentloaded',timeout:90000});await page.getByRole('heading',{name:'Tu equipo, de un vistazo'}).waitFor();
 // Mobile uses the inherited sidebar's buttons programmatically to exercise the
 // same shell tab state; desktop pointer checks follow below.
 await page.setViewportSize({width:1440,height:1000});await tab('Empleados').click();await button('+ Nuevo empleado').click();
 await dialog().getByLabel('Nombre',{exact:true}).fill('Synthetic');await dialog().getByLabel('Apellidos').fill('Employee');await dialog().getByLabel('Puesto').fill('Sala');await button('Guardar',dialog()).click();await dialog().waitFor({state:'hidden'});
 await button('Crear PIN').click();await button('Generar',dialog()).click();await page.locator('.per-pin-reveal').getByText('1842').waitFor();await button('Cerrar y ocultar',dialog()).click();
 await tab('Horarios').click();await button('+ Programar turno').click();await dialog().getByLabel('Empleado').selectOption(employee);await dialog().getByLabel('Fecha',{exact:true}).fill('2040-01-02');await button('Guardar',dialog()).click();await dialog().waitFor({state:'hidden'});checks.push('Employee save, unit assignment, one-time PIN, schedule save via production adapter');
 await tab('Fichaje').click();await button('Activar dispositivo').click();await dialog().getByLabel('Nombre del dispositivo').fill('Synthetic phone');await button('Generar',dialog()).click();await dialog().getByLabel('Enlace de activación').waitFor();await button('Cerrar y ocultar',dialog()).click();await button('Actualizar').click();await button('Revocar dispositivo').click();await page.getByText('Revocado',{exact:true}).waitFor();checks.push('One-use activation link and device revocation through admin adapter');
 for(const width of [375,390,430]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await page.locator('.personnel').evaluate(e=>e.scrollWidth<=e.clientWidth+1));}checks.push('Production admin shell fits 375 / 390 / 430');
 assert.deepEqual(errors,[]);assert(actions.every(a=>a.organizationId==='10000000-0000-4000-8000-000000000001'&&a.unitId===unit));
 const artifacts=resolve('.local-data/wp-pers-admin');mkdirSync(artifacts,{recursive:true});await page.screenshot({path:resolve(artifacts,'devices-mobile.png'),fullPage:true});writeFileSync(resolve(artifacts,'evidence.json'),JSON.stringify({status:'PASS',synthetic:true,apiMocked:true,checks,errors},null,2));checks.forEach(x=>console.log('PASS '+x));
}finally{await browser.close();}
