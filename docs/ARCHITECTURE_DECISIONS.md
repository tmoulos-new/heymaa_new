# Architecture decisions (HeyMaa)

Reusable patterns from this project for admin CMS apps on **Supabase + FastAPI + React**. Copy the ideas, not necessarily the exact table names.

---

## Stack overview

| Layer | Choice | Why |
|-------|--------|-----|
| Database | Supabase (Postgres) | Auth, RLS, storage, RPC |
| Admin API | FastAPI + service-role client | Single backend validates JWT, bypasses RLS safely |
| Admin UI | Vite React SPA at `/admin/` | Separate bundle, proxied in dev |
| End-user auth | Supabase Auth JWT in `x-token` header | Same token for app users and admins |
| Migrations | SQL files in `backend/migrations/` | Run manually in Supabase SQL Editor; idempotent where possible |

---

## 1. Soft delete (`is_deleted`)

**Decision:** Never hard-delete content rows from admin. Set `is_deleted = true` instead.

**Tables:** `offers`, `promotions`, `regions`, `invite_codes`

**Schema:**

```sql
ALTER TABLE offers ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_offers_is_deleted ON offers (is_deleted) WHERE is_deleted = false;
```

**Partial indexes** on `WHERE is_deleted = false` keep public/admin “active” lists fast.

**API contract:**

- `DELETE /admin/{resource}/{id}` → `UPDATE … SET is_deleted = true` (log as `soft_delete`)
- `POST /admin/{resource}/{id}/restore` → `SET is_deleted = false` (log as `restore`)
- List endpoints accept `?deleted_only=true` to show trash; default lists exclude deleted

**Shared helper (Python):**

```python
def _apply_deleted_filter(query, deleted_only=False, include_deleted=False):
    if deleted_only:
        return query.eq("is_deleted", True)
    if not include_deleted:
        return query.eq("is_deleted", False)
    return query
```

**Public reads:** Always filter `is_deleted = false` in backend queries and RPCs. Junction joins should hide deleted regions (`_region_is_visible`).

**Admin UI:** Toggle “Show deleted”, style rows with `.is-deleted`, offer Restore vs Delete.

**Why not `deleted_at`?** Boolean + default false is enough for this app; timestamps live in the activity log. Use `deleted_at` if you need “purge after N days” jobs.

---

## 2. Creator / owner on records (`user_id`)

**Decision:** Every admin-created content row stores **who created it** as `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT`.

**Tables:** `offers`, `promotions`, `regions`, `invite_codes`

**On create:** Set `user_id` from `verify_admin(x_token)` (the acting admin’s auth UUID).

**On read:** Resolve display names in the API layer, not in SQL:

```python
def _attach_creator_names(rows):
    name_map = _creator_name_map([r.get("user_id") for r in rows])
    for row in rows:
        row["created_by_name"] = name_map.get(str(row.get("user_id")), "Unknown")
    return rows
```

**Backfill migration:** Existing rows get a known admin UUID before `SET NOT NULL`.

**Reuse in new apps:** Same column on any entity where you need “created by” in lists or audit context. Keep FK to `auth.users`, not a loose email string.

---

## 3. Activity log (audit trail)

**Decision:** Append-only `activity_log` table; never update/delete log rows from the app.

**Schema:**

```sql
CREATE TABLE activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}',
  value_before jsonb,
  value_after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

**Actions:** `insert`, `update`, `delete`, `soft_delete`, `restore`, `upload`, `seed`, `invite_tester`, `set_role`, `reset_password`, etc.

**Write pattern:**

1. Load **before** snapshot (include junction data in snapshot, e.g. `region_ids`)
2. Perform mutation
3. Load **after** snapshot
4. `_log_activity(admin_id, action, entity_type, entity_id, value_before=…, value_after=…)`

**Snapshots:** Strip computed fields (`image_url`). Merge junction IDs into snapshot for meaningful diffs.

**Read API:** `GET /admin/activity_log` with filters + server sort + pagination (see §5).

**Display:** Resolve `user_id` → `actor_name` post-query (same as creator names). UI shows diff-only columns via `diffSnapshots()` (ignore noisy keys like `updated_at`).

**Failure mode:** Logging swallows errors so a broken log never blocks admin work.

---

## 4. Many-to-many regions (junction tables)

**Decision:** Regions are first-class entities; offers/promotions link via junction tables, not embedded arrays on the parent row.

**Schema:**

```sql
CREATE TABLE offer_regions (
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  region_id uuid NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  PRIMARY KEY (offer_id, region_id)
);
-- Same pattern: promotion_regions
```

**Sync pattern (replace-all):**

```python
def _sync_offer_regions(offer_id, region_ids):
    sb.table("offer_regions").delete().eq("offer_id", offer_id).execute()
    if region_ids:
        sb.table("offer_regions").insert(
            [{"offer_id": offer_id, "region_id": rid} for rid in region_ids]
        ).execute()
