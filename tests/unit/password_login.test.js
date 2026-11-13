import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ isPasswordRecovery: false }) }));
vi.mock('../../src/components/access/LoginHero', () => ({ default: () => null }));
vi.mock('../../src/components/access/LoginPanel', () => ({ default: ({ children }) => React.createElement('div', null, children) }));
import Login from '../../src/components/Login';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function render(pathname = '/') {
  vi.stubGlobal('window', { location: { pathname, hash: '' } });
  return renderToStaticMarkup(React.createElement(Login));
}
describe('Production password login and recovery', () => {
  it('offers password login with an OTP alternative without enabling DEV', () => {
    vi.stubEnv('VITE_APP_ENV', 'production'); vi.stubEnv('VITE_PASSWORD_AUTH', 'true'); vi.stubEnv('VITE_DEV_PASSWORD_AUTH', 'false');
    const html = render();
    expect(html.toLowerCase()).toContain('autocomplete="current-password"');
    expect(html).toContain('Entrar con código por correo');
    expect(html).toContain('href="/reset-password"');
    expect(html).not.toContain('DEV-ONLY');
  });
  it('keeps production DEV shortcuts disabled and OTP available when password login is disabled', () => {
    vi.stubEnv('VITE_APP_ENV', 'production'); vi.stubEnv('VITE_PASSWORD_AUTH', 'false'); vi.stubEnv('VITE_DEV_PASSWORD_AUTH', 'true');
    const html = render();
    expect(html).not.toContain('type="password"'); expect(html).not.toContain('DEV-ONLY');
    expect(html).toContain('Recibir código de acceso');
  });
  it('exposes the recovery request route in production', () => {
    vi.stubEnv('VITE_APP_ENV', 'production'); vi.stubEnv('VITE_PASSWORD_AUTH', 'true');
    expect(render('/reset-password')).toContain('Enviar enlace de recuperación');
  });
});
