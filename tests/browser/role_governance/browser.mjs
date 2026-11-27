import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||pathToFileURL(resolve('../el_criollo_modular/.local-data/tooling/node_modules/playwright/index.mjs')).href);
const root=resolve('tests/browser/role_governance');
const server=await createServer({configFile:false,root,plugins:[{name:'fixture',enforce:'pre',resolveId(source){if(source.endsWith('/context/AuthContext'))return resolve(root,'auth.js');if(source.endsWith('/lib/tenantAdminService'))return resolve(root,'service.js');}},react()],server:{host:'127.0.0.1',port:5199,strictPort:true,fs:{allow:[resolve('.')]}}});let browser;
try {
 await server.listen();browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5199/');await page.getByRole('button',{name:/^Roles y permisos/}).click();await page.getByRole('button',{name:'Nuevo rol'}).click();
 await page.getByLabel('Nombre',{exact:true}).fill('Rol sintético');await page.getByLabel('Código',{exact:true}).fill('TEST_ROLE');await page.getByLabel('Descripción').fill('Prueba');await page.getByText('Administración de organización',{exact:true}).click();await page.getByLabel('Ver usuarios Consulta').check();await page.getByRole('button',{name:'Guardar'}).click();
 const role=page.locator('article').filter({hasText:'Rol sintético'});await role.getByRole('button',{name:'Abrir'}).click();await page.getByRole('button',{name:'Editar',exact:true}).click();await page.getByLabel('Nombre',{exact:true}).fill('Rol editado');await page.getByRole('button',{name:'Guardar'}).click();
 await page.locator('article').filter({hasText:'Rol editado'}).getByRole('button',{name:'Clonar'}).click();await page.getByLabel('Nombre',{exact:true}).fill('Copia sintética');await page.getByLabel('Código',{exact:true}).fill('TEST_CLONE');await page.getByRole('button',{name:'Guardar'}).click();
 page.once('dialog',dialog=>dialog.accept());await page.locator('article').filter({hasText:'Copia sintética'}).getByRole('button',{name:'Desactivar'}).click();await page.locator('article').filter({hasText:'Copia sintética'}).getByText(/Inactivo/).waitFor();
 await page.getByRole('button',{name:'← Configuración'}).click();await page.getByRole('button',{name:/^Usuarios y accesos/}).click();await page.getByLabel('Usuario a administrar').selectOption('member');await page.getByLabel('Rol base').selectOption('TEST_ROLE');await page.getByText('Cambios guardados').waitFor();
 await page.goto('http://127.0.0.1:5199/?manager');await page.getByRole('button',{name:/^Roles y permisos/}).click();await page.getByRole('heading',{name:'Gerente'}).waitFor();assert.equal(await page.getByRole('button',{name:/Nuevo rol|Editar|Clonar|Desactivar/}).count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: role governance and read-only fixture');
}finally{await browser?.close();await server.close();}
