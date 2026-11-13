import { appOrigin, deploymentEnvironment, supabaseTarget } from '../src/shared/config/environmentBoundary.js';

// Shared environment guard for every server-side Supabase client. It does not
// grant domain authority; caller JWTs/RLS and domain commands remain mandatory.
export function serverSupabaseTarget() {
  const environment = deploymentEnvironment(process.env.APP_ENV || 'development', process.env.VERCEL_ENV, process.env.VERCEL === '1');
  if (!process.env.SUPABASE_URL) throw new Error('Supabase URL required');
  const target = supabaseTarget(environment, process.env.SUPABASE_URL, process.env.SUPABASE_PROJECT_REF);
  const origin = appOrigin(environment, process.env.APP_ORIGIN);
  if (environment === 'production' && (process.env.VITE_APP_ENV !== 'production' || process.env.VITE_SUPABASE_URL !== target.url || process.env.VITE_SUPABASE_PROJECT_REF !== target.projectRef || process.env.VITE_APP_ORIGIN !== origin)) throw new Error('Frontend/server production configuration mismatch');
  return { ...target, environment, origin };
}
