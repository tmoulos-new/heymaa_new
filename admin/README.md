# HeyMaa Admin (React)

Admin dashboard for HeyMaa, served at `/admin` on the same host as the main app.

## Development

**Recommended (merged with frontend at `/admin`):**

```bash
# Terminal 1 — API
cd backend && .venv/bin/uvicorn main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2 — admin UI (Vite, proxied by frontend)
cd admin && npm run dev

# Terminal 3 — main app + /admin proxy
cd frontend && npm start
```

Open http://localhost:3002/admin/users — tab URLs are persisted in the browser (e.g. `/admin/users`, `/admin/testers`).

**Standalone admin UI:**

```bash
cd admin && npm run dev
```

Opens at http://localhost:5174/admin/ (API calls are proxied to `http://127.0.0.1:8000`).

## Production build

```bash
cd admin
npm run build
```

The backend serves `admin/dist` at `/admin`. Rebuild after UI changes and restart/redeploy the API.

## Admin access

Admins sign in with a normal HeyMaa account (email + password). Users are created at `/auth` with no admin role. An existing admin can grant the **admin** role under **Users** in the dashboard.

For the first admin when none exist yet, set `BOOTSTRAP_ADMIN_EMAIL` in `backend/.env` to a registered user's email — they receive admin on first login.

Run the role migration once in Supabase SQL editor:

`backend/migrations/users_role.sql`

## Environment

- `VITE_API_URL` — override API base (optional)
