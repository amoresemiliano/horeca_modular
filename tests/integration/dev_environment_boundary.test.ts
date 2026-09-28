import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('HORECA DEV project boundary', () => {
  async function config(url: string, key = 'test-public-key-only') {
    vi.resetModules();
    vi.stubEnv('VITE_APP_ENV', 'development');
    vi.stubEnv('VITE_SUPABASE_URL', url);
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', key);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
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
    await expect(config(url)).rejects.toThrow('HORECA DEV must use project');
  });

  it('rejects missing browser credentials instead of selecting a hardcoded key', async () => {
    await expect(config('https://vmxjqwlfwnphorthhcwu.supabase.co', '')).rejects.toThrow();
  });
});
