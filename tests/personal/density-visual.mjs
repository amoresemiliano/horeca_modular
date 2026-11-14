import fs from 'node:fs';import assert from 'node:assert/strict';import {fixtures,org,unit,user} from './density-fixtures.mjs';
const {chromium}=await import('../../../el_criollo_modular/.local-data/tooling/node_modules/playwright/index.mjs');const browser=await chromium.launch({channel:'chrome',headless:true});
const metrics={};fs.mkdirSync('.local-data/density-evidence',{recursive:true});
try{for(const [name,port] of [['before',5198],['after',5201]]){
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();await page.clock.install({time:new Date('2040-11-05T08:00:00Z')});
 await context.addInitScript(({org,unit,user})=>localStorage.setItem('horeca-context-v1:'+user,JSON.stringify({organizationId:org,unitId:unit,navigationScope:'organization',module:'Personal',section:'Hoy'})),{org,unit,user});
 await page.route('**/api/personnel',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixtures())}));
 await page.goto(`http://127.0.0.1:${port}/context.html?module=Personal&section=Hoy`);await page.locator('.per-attendance-card').first().waitFor();
 metrics[name]={attendance:(await page.locator('.per-attendance-card').first().boundingBox()).height};
 await page.locator('main').evaluate(e=>e.scrollTop=0);await page.screenshot({path:`.local-data/density-evidence/${name}-today.png`,fullPage:true});
 for(const section of ['Horarios','Empleados','Fichaje']){
  await page.locator('aside').getByRole('button',{name:section,exact:true}).click();
  await page.locator('.personnel').waitFor();await page.waitForTimeout(150);
  if(section==='Horarios')metrics[name].calendar=(await page.locator('.per-day article').first().boundingBox()).height;
  if(section==='Empleados')metrics[name].employee=(await page.locator(name==='after'?'.per-employee-row':'.per-record-grid > article').first().boundingBox()).height;
  await page.locator('main').evaluate(e=>e.scrollTop=0);await page.screenshot({path:`.local-data/density-evidence/${name}-${section.toLowerCase()}-desktop.png`,fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.locator('main').evaluate(e=>e.scrollTop=0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`.local-data/density-evidence/${name}-${section.toLowerCase()}-mobile.png`,fullPage:true});await page.setViewportSize({width:1440,height:1000});
 }
 await context.close();
}for(const key of ['attendance','calendar','employee'])assert(metrics.after[key]<metrics.before[key],key+' should be denser');fs.writeFileSync('.local-data/density-evidence/visual-comparison.json',JSON.stringify(metrics,null,2));console.log(JSON.stringify({status:'PASS',metrics}));}finally{await browser.close();}
