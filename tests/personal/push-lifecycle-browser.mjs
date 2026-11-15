import assert from 'node:assert/strict';import fs from 'node:fs';
const {chromium}=await import('../../../el_criollo_modular/.local-data/tooling/node_modules/playwright/index.mjs');
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext(),page=await context.newPage();const actions=[],errors=[];let enabled=false;
const publicKey=Buffer.alloc(65,3).toString('base64url');
await context.addInitScript(()=>{
 const state={permission:'default',nextPermission:'granted',permissionRequests:0,subscriptions:0,unsubscribes:0,subscription:null};window.__pushFixture=state;
 const sub=key=>({options:{applicationServerKey:key.buffer},unsubscribe:async()=>{state.unsubscribes++;state.subscription=null;return true;},toJSON:()=>({endpoint:'https://fcm.googleapis.com/fcm/send/synthetic-fixture',keys:{p256dh:'synthetic',auth:'synthetic'}})});
 state.oldKey=()=>{state.subscription=sub(new Uint8Array(65).fill(9));};
 const registration={pushManager:{getSubscription:async()=>state.subscription,subscribe:async({applicationServerKey})=>{state.subscriptions++;state.subscription=sub(applicationServerKey);return state.subscription;}}};
 Object.defineProperty(navigator,'serviceWorker',{value:{ready:Promise.resolve(registration),register:async()=>registration}});
 Object.defineProperty(window,'Notification',{value:{get permission(){return state.permission;},requestPermission:async()=>{state.permissionRequests++;state.permission=state.nextPermission;return state.permission;}}});
});
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/personnel-punch',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({organization:'Synthetic tenant',unit:'Synthetic unit',timeZone:'Europe/Madrid'})}));
await page.route('**/api/personnel-push',async r=>{const b=r.request().postDataJSON();actions.push(b.action);if(b.action==='subscribe'){assert.equal(b.pin,'1648');assert(b.subscription.endpoint.includes('synthetic-fixture'));enabled=true;}if(b.action==='unsubscribe')enabled=false;await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({enabled,publicKey})});});
const open=async()=>{await page.getByText('Recordatorios de tu turno',{exact:true}).click();await page.getByLabel('Tu PIN para asociar recordatorios').waitFor();};
const enable=async()=>{await page.getByLabel('Tu PIN para asociar recordatorios').fill('1648');await page.getByRole('button',{name:'Activar recordatorios',exact:true}).click();};
try{
 await page.goto('http://127.0.0.1:5204/personal/fichaje/');await open();assert.equal(await page.evaluate(()=>window.__pushFixture.permissionRequests),0);await enable();await page.getByRole('button',{name:'Desactivar recordatorios',exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.__pushFixture.subscriptions),1);assert.equal(actions.filter(a=>a==='subscribe').length,1);
 await page.reload();await open();await page.getByText('Vuelve a activar los recordatorios en este dispositivo para renovar la suscripción.').waitFor();assert.equal(await page.evaluate(()=>window.__pushFixture.permissionRequests),0);assert.equal(await page.evaluate(()=>window.__pushFixture.subscriptions),0);
 await page.evaluate(()=>window.__pushFixture.nextPermission='denied');await enable();await page.getByText('Recordatorios desactivados por el navegador. Puedes seguir fichando.').waitFor();assert.equal(actions.filter(a=>a==='subscribe').length,1);assert.equal(await page.getByLabel('Tu PIN para asociar recordatorios').inputValue(),'');await page.getByRole('heading',{name:'Introduce tu PIN'}).waitFor();
 await page.evaluate(()=>{window.__pushFixture.nextPermission='granted';window.__pushFixture.oldKey();});await enable();await page.getByRole('button',{name:'Desactivar recordatorios',exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.__pushFixture.unsubscribes),1);assert.equal(await page.evaluate(()=>window.__pushFixture.subscriptions),1);
 await page.getByRole('button',{name:'Desactivar recordatorios',exact:true}).click();await page.getByRole('button',{name:'Activar recordatorios',exact:true}).waitFor();assert.equal(enabled,false);assert.equal(await page.evaluate(()=>window.__pushFixture.subscription),null);
 assert.deepEqual(errors,[]);fs.mkdirSync('.local-data/push-provision',{recursive:true});const report={status:'PASS',fixturesOnly:true,permissionOnlyOnExplicitSubmit:true,pinConfirmedBinding:true,missingBrowserSubscriptionOffersExplicitRenewal:true,deniedPermissionDoesNotSubscribe:true,oldVapidKeyReplacedOnlyOnExplicitSubmit:true,unsubscribeBothSides:true,attendanceUnaffected:true};fs.writeFileSync('.local-data/push-provision/browser-lifecycle.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
