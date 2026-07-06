import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_TARGET = process.env.VITE_API_PROXY || 'http://127.0.0.1:8000'

/** SPA routes under /admin — must not be proxied to the API on browser refresh. */
const ADMIN_UI_GET_PATHS = new Set([
  '/admin',
  '/admin/testers',
  '/admin/invite-codes',
  '/admin/regions',
  '/admin/content',
  '/admin/users',
  '/admin/user-data',
  '/admin/user-activity',
  '/admin/tools',
  '/admin/activity-log',
])

function adminApiBypass(req: { method?: string; headers?: { accept?: string }; url?: string }) {
  const accept = req.headers?.accept || ''
  if (req.method !== 'GET' || !accept.includes('text/html')) return undefined
  const path = (req.url || '').split('?')[0].replace(/\/$/, '') || '/admin'
  if (ADMIN_UI_GET_PATHS.has(path)) return '/admin/index.html'
  return undefined
}

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
      '^/admin/(health|me|usage|invite_tester|upload|offers|promotions|regions|invite_codes|profiles|users|activity_log|user_activity|user_data|chat_prompt)': {
        target: API_TARGET,
        changeOrigin: true,
        bypass: adminApiBypass,
      },
    },
  },
})
