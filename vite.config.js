import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev
export default defineConfig({
  plugins: [react()],
  base: '/sistemas/criollo/', // 👈 AGREGA ESTA LÍNEA
})

