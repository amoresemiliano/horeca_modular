import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
// For a separate worktree set PLAYWRIGHT_MODULE via the launcher below instead
// if its .local-data/tooling directory is not present (see docs/PERSONNEL-PWA.md).
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || pathToFileURL(resolve('.local-data/tooling/node_modules/playwright/index.mjs')).href);
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
const artifacts=resolve('docs/evidence/wp-pers-002/browser-pwa');mkdirSync(artifacts,{recursive:true});
const errors=[],checks=[],requests=[],committed=new Map();let active=false,revoked=false,offline=false,uncertain=false,kind='IN',punches=0;
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/personnel-punch',async route=>{
 if(offline)return route.abort('internetdisconnected');
 const body=route.request().postDataJSON();requests.push(body);
 let result,status=200;
 if(body.action==='activate'){active=true;result={ok:true};}
 else if(!active||revoked){result={error:'INVALID_DEVICE'};status=400;}
 else if(body.action==='session')result={organization:'HORECA DEV LAB',unit:'Synthetic unit',timeZone:'Europe/Madrid'};
 else if(body.action==='punch'){
  result=committed.get(body.requestId);
  if(!result){punches++;result={id:'10000000-0000-4000-8000-000000000001',kind,firstName:'Synthetic',occurredAt:new Date().toISOString()};committed.set(body.requestId,result);kind=kind==='IN'?'OUT':'IN';}
  if(uncertain){uncertain=false;result={error:'OPERATION_UNAVAILABLE'};status=503;}
 }
 else result={ok:true};
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
});
await page.addInitScript(() => { window.__permissionRequests = 0; if ('Notification' in window) Notification.requestPermission = async () => { window.__permissionRequests++; return 'denied'; }; });
await page.route('**/api/personnel-push', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({enabled:false,publicKey:'synthetic-key-unused-when-denied'})}));
const pass=name=>{checks.push(name);console.log('PASS '+name);};
const enter=async()=>{for(const key of '1842')await page.getByRole('button',{name:key,exact:true}).click();};
try{
 const base=process.env.PERSONNEL_PWA_TEST_URL||'http://127.0.0.1:5195';
 await page.goto(base+'/personal/fichaje/#activate='+'A'.repeat(43));await page.getByRole('heading',{name:'Introduce tu PIN'}).waitFor();
 assert.equal(new URL(page.url()).hash,'');assert.equal(await page.getByRole('navigation').count(),0);assert.equal(await page.locator('aside').count(),0);
 assert.equal(requests[0].action,'activate');pass('One-time fragment removed; dedicated entry has no auth/admin shell');
 assert.equal(await page.evaluate(()=>window.__permissionRequests),0);
 if(await page.getByText('Recordatorios de tu turno',{exact:true}).count()) {
  await page.getByText('Recordatorios de tu turno',{exact:true}).click();
  await page.getByLabel('Tu PIN para asociar recordatorios').fill('1842');
  await page.getByRole('button',{name:'Activar recordatorios',exact:true}).click();
  await page.getByRole('status').filter({hasText:'desactivados por el navegador'}).waitFor();
  assert.equal(await page.evaluate(()=>window.__permissionRequests),1);pass('Explicit push opt-in; denied permission leaves attendance available');
 }
 await page.reload();await page.getByRole('heading',{name:'Introduce tu PIN'}).waitFor();pass('Reload resumes server-authorized device session without local credential storage');
 for(const width of [375,390,430,768,1024,1440]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 pass('375 / 390 / 430 / 768 / 1024 / 1440 fit without overflow');await page.setViewportSize({width:390,height:844});
 await enter();await page.getByRole('heading',{name:'Entrada registrada'}).waitFor();await page.waitForTimeout(4700);await page.getByRole('heading',{name:'Introduce tu PIN'}).waitFor();
 await enter();await page.getByRole('heading',{name:'Salida registrada'}).waitFor();await page.getByRole('button',{name:'Añadir observación'}).click();await page.getByLabel('Observación').fill('Synthetic note');await page.getByRole('button',{name:'Guardar observación'}).click();await page.getByRole('heading',{name:'Introduce tu PIN'}).waitFor();pass('IN / OUT confirmations and separate optional observation');
 assert(requests.filter(r=>r.action==='punch').every(r=>Object.keys(r).sort().join(',')==='action,pin,requestId'));pass('No client employee, tenant, unit, timestamp or authority supplied by punch UI');
 await page.screenshot({path:resolve(artifacts,'punch-mobile.png'),fullPage:true});
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});offline=true;await context.setOffline(true);
 // Offline request fails instead of confirming, storing or replaying a punch.
 await enter();await page.getByRole('alert').filter({hasText:'No hay conexión. No se pudo registrar el fichaje.'}).waitFor();assert.equal(punches,2);
 offline=false;await context.setOffline(false);assert.equal(punches,2);pass('Offline punch fails visibly and is never queued');
 uncertain=true;await enter();await page.getByRole('alert').filter({hasText:'No se pudo completar'}).waitFor();
 const pending=requests.filter(r=>r.action==='punch').at(-1).requestId;
 await enter();await page.getByRole('heading',{name:'Entrada registrada'}).waitFor();assert.equal(requests.filter(r=>r.action==='punch').at(-1).requestId,pending);assert.equal(punches,3);pass('Uncertain server delivery retries one idempotency key instead of toggling attendance');
 await page.addInitScript(()=>{ delete window.PushManager; });await page.reload();await page.getByRole('heading',{name:'Introduce tu PIN'}).waitFor();await page.getByText(/Este navegador no admite recordatorios/).waitFor();pass('Unsupported PushManager leaves PIN attendance available');
 revoked=true;await page.reload();await page.getByRole('alert').filter({hasText:'revocado'}).waitFor();assert.equal(await page.getByRole('button',{name:'1',exact:true}).count(),0);pass('Revoked device reload fails closed');
 const manifest=JSON.parse(readFileSync('public/personal/fichaje/manifest.webmanifest','utf8'));assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'/personal/fichaje/');
 assert.deepEqual(errors,[]);writeFileSync(resolve(artifacts,'evidence.json'),JSON.stringify({status:'PASS',synthetic:true,apiMocked:true,checks,errors},null,2));
}catch(error){await page.screenshot({path:resolve(artifacts,'failure.png'),fullPage:true});console.error((await page.locator('body').innerText()).slice(0,2000));throw error;}finally{await browser.close();}
