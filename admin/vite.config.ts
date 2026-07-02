import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_TARGET = process.env.VITE_API_PROXY || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router', 'react-router-dom'],
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    proxy: {
      '^/auth': {
        target: API_TARGET,
        changeOrigin: true,
      },
      '^/admin/(health|usage|invite_tester|upload|offers|promotions|regions|invite_codes|profiles|users)': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
})
