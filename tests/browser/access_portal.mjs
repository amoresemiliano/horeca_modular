import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const artifacts = resolve(process.env.ACCESS_BROWSER_ARTIFACTS || '.local-data/access-portal');
mkdirSync(artifacts, { recursive: true });
const report = { checks: [], layouts: [], pageErrors: [], liveNetworkRequests: 0 };
const pass = check => { report.checks.push(check); console.log('PASS ' + check); };
const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'access-regression@test.invalid', email_confirmed_at: new Date().toISOString(), app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'synthetic-signature'].join('.');
const session = { access_token: jwt, token_type: 'bearer', expires_in: 3600, refresh_token: 'synthetic-refresh-token', user };
const browser = await chromium.launch({ channel: process.env.ACCESS_BROWSER_CHANNEL || 'chrome', headless: true });
let server;

async function fixture(origin, options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const requests = [];
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin === origin) return route.continue();
    if (url.hostname !== 'vmxjqwlfwnphorthhcwu.supabase.co') return route.abort();
    requests.push({ path: url.pathname, query: url.search, method: req.method(), body: req.postDataJSON() });
    const respond = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname.endsWith('/token')) {
      await new Promise(resolve => setTimeout(resolve, 180));
      return options.rejectLogin ? respond({ code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400) : respond(session);
    }
    if (url.pathname.endsWith('/recover')) return options.rejectRecovery ? respond({ msg: 'Supabase internal secret diagnostic' }, 500) : respond({});
    if (url.pathname.endsWith('/user')) return respond(user);
    if (url.pathname.endsWith('/logout')) return respond({});
    // Missing active profile must stay fail-closed despite a valid auth session.
    if (url.pathname.endsWith('/eco_user_profiles')) return respond(null);
    if (url.pathname.endsWith('/authorize')) return route.fulfill({ contentType: 'text/html', body: '<h1>OAuth network fixture</h1>' });
    throw new Error('Unexpected network operation: ' + req.method() + ' ' + url.pathname);
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(error.message));
  return { context, page, requests };
}

async function open(page, origin, path = '/') {
  await page.goto(origin + path);
  await page.getByRole('heading', { name: /sesión para continuar|Recupera tu acceso|Configura tu contraseña|Authenticated test session/ }).waitFor();
}

