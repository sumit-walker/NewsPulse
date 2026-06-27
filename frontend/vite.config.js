import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/articles': { target: 'http://localhost:3001', changeOrigin: true },
      '/clusters': { target: 'http://localhost:3001', changeOrigin: true },
      '/timeline': { target: 'http://localhost:3001', changeOrigin: true },
      '/ingest': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})
