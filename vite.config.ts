import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { appOrigin, checkSupabaseKey, deploymentEnvironment, supabaseTarget } from './src/shared/config/environmentBoundary';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const environment = deploymentEnvironment(env.VITE_APP_ENV || 'development', env.VERCEL_ENV, env.VERCEL === '1');
  // Fail during hosted builds, before an invalid production artifact is emitted.
  if (env.VERCEL_ENV || environment === 'production') {
    const target = supabaseTarget(environment, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PROJECT_REF);
    appOrigin(environment, env.VITE_APP_ORIGIN);
    checkSupabaseKey(env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '', target.projectRef, 'anon');
  }
  return {
    define: { 'import.meta.env.VITE_DEPLOYMENT_ENV': JSON.stringify(env.VERCEL_ENV || 'local') },
    plugins: [react()],
    build: { rollupOptions: { input: { app: path.resolve(__dirname, 'index.html'), personnel: path.resolve(__dirname, 'personal/fichaje/index.html') } } },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
