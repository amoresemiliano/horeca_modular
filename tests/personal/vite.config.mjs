import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
// Test-only auth adapter: never imported by the application entry or production build.
export default defineConfig({ root: resolve('tests/personal'), envDir: false, plugins: [react()], define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://vmxjqwlfwnphorthhcwu.supabase.co'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_synthetic_tests_only') }, resolve: { alias: [{ find: /.*context\/AuthContext(\.jsx)?$/, replacement: resolve('tests/personal/auth.jsx') }, { find: /.*lib\/supabase(\.js)?$/, replacement: resolve('tests/browser/financeSupabase.js') }] }, server: { host: '127.0.0.1', port: 5194, strictPort: true, fs: { allow: [resolve('.')] } } });