```

**Why replace-all:** Simple, idempotent, easy to audit (`region_ids` in before/after snapshots). Fine for small cardinalities.

**Enrichment:** When listing offers, batch-load junction + region rows and attach `regions` / `region_ids` on each parent.

**Public filtering:** RPCs / queries join junction → regions and match user language against `regions.languages[]`.

**Reuse:** Use `{entity}_{related}` naming, composite PK, index on the non-PK FK (`region_id`).

---

## 5. Sortable headers + pagination (admin tables)

**Decision:** Sort and page on the **server**; never load hundreds of rows for client-side sort.

**Query params:**

| Param | Purpose | Example |
|-------|---------|---------|
| `sort_by` | Whitelist of column names | `created_at`, `user_id`, `action`, `entity_type` |
| `sort_dir` | `asc` \| `desc` | Default `created_at` + `desc` for “newest first” |
| `limit` | Page size | `10` |
| `offset` | `(page - 1) * limit` | `0`, `10`, … |

**Response shape:**

```json
{ "entries": [...], "total": 142 }
```

Use Supabase `select("*", count="exact").range(offset, offset + limit - 1)`.

**Frontend pattern:**

- State: `page`, `sortBy`, `sortDir`, filters
- Reset `page` to `1` when filters or sort change
- Click header: same column toggles direction; new column uses sensible default (dates → `desc`, text → `asc`)
- Pagination bar: “Showing 11–20 of 142”, Previous/Next, clamp page when `total` shrinks

**Security:** Always validate `sort_by` against a fixed set server-side (`ACTIVITY_LOG_SORT_COLUMNS`).

---

## 6. Admin authentication

**Decision:** Admin UI sends Supabase JWT in **`x-token`** header on every API call. Backend validates via service-role client.

**Flow:**

1. `POST /auth/login` → password sign-in via **dedicated** auth client (not the shared service client)
2. Return JWT to browser → `sessionStorage`
3. `GET /admin/health` with `x-token` confirms `users.role = 'admin'`
4. All `/admin/*` routes call `verify_admin(x_token)` first

**Critical:** Do **not** call `sign_out()` on the shared service-role client after login—it revokes the session you just issued.

```python
def _user_auth_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def _sign_in_with_password_as_user(email, password):
    return _user_auth_client().auth.sign_in_with_password({...})
```

**Bootstrap:** Optional `BOOTSTRAP_ADMIN_EMAIL` promotes first login to admin if no admin exists.

**End-user auth:** Same `x-token` header; `resolve_auth()` accepts invite code **or** JWT. Profiles keyed by `token` (beta) or `user_id` (auth).

---

## 7. SPA refresh vs API path collision

**Problem:** Routes like `/admin/regions` match both the React route and `/admin/regions` API. On refresh, browser sends `Accept: text/html` and the dev proxy forwarded to FastAPI → “Missing x-token”.

**Decision:** If `GET` + `Accept: text/html` + path in admin UI allowlist → serve SPA shell, not API.

**Implementations:**

- Dev (combined port 3002): `frontend/src/setupProxy.js` — `isAdminApi()` returns false for HTML navigations
- Dev (admin Vite 5174): `admin/vite.config.ts` — `adminApiBypass()`
- Production: `vercel.json` rewrites with `"has": [{ "type": "header", "key": "accept", "value": ".*text/html.*" }]`

**Maintain:** When adding admin tabs, add the UI path to `ADMIN_UI_GET_PATHS` in both proxy configs.

---

## 8. Public data access (SECURITY DEFINER RPCs)

**Decision:** Public pages do not rely on wide-open table SELECT. Use **`SECURITY DEFINER`** functions with explicit filters.

Example: `get_active_offers(p_lang)` filters `active`, expiry, region/language via junction joins.

**After soft delete:** Ensure RPCs and public backend paths also filter `is_deleted = false` (direct queries already do).

**Grants:** `REVOKE ALL FROM PUBLIC`; `GRANT EXECUTE TO anon, authenticated`.

---

## 9. Row Level Security (RLS)

**Pattern:**

1. Enable RLS on sensitive tables
2. Backend admin uses **service role** (bypasses RLS)
3. Migrations split: table DDL → separate `*_rls_policies.sql`
4. User-owned data: `USING (user_id = auth.uid())`

Junction tables (`offer_regions`, `promotion_regions`) get their own policies file alongside `regions`.

---

## 10. Admin UI conventions

| Pattern | Detail |
|---------|--------|
| Token storage | `sessionStorage` key `hm_admin_token` |
| Fetch wrapper | `adminFetch(path)` attaches `x-token`, handles 401/403 logout |
| Audit display | `ValuePairs` component for key/value JSON; `diffSnapshots` for changed fields only |
| Entity ID | Show human label + monospace `entity_id` under Entity column |
| Images | Store `image_key` in DB; compute `image_url` in API via storage public URL |

---

## 11. Migration file conventions

- One concern per file: `regions.sql`, `is_deleted_soft_delete.sql`, `activity_log.sql`, `content_user_id.sql`
- Header comment: purpose + “Run in Supabase SQL Editor”
- Idempotent: `IF NOT EXISTS`, `DROP POLICY IF EXISTS` before `CREATE POLICY`
- End with `NOTIFY pgrst, 'reload schema';` when PostgREST should pick up changes
- Order matters: orphans cleanup → auth FK → RLS policies

---

## 12. Checklist for a new app

### Database

- [ ] `is_deleted boolean NOT NULL DEFAULT false` + partial index on active rows
- [ ] `user_id uuid NOT NULL REFERENCES auth.users(id)` on admin-managed tables
- [ ] Junction tables for M2M with composite PK + FK index on lookup column
- [ ] `activity_log` with indexes on `created_at`, `user_id`, `action`, `entity_type`, `entity_id`

### Backend

- [ ] Service-role Supabase client for admin; separate client for password login
- [ ] `verify_admin(x_token)` on all `/admin/*` routes
- [ ] `_apply_deleted_filter`, soft delete + restore endpoints
- [ ] `_log_activity` on every mutating admin action with before/after snapshots
- [ ] List endpoints: `deleted_only`, whitelisted `sort_by`/`sort_dir`, `limit`/`offset`, `total` count
- [ ] Public reads: RPC or queries that exclude `is_deleted` and inactive rows

### Admin frontend

- [ ] `adminFetch` with `x-token`
- [ ] Sortable table headers + page size constant (e.g. 10)
- [ ] “Show deleted” + restore actions
- [ ] Activity log with filters, diff-only Before/After columns
- [ ] Register new SPA routes in proxy bypass lists

### Dev / deploy

- [ ] Vite proxy bypass for HTML GET on admin UI paths
- [ ] Vercel (or CDN) rewrite for `Accept: text/html` on `/admin/*`

---

## Reference files (this repo)

| Topic | Location |
|-------|----------|
| Soft delete SQL | `backend/migrations/is_deleted_soft_delete.sql` |
| Activity log SQL | `backend/migrations/activity_log.sql` |
| Creator `user_id` SQL | `backend/migrations/content_user_id.sql` |
| Regions + junctions | `backend/migrations/regions.sql` |
| Admin API logic | `backend/main.py` |
| Activity log UI | `admin/src/tabs/ActivityLogTab.tsx` |
| Diff helper | `admin/src/lib/diffSnapshots.ts` |
| Dev proxy | `frontend/src/setupProxy.js`, `admin/vite.config.ts` |
| Production SPA rewrites | `vercel.json` |

---

*Last updated from HeyMaa implementation (soft delete, activity log sort/pagination, auth proxy fixes).*

**Skill:** `heymaa-admin-architecture` — `~/.claude/skills/heymaa-admin-architecture/` and `~/.cursor/skills/heymaa-admin-architecture/`
