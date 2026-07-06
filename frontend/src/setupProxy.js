const { createProxyMiddleware } = require('http-proxy-middleware')

const API_TARGET = process.env.REACT_APP_API_PROXY || 'http://127.0.0.1:8000'
const ADMIN_VITE = process.env.REACT_APP_ADMIN_DEV || 'http://localhost:5174'

const ADMIN_API_EXACT = new Set([
  '/admin/health',
  '/admin/me',
  '/admin/usage',
  '/admin/invite_tester',
  '/admin/profiles/seed',
  '/admin/users/delete_all',
  '/admin/activity_log',
])

const ADMIN_API_PREFIXES = [
  '/admin/upload/',
  '/admin/offers',
  '/admin/promotions',
  '/admin/regions',
  '/admin/invite_codes',
  '/admin/user_data',
  '/admin/users',
  '/admin/profiles/',
]

const ADMIN_UI_GET_PATHS = new Set([
  '/admin',
  '/admin/testers',
  '/admin/invite-codes',
  '/admin/regions',
  '/admin/content',
  '/admin/users',
  '/admin/user-data',
  '/admin/tools',
  '/admin/activity-log',
])

function wantsHtml(req) {
  return (req.headers.accept || '').includes('text/html')
}

function isAdminApi(pathname, req) {
  if (req.method === 'GET' && wantsHtml(req) && ADMIN_UI_GET_PATHS.has(pathname)) {
    return false
  }
  if (ADMIN_API_EXACT.has(pathname)) return true
  return ADMIN_API_PREFIXES.some(
    (prefix) => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix),
  )
}

function isAdminUi(pathname) {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

module.exports = function setupProxy(app) {
  app.use(
    '/auth',
    createProxyMiddleware({
      target: API_TARGET,
      changeOrigin: true,
    }),
  )

  app.use(
    createProxyMiddleware((pathname, req) => isAdminApi(pathname, req), {
      target: API_TARGET,
      changeOrigin: true,
    }),
  )

  app.use(
    createProxyMiddleware(
      (pathname, req) => isAdminUi(pathname) && !isAdminApi(pathname, req),
      {
        target: ADMIN_VITE,
        changeOrigin: true,
        ws: true,
      },
    ),
  )
}
