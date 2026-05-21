## Module: Urgent announcements (Wilaya → communes)

### Purpose & constraints

- Wilaya admins with **`announcements.manage`** publish **plain-text** notices shown on the **commune home hub** (`/` for `MUNI_ADMIN`).
- **Priority** drives colour: `important` (amber/orange) vs `urgent` (red).
- **Lifecycle**: `active` announcements are visible; `finished` announcements **disappear** from commune UI immediately after status change.
- **Targeting**: `municipality_id` **NULL** = all communes; otherwise only that commune.
- **No HTML** in body — plain text only (strip/sanitize on server).
- See `spec/CORE.md` for auth, blocking, audit, RTL/FR, snackbar, and Zod validation.

### Roles & rules

| Actor | Scope |
| ----- | ----- |
| **`SUPER_ADMIN`** with `announcements.manage` | Create, update (including mark `finished`), list all announcements. |
| **`SUPER_ADMIN`** with `announcements.view` only | List/read; no create/edit. |
| **`MUNI_ADMIN`** with `announcements.view` | Read **active** announcements for own `municipality_id` (global + scoped). No write. |

**Permission keys** (see `spec/modules/ACCESS_PROFILES.md`):

| Key | Scope |
| --- | ----- |
| `announcements.view` | both |
| `announcements.manage` | wilaya |

### Data model

**Table: `municipality_announcements`**

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | BIGINT PK | |
| `municipality_id` | BIGINT FK → `municipalities`, nullable | `NULL` = all communes |
| `priority` | ENUM `important` \| `urgent` | UI colour |
| `status` | ENUM `active` \| `finished` | Only `active` shown to communes |
| `body_text` | TEXT | Plain text, max 2000 chars |
| `display_date` | DATE | Shown as `DD-MM-YYYY:` prefix on commune hub |
| `created_by_user_id` | BIGINT FK → `users` | |
| `created_at`, `updated_at` | TIMESTAMP | `updated_at` drives sync revision |

**Indexes:** `(status, municipality_id)`, `(display_date DESC)` for listing.

### Workflows

#### Publish (wilaya)

1. Admin opens `/announcements` (hub tile under **Commune & organisation**).
2. Create: `body_text`, `priority`, optional `municipality_id`, `display_date` (default today).
3. `POST /admin/announcements` → status `active`, audit `ANNOUNCEMENT_CREATE`.

#### Mark finished

1. Admin sets status to `finished` on edit or list action.
2. `PATCH` → row hidden from commune endpoints; audit `ANNOUNCEMENT_UPDATE`.

#### Commune display

1. On hub load, `GET /muni/announcements/active` returns active rows for user's commune, ordered by **`display_date` DESC**, then `id` DESC.
2. Each row: date prefix + **marquee** text (scroll direction follows UI language: RTL Arabic → right-to-left, LTR French → left-to-right). Animation **pauses ~4s** at the end of each cycle so users can read.
3. Rows stacked vertically (latest date on top).

#### Lightweight sync (all commune screens)

- Poll **`GET /muni/announcements/revision`** every **60s** (same app shell as mail unread; no full list until revision changes).
- Response: `{ revision: number }` — monotonic integer bumped when any **visible** announcement for that commune is inserted/updated/finished.
- On revision change → fetch `GET /muni/announcements/active` once.
- Typical payload: revision ~8 bytes; active list only when changed.

### API endpoints

**Admin** (`SUPER_ADMIN`), base `/admin/announcements`:

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| `GET` | `/admin/announcements` | `announcements.view` | Query: `page`, `pageSize` (≤100), `q`, `status`, `municipality_id`. Order: `display_date` DESC, `id` DESC. |
| `POST` | `/admin/announcements` | `announcements.manage` | Create; `validateBody`. |
| `PATCH` | `/admin/announcements/:id` | `announcements.manage` | Partial update; `validateBody`. |

**Municipality** (`MUNI_ADMIN`), base `/muni/announcements`:

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| `GET` | `/muni/announcements/revision` | `announcements.view` | `{ revision }` for sync |
| `GET` | `/muni/announcements/active` | `announcements.view` | `{ announcements: [{ id, priority, body_text, display_date }] }` |

### UI/UX

- **Wilaya hub:** tile → `/announcements` (permission `announcements.manage` for create; `announcements.view` for read-only list).
- **Commune hub:** announcement stack **above** hub sections (not on every sub-page unless revision hook is global — optional thin refresh only via revision poll in app shell).
- **Form validation:** `frontend/src/validation/schemas/announcement.ts` — `body_text`, `priority`, optional `municipality_id`, `display_date`, `status` on edit.
- i18n keys: `announcement*` prefix in `frontend/src/i18n.ts` (AR + FR).

### Audit events (minimum)

| action_type | When |
| ----------- | ---- |
| `ANNOUNCEMENT_CREATE` | New row |
| `ANNOUNCEMENT_UPDATE` | Edit or status → `finished` |

`details`: `id`, `municipality_id`, `status`, `priority`.

### Non-functional requirements

- Revision endpoint must be cheap (single aggregate query per commune scope).
- Body text capped at 2000 characters server-side.
- Finished rows retained in DB for audit/history (admin list can filter `finished`).

### Migration / compatibility notes

- Migration: `backend/src/db/migrations/20260601_000023_municipality_announcements.js`
- Seeds new permission rows on system role templates from `defaultRolePermissions.js`.
- Backend: `backend/src/modules/announcements/`, routes `announcementsAdmin.js`, `announcementsMuni.js`.
