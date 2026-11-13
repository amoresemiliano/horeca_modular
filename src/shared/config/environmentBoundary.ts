export const STAGING_PROJECT_REF = 'vmxjqwlfwnphorthhcwu';
export const STAGING_SUPABASE_URL = `https://${STAGING_PROJECT_REF}.supabase.co`;
export type Environment = 'development' | 'uat' | 'production';

export function deploymentEnvironment(environment: string, deployment?: string, hosted = false): Environment {
  if (hosted && !deployment) throw new Error('Hosted deployment metadata required');
  if (!['development', 'uat', 'production'].includes(environment)) throw new Error('Invalid application environment');
  if (deployment === 'production' && environment !== 'production') throw new Error('Production deployment requires production configuration');
  if (deployment && !['local', 'production'].includes(deployment) && environment === 'production') throw new Error('Production configuration forbidden in non-production deployment');
  return environment as Environment;
}

export function supabaseTarget(environment: Environment, url?: string, projectRef?: string) {
  if (environment === 'production' && (!projectRef || !/^[a-z]{20}$/.test(projectRef) || projectRef === STAGING_PROJECT_REF)) {
    throw new Error('Production requires an explicit independent Supabase project reference');
  }
  const expected = environment === 'production' ? projectRef! : STAGING_PROJECT_REF;
  if (projectRef && projectRef !== expected) throw new Error('Non-production must use the staging project');
  const actual = url || (environment === 'production' ? '' : STAGING_SUPABASE_URL);
  if (actual !== `https://${expected}.supabase.co`) throw new Error('Supabase URL does not match the environment project');
  return { url: actual, projectRef: expected };
}

export function appOrigin(environment: Environment, value?: string) {
  if (!value && environment !== 'production') return undefined;
  let parsed: URL;
  try { parsed = new URL(value || ''); } catch { throw new Error('Explicit HTTPS application origin required'); }
  if (parsed.protocol !== 'https:' || parsed.origin !== value || parsed.username || parsed.password) throw new Error('Explicit HTTPS application origin required');
  if (environment === 'production' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname.includes('-git-') || parsed.hostname.endsWith('-vegen-s-projects.vercel.app'))) {
    throw new Error('Production cannot use a local or preview origin');
  }
  return value;
}

// This is a configuration consistency check, not JWT verification. Supabase
// authenticates every credential. Modern opaque keys need target-side validation.
export function checkSupabaseKey(key: string, projectRef: string, role: 'anon' | 'service_role') {
  if (!key || (role === 'anon' && key.startsWith('sb_secret_')) || (role === 'service_role' && key.startsWith('sb_publishable_'))) throw new Error('Invalid Supabase credential role');
  if (key.split('.').length !== 3) return;
  let claims: { ref?: string; role?: string };
  try { claims = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); }
  catch { throw new Error('Malformed Supabase credential'); }
  if (claims.ref !== projectRef || claims.role !== role) throw new Error('Supabase credential belongs to another project or role');
}
