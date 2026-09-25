import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/** Resolve API proxy target from .env* / shell (not exposed as client API base). */
function resolveApiTarget(mode: string) {
  const env = loadEnv(mode, process.cwd(), '')
  return env.VITE_API_PROXY || process.env.VITE_API_PROXY || 'http://127.0.0.1:8010'
}

/** SPA routes under /admin — must not be proxied to the API on browser refresh. */
const ADMIN_UI_GET_PATHS = new Set([
  '/admin',
  '/admin/insights',
  '/admin/quality',
  '/admin/testers',
  '/admin/invite-codes',
  '/admin/regions',
  '/admin/levels',
  '/admin/plans',
  '/admin/points',
  '/admin/content',
  '/admin/sources',
  '/admin/users',
  '/admin/user-data',
  '/admin/user-activity',
  '/admin/tools',
  '/admin/activity-log',
  '/admin/chat-prompt',
  '/admin/llm-transactions',
  '/admin/user-financials',
])

function adminApiBypass(req: { method?: string; headers?: { accept?: string }; url?: string }) {
  const accept = req.headers?.accept || ''
  if (req.method !== 'GET' || !accept.includes('text/html')) return undefined
  const path = (req.url || '').split('?')[0].replace(/\/$/, '') || '/admin'
  if (ADMIN_UI_GET_PATHS.has(path)) return '/admin/index.html'
  return undefined
}

export default defineConfig(({ mode }) => {
  const API_TARGET = resolveApiTarget(mode)
  return {
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
        '^/admin/(health|me|usage|insights|chat-quality|credits|llm_transactions|invite_tester|upload|offers|promotions|regions|levels|plans|point_rules|point_settings|rag_sources|invite_codes|profiles|users|activity_log|user_activity|user_data|chat_prompt|llm_routing|subscription-cancellations)': {
          target: API_TARGET,
          changeOrigin: true,
          bypass: adminApiBypass,
        },
      },
    },
  }
})
