import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig({root:resolve('tests/personal'),envDir:false,plugins:[react()],define:{'import.meta.env.VITE_PERSONNEL_ATTENDANCE_ENABLED':'"true"','import.meta.env.VITE_SUPABASE_URL':'"https://vmxjqwlfwnphorthhcwu.supabase.co"','import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':'"sb_publishable_synthetic_tests_only"'},resolve:{alias:[{find:/.*context\/AuthContext(\.jsx)?$/,replacement:resolve('tests/personal/auth.jsx')},{find:/.*lib\/supabase(\.js)?$/,replacement:resolve('tests/personal/liveSupabase.js')}]},server:{host:'127.0.0.1',port:5196,strictPort:true,fs:{allow:[resolve('.')]}}});
