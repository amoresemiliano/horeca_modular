import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve('tests/browser/admin_read');
const server = await createServer({ configFile:false, root, plugins:[{name:'fixture-alias',enforce:'pre',resolveId(source) { if (source.endsWith('/context/AuthContext')) return resolve(root,'auth.js'); if (source.endsWith('/lib/tenantAdminService')) return resolve(root,'service.js'); }},react()], server:{host:'127.0.0.1',port:5198,strictPort:true,fs:{allow:[resolve('.')]}} });
let browser;
try {
 await server.listen(); browser = await chromium.launch({channel:process.env.ACCESS_BROWSER_CHANNEL || 'chrome',headless:true});
 const page=await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5198/');
 for (const [card,expected] of [['Usuarios','Usuario sintético'],['Roles y permisos','Gerente'],['Auditoría de la organización','Rol actualizado']]) {
  await page.getByRole('button',{name:new RegExp('^'+card)}).click(); await page.getByText(expected).first().waitFor();
  assert.equal(await page.locator('input, select, textarea').count(),0);
  assert.equal(await page.getByRole('button',{name:/invitar|asignar|guardar|crear|modificar/i}).count(),0);
  await page.getByRole('button',{name:'← Configuración'}).click();
 }
 assert.equal(await page.getByRole('button',{name:/^Tenants|^Módulos/}).count(),0); assert.deepEqual(errors,[]);
 console.log('PASS: read-only Configuration fixture');
} finally { await browser?.close(); await server.close(); }
