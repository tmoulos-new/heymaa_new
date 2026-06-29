# HeyMaa Admin (React)

Admin dashboard for HeyMaa, served at `/admin` by the FastAPI backend.

## Development

```bash
cd admin
npm install
npm run dev
```

Opens at http://localhost:5174 and talks to the API at `http://127.0.0.1:8000` (start the backend first).

## Production build

```bash
cd admin
npm run build
```

The backend serves `admin/dist` at `/admin`. Rebuild after UI changes and restart/redeploy the API.

## Environment

- `VITE_API_URL` — override API base (optional)
