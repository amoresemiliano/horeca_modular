import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';
export default defineConfig({root:resolve('tests/browser'),plugins:[react()],resolve:{alias:[
 {find:/.*context\/AuthContext$/,replacement:resolve('tests/browser/financeAuth.jsx')},
 {find:/.*lib\/extractosService$/,replacement:resolve('tests/browser/financeService.js')},
 {find:/.*lib\/supabase\.js$/,replacement:resolve('tests/browser/financeSupabase.js')},
]},server:{host:'127.0.0.1',port:5187,strictPort:true,fs:{allow:[resolve('.')]}},build:{outDir:resolve('.local-data/browser-build')}});
