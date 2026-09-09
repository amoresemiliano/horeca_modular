import { describe, it, expect } from 'vitest';
import { getAppConfig, getSafeDiagnosticConfig, AppEnvironment } from '../../src/shared/config/env';

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
