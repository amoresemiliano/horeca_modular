import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getAppConfig, getSafeDiagnosticConfig, AppEnvironment } from '../../src/shared/config/env';

beforeAll(() => {
  vi.stubEnv('VITE_APP_ENV', 'development');
  vi.stubEnv('VITE_SUPABASE_URL', 'https://vmxjqwlfwnphorthhcwu.supabase.co');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_fixture_only');
});
afterAll(() => vi.unstubAllEnvs());

describe('Environment Configuration & Contract (Scope H)', () => {
  it('loads valid default application configuration', () => {
    const config = getAppConfig();
    expect(config).toBeDefined();
    expect([AppEnvironment.DEVELOPMENT, AppEnvironment.UAT, AppEnvironment.PRODUCTION]).toContain(
      config.environment
    );
    expect(config.supabase.url).toMatch(/^https?:\/\//);
    expect(config.supabase.publishableKey.length).toBeGreaterThan(5);
  });

  it('produces secret-safe diagnostic metadata without leaking key credentials', () => {
    const safeMeta = getSafeDiagnosticConfig();
    expect(safeMeta.environment).toBeDefined();
    expect(safeMeta.supabaseUrl).toBeDefined();
    expect(safeMeta.supabaseKeyFingerprint).toMatch(/^sb_publishab.*\.\.\..*/);
    expect(safeMeta).not.toHaveProperty('supabaseKey');
  });
});