try {
  for (const [environment, enabled, port] of [['development', true, 5191], ['production', true, 5192], ['production', false, 5193]]) {
    const origin = `http://127.0.0.1:${port}`;
    server = await createServer({ configFile: false, root: resolve('tests/browser/access'), plugins: [react()], define: {
      'import.meta.env.VITE_APP_ENV': JSON.stringify(environment),
      'import.meta.env.VITE_DEV_PASSWORD_AUTH': JSON.stringify(enabled ? 'true' : 'false'),
      'import.meta.env.VITE_PASSWORD_AUTH': JSON.stringify(enabled ? 'true' : 'false'),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://vmxjqwlfwnphorthhcwu.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_synthetic_access_fixture'),
    }, server: { host: '127.0.0.1', port, strictPort: true, fs: { allow: [resolve('.')] } } });
    await server.listen();

    if (!enabled) {
      const { context, page, requests } = await fixture(origin);
      await open(page, origin);
      assert.equal(await page.locator('input[type=password]').count(), 0);
      await page.getByRole('button', { name: 'Acceder con Google' }).click();
      await page.getByRole('heading', { name: 'OAuth network fixture' }).waitFor();
      assert(requests.some(r => r.path.endsWith('/authorize') && r.query.includes('provider=google')));
      await open(page, origin);
      await page.getByRole('button', { name: 'Acceder con GitHub' }).click();
      await page.getByRole('heading', { name: 'OAuth network fixture' }).waitFor();
      assert(requests.some(r => r.path.endsWith('/authorize') && r.query.includes('provider=github')));
      pass('OAuth Google/GitHub remain available when password flags are disabled');
      await context.close();
      await server.close(); server = null;
      continue;
    }

    const f = await fixture(origin);
    await open(f.page, origin);
    assert.equal(await f.page.getByText('Solicitar un nuevo enlace de acceso', { exact: true }).count(), 0);
    assert.equal(await f.page.locator('details').count(), 0);
    assert.equal(await f.page.getByText(/DEV-ONLY/).count(), environment === 'production' ? 0 : 1);
    assert.equal(await f.page.locator('.access-chip').count(), 8);
    assert.deepEqual(await f.page.locator('.access-chip > span:first-of-type').allTextContents(), ['Bancos', 'KPIs', 'Personal', 'Producción', 'Inventarios', 'Escandallos', 'Predicciones', 'Decisiones']);
    pass(environment + ': correct flags, eight chips, no normal-login recovery control');

    if (environment === 'production') {
      for (const width of [375, 390, 430, 768, 1024, 1440]) {
        await f.page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
        await f.page.evaluate(() => document.fonts.ready);
        const layout = await f.page.evaluate(() => {
          const form = document.querySelector('.access-form').getBoundingClientRect();
          return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, formTop: form.top, formBottom: form.bottom, inputs: [...document.querySelectorAll('input')].map(e => ({ height: e.getBoundingClientRect().height, font: getComputedStyle(e).fontSize })), buttons: [...document.querySelectorAll('button')].map(e => e.getBoundingClientRect().height) };
        });
        assert(layout.scrollWidth <= width, 'Horizontal overflow at ' + width);
        assert(layout.inputs.every(i => i.height >= 44 && parseFloat(i.font) >= 16));
        assert(layout.buttons.every(h => h >= 44));
        if (width < 768) assert(layout.formBottom <= 844, 'Mobile submit must fit the initial viewport');
        await f.page.screenshot({ path: `${artifacts}/production-${width}.png`, fullPage: true });
        report.layouts.push(layout);
      }
      await f.page.setViewportSize({ width: 390, height: 500 });
      await f.page.getByLabel('Contraseña', { exact: true }).focus();
      await f.page.getByRole('button', { name: 'Iniciar sesión', exact: true }).scrollIntoViewIfNeeded();
      assert(await f.page.getByRole('button', { name: 'Iniciar sesión', exact: true }).isVisible());
      pass('Six responsive targets, touch sizes, 16px inputs, reduced-height keyboard reachability');
    }

    await f.page.getByLabel('Email', { exact: true }).fill(user.email);
    await f.page.getByLabel('Contraseña', { exact: true }).fill('synthetic-password-only');
    await f.page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    await f.page.getByRole('heading', { name: 'Authenticated test session' }).waitFor();
    assert(f.requests.some(r => r.path.endsWith('/token') && r.body.email === user.email && r.body.password === 'synthetic-password-only'));
    await f.page.getByText('Tenant access denied', { exact: true }).waitFor();
    await f.page.reload();
    await f.page.getByRole('heading', { name: 'Authenticated test session' }).waitFor();
    assert.equal(f.requests.filter(r => r.path.endsWith('/token')).length, 1);
    await f.page.getByRole('button', { name: 'Sign out test session' }).click();
    await f.page.getByRole('button', { name: 'Iniciar sesión', exact: true }).waitFor();
    pass(environment + ': real auth password path, session restore, logout and missing-profile denial');

    await open(f.page, origin, '/reset-password#error=access_denied&error_code=otp_expired');
    await f.page.getByRole('alert').waitFor();
    assert((await f.page.getByRole('alert').innerText()).includes('caducado'));
    await f.page.getByLabel('Correo para recuperar el acceso').fill(user.email);
    await f.page.getByRole('button', { name: 'Enviar enlace de recuperación' }).click();
    await f.page.getByText(/Se ha solicitado el enlace/).waitFor();
    assert(f.requests.some(r => r.path.endsWith('/recover') && new URLSearchParams(r.query).get('redirect_to') === origin + '/reset-password'));
    pass(environment + ': controlled recovery retains same-origin redirect and expired-link handling');
    await open(f.page, origin, '/reset-password?code=synthetic-pkce-code');
    await f.page.getByLabel('Nueva contraseña').waitFor();
    assert(f.requests.some(r => r.path.endsWith('/token') && r.query.includes('grant_type=pkce') && r.body.auth_code === 'synthetic-pkce-code' && r.body.code_verifier));
    pass(environment + ': PKCE recovery callback exchanges the browser-held verifier');
    await f.context.close();

    for (const type of ['recovery', 'invite']) {
      const c = await fixture(origin);
      await open(c.page, origin, `/reset-password#access_token=${jwt}&refresh_token=synthetic-refresh-token&expires_in=3600&token_type=bearer&type=${type}`);
      await c.page.getByLabel('Nueva contraseña').waitFor();
      await c.page.getByLabel('Nueva contraseña').fill('synthetic-new-password');
      await c.page.getByRole('button', { name: 'Guardar nueva contraseña' }).click();
      await c.page.getByRole('heading', { name: 'Authenticated test session' }).waitFor();
      assert(c.requests.some(r => r.path.endsWith('/user') && r.method === 'PUT' && r.body.password === 'synthetic-new-password'));
      assert.equal(new URL(c.page.url()).pathname, '/');
      pass(environment + ': ' + type + ' callback uses real token/session and password-update runtime');
      await c.context.close();
    }

    const bad = await fixture(origin, { rejectLogin: true, rejectRecovery: true });
    await open(bad.page, origin);
    await bad.page.getByLabel('Email', { exact: true }).fill(user.email);
    await bad.page.getByLabel('Contraseña', { exact: true }).fill('wrong-synthetic-password');
    await bad.page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    await bad.page.getByRole('alert').waitFor();
    assert((await bad.page.getByRole('alert').innerText()).includes('Credenciales inválidas'));
    await open(bad.page, origin, '/reset-password');
    await bad.page.getByLabel('Correo para recuperar el acceso').fill(user.email);
    await bad.page.getByRole('button', { name: 'Enviar enlace de recuperación' }).click();
    await bad.page.getByRole('alert').waitFor();
    assert(!(await bad.page.locator('body').innerText()).includes('Supabase internal secret diagnostic'));
    pass(environment + ': invalid credentials and recovery errors stay accessible and sanitized');
    await bad.context.close();
    await server.close(); server = null;
  }
  assert.deepEqual(report.pageErrors, []);
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.failure = error.message; process.exitCode = 1; console.error(error.message);
} finally {
  if (server) await server.close();
  await browser.close();
  writeFileSync(artifacts + '/evidence.json', JSON.stringify(report, null, 2));
}
