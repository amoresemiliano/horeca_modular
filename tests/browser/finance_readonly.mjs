import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'vite';
import config from './finance.vite.config.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||pathToFileURL(resolve('../el_criollo_modular/.local-data/tooling/node_modules/playwright/index.mjs')).href);
const server=await createServer({...config,configFile:false});let browser;
try{await server.listen();browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5187/finance_readonly.html');await page.locator('tbody tr').first().waitFor();
 for(const label of ['Importar extracto','Editar clasificación','Gestionar cuentas','Aplicar reglas'])assert.equal(await page.getByRole('button',{name:label,exact:true}).count(),0);
 await page.getByRole('button',{name:'Resumen',exact:true}).click();await page.getByRole('heading',{name:'Resumen bancario'}).waitFor();
 await page.getByRole('button',{name:'Métricas',exact:true}).click();await page.getByRole('heading',{name:/Métricas|Gráficas/}).first().waitFor();assert.deepEqual(errors,[]);console.log('PASS: read-only finance sections');
}finally{await browser?.close();await server.close();}
