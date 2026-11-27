import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import config from './live.vite.config.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || pathToFileURL(resolve('../el_criollo_modular/.local-data/tooling/node_modules/playwright/index.mjs')).href);
const server=await createServer({...config,configFile:false}); let browser;
try {
 await server.listen(); browser=await chromium.launch({channel:'chrome',headless:true});
 for(const readonly of [false,true]) {
  const page=await browser.newPage(), errors=[], actions=[];page.on('pageerror',e=>errors.push(e.message));
  const unit='20000000-0000-4000-8000-000000000001',employee='30000000-0000-4000-8000-000000000001';
  const raw={units:[{id:unit,name:'Unidad sintética',timeZone:'Europe/Madrid'}],employees:[{id:employee,first_name:'Empleado',last_name:'Sintético',employment_status:'ACTIVE'}],employment:[],assignments:[{employee_id:employee,operational_unit_id:unit}],schedules:[],punches:[],corrections:[],observations:[],devices:[]};
  await page.route('**/api/personnel',async route=>{const body=route.request().postDataJSON(),p=body.payload; actions.push(body.action); if(body.action==='schedule.save') raw.schedules=[{id:'shift',employee_id:employee,operational_unit_id:unit,local_date:p.date,expected_start_time:p.start,expected_end_time:p.end,expected_start_at:p.date+'T09:00:00Z',expected_end_at:p.date+'T17:00:00Z',timezone:'Europe/Madrid',revision:(p.revision||0)+1}]; if(body.action==='schedule.cancel') raw.schedules=[];await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body.action==='snapshot'?raw:{})});});
  await page.goto('http://127.0.0.1:5196/granular.html'+(readonly?'?readonly':'')); await page.getByRole('heading',{name:'Horarios previstos'}).waitFor();
  if(readonly) {
   raw.schedules=[{id:'shift',employee_id:employee,operational_unit_id:unit,local_date:'2040-01-02',expected_start_time:'09:00',expected_end_time:'17:00',expected_start_at:'2040-01-02T09:00:00Z',expected_end_at:'2040-01-02T17:00:00Z',timezone:'Europe/Madrid',revision:1}];
   await page.getByLabel('Semana desde').fill('2040-01-02'); await page.getByText('Empleado Sintético').waitFor();
   assert.equal(await page.getByRole('button',{name:/Programar turno|Editar turno|Cancelar turno/}).count(),0);
  }
  else {
   await page.getByRole('button',{name:'+ Programar turno'}).click(); const dialog=page.getByRole('dialog'); await dialog.getByLabel('Empleado').selectOption(employee);await dialog.getByLabel('Fecha',{exact:true}).fill('2040-01-02'); await dialog.getByRole('button',{name:'Guardar',exact:true}).click();await dialog.waitFor({state:'hidden'});
   await page.getByLabel('Semana desde').fill('2040-01-02'); await page.getByRole('button',{name:'Editar turno'}).click();await dialog.getByRole('button',{name:'Guardar',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.getByRole('button',{name:'Cancelar turno'}).click();
   assert.equal(actions.filter(x=>x==='schedule.save').length,2);assert(actions.includes('schedule.cancel'));
  }
  await page.getByRole('button',{name:'Empleados',exact:true}).click();await page.getByText('Empleado Sintético').waitFor();assert.equal(await page.getByRole('button',{name:/Nuevo empleado|Editar|PIN/}).count(),0);
  await page.getByRole('button',{name:'Asistencia',exact:true}).click();await page.getByRole('heading',{name:'Asistencia del equipo'}).waitFor();assert.equal(await page.getByRole('button',{name:/Corregir|dispositivo/i}).count(),0);assert.equal(await page.getByRole('button',{name:'Fichaje',exact:true}).count(),0);assert.deepEqual(errors,[]); await page.close();
 }
 console.log('PASS: synthetic schedule manager and schedule viewer');
} finally {await browser?.close();await server.close();}
