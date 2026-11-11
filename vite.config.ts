import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { input: { app: path.resolve(__dirname, 'index.html'), personnel: path.resolve(__dirname, 'personal/fichaje/index.html') } } },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
