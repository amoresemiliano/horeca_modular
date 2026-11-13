import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('HORECA independent environment boundary', () => {
  async function config(url: string, key = 'test-public-key-only', environment = 'development') {
    vi.resetModules();
    vi.stubEnv('VITE_APP_ENV', environment);
    vi.stubEnv('VITE_SUPABASE_URL', url);
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', key);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.stubEnv('VITE_SUPABASE_PROJECT_REF', '');
    vi.stubEnv('VITE_APP_ORIGIN', '');
    return (await import('../../src/shared/config/env')).getAppConfig();
  }

  it('accepts only the canonical hosted DEV origin', async () => {
    const result = await config('https://vmxjqwlfwnphorthhcwu.supabase.co');
    expect(result.supabase.url).toBe('https://vmxjqwlfwnphorthhcwu.supabase.co');
  });

  it.each([
    'https://unrelated-project.supabase.co',
    'https://vmxjqwlfwnphorthhcwu.supabase.co.attacker.invalid',
  ])('rejects another project before creating a client: %s', async url => {
    await expect(config(url)).rejects.toThrow('Supabase URL does not match');
  });

  it('rejects missing browser credentials instead of selecting a hardcoded key', async () => {
    await expect(config('https://vmxjqwlfwnphorthhcwu.supabase.co', '')).rejects.toThrow();
  });

  it('rejects staging and missing project identity in production', async () => {
    await expect(config('https://vmxjqwlfwnphorthhcwu.supabase.co', 'test-public-key-only', 'production')).rejects.toThrow('independent Supabase project');
  });

  it.each(['https://ourzapkjykzlwsjunzmd.supabase.co', 'https://unrelated-project.supabase.co'])('rejects foreign backends in production: %s', async url => {
    await expect(config(url, 'test-public-key-only', 'production')).rejects.toThrow('independent Supabase project');
  });

  it('accepts only the explicitly configured independent production project and origin', async () => {
    vi.stubEnv('VITE_APP_ENV', 'production');vi.stubEnv('VITE_SUPABASE_PROJECT_REF', 'p'.repeat(20));
    vi.stubEnv('VITE_SUPABASE_URL', `https://${'p'.repeat(20)}.supabase.co`);vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY','sb_publishable_synthetic_config_test');
    vi.stubEnv('VITE_APP_ORIGIN','https://personnel.example.invalid');
    const result=(await import('../../src/shared/config/env')).getAppConfig();
    expect(result.isProduction).toBe(true);expect(result.supabase.url).not.toContain('vmxjqwlfwnphorthhcwu');
  });
});
