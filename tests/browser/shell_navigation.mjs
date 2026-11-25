import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || pathToFileURL(resolve('../el_criollo_modular/.local-data/tooling/node_modules/playwright/index.mjs')).href);

const server = await createServer({ configFile: 'tests/personal/vite.config.mjs' });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://127.0.0.1:5194/');
  await page.getByRole('heading', { name: 'Inicio', exact: true }).waitFor();
  await page.getByRole('button', { name: /Personal.*Disponible/ }).click();
  await page.getByRole('heading', { name: 'Hoy', exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('module'), 'Personal');
  await page.reload();
  await page.getByRole('heading', { name: 'Hoy', exact: true }).waitFor();
  await page.goBack();
  await page.getByRole('heading', { name: 'Inicio', exact: true }).waitFor();
  await page.goForward();
  await page.getByRole('heading', { name: 'Hoy', exact: true }).waitFor();
  await page.goto('http://127.0.0.1:5194/?module=Bancos&section=Consolidado');
  await page.getByRole('heading', { name: 'Inicio', exact: true }).waitFor();
  console.log('Dashboard, permitted navigation, refresh, history and forbidden route: PASS');
} finally {
  await browser?.close();
  await server.close();
}
