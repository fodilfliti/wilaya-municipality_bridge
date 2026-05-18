## Module: Organization (Wilaya) — Communes & Commune agents

### Purpose & constraints
- Central place for **Wilaya** (`SUPER_ADMIN`) to manage **organizational structure** used across the Bridge.
- **Communes** (municipalities) and **commune agents** (users) are **intentionally separate** surfaces so each can gain independent features later (imports, validation rules, bulk actions, etc.).
- Data primitives align with `spec/modules/APPS.md` (Municipalities, Users, audit, blocking).

### Roles & rules
- **SUPER_ADMIN**:
  - Full access to commune CRUD and to creating/managing `MUNI_ADMIN` users for selected communes.
- **MUNI_ADMIN**:
  - No access to this module (commune agents do not manage other communes or Wilaya users).

### Data model
- Reuse existing entities:
  - **Municipalities**: `id`, `name_ar`, `name_fr`, `code`, …
  - **Users**: `username`, `name`, `role`, `municipality_id`, `is_blocked`, …
- **User profile & access** (optional fields and role template): see `spec/modules/ACCESS_PROFILES.md` — `job_title`, `department_id`, `email`, `email_hidden`, `access_role_template_id`, `use_custom_permissions`, `can_manage_access_roles`, `can_create_wilaya_admins`.
- No merge table required for “commune + agent” beyond `Users.municipality_id`.

### Workflows

#### Flow 1 — Communes (municipalities only)
- List with search/pagination.
- Create / edit / (optional) deactivate commune fields.
- **Does not** require creating a user in the same step.

#### Flow 2 — Commune agents (users only)
- Consolidated Wilaya table of all `MUNI_ADMIN` accounts (see UI below).
- Create user for a commune: `MUNI_ADMIN`, credentials per global rules (PDF, 8-digit code, block/unblock, reset password).
- Optional filter by commune; search across username, name, commune code/names.

#### Flow 3 — Wilaya admins (`SUPER_ADMIN` accounts)
- Consolidated Wilaya table at `/wilaya-admins` (separate from commune agents).
- Columns: username, name, **account type** (compte wilaya), status, can create admins, actions.
- Assign **access role template** (`WILAYA_*` slugs) and optional profile fields — `spec/modules/ACCESS_PROFILES.md`.
- Create: only users with `can_create_wilaya_admins = true` (`POST /admin/wilaya-admins`).
- Reset password, block/unblock via `POST /admin/users/:userId/...`; **cannot block own account** (button hidden on self row).

Future features (placeholders): bulk import, export, extra municipality metadata, departments CRUD API.

### API endpoints
- Defer to implementation naming; typical split:
  - `GET/POST/PATCH /admin/municipalities...`
  - `GET/POST/PATCH /admin/users...` (scoped by `municipality_id` for commune agents)
- **Wilaya consolidated commune agents list** (`SUPER_ADMIN`):
  - `GET /admin/commune-agents` — Query: `page`, `pageSize` (≤100), `q` (search username, name, commune code/names), optional `municipality_id`. Response: `rows` (`MUNI_ADMIN` only, with joined commune), `total`, `page`, `pageSize`. Order: commune **code** ASC, then `id` ASC.
- **Wilaya consolidated wilaya admins list** (`SUPER_ADMIN`):
  - `GET /admin/wilaya-admins` — Query: `page`, `pageSize` (≤100), `q` (username, name). Response: `rows` (`SUPER_ADMIN`: `username`, `name`, `is_blocked`, `can_create_wilaya_admins`, `can_manage_access_roles`; phase 2 adds `job_title`, `department`, `access_role_template`, `email` when exposed). Order: `id` ASC.
  - `GET /admin/wilaya-admins?brief=1` — Legacy shape `{ admins: [{ id, name, role }] }` for mail/pickers.
  - `POST /admin/wilaya-admins` — Create (requires `can_create_wilaya_admins` on caller).
- Per-commune CRUD unchanged: `GET/POST /admin/municipalities/:municipalityId/users`, `POST /admin/users/:userId/reset|block|unblock`.
- **Access profiles API** (wilaya): `GET/POST /admin/access/...` — `spec/modules/ACCESS_PROFILES.md`.
- Must enforce role + `checkBlocked`; audit user lifecycle events per Core. Phase 2: `requirePermission` per module key.

### UI/UX
- **Two separate routes** (or two primary actions on an Administration landing—see `spec/CORE.md`).
- Clear labels: commune management vs agent management.
- Do not combine into one modal unless only as a convenience shortcut that still calls the same two APIs separately (optional).
- **Wilaya hub — two account tiles** (separate routes, per Core):
  - **Wilaya accounts** (`/wilaya-admins`) — UI label **« compte wilaya »** / **« حساب ولاية »** (backend role `SUPER_ADMIN`); never show raw enum in UI.
  - **Commune accounts** (`/users`) — UI label **« compte commune »** / **« حساب بلدية »** (backend role `MUNI_ADMIN`); commune filter; search; create; reset/block/unblock.
- **Security UX:** user-facing copy must describe **scope** (wilaya vs one commune), not internal role constant names.
- Primary actions before **Back** on both list pages. Deep link: `/users?municipalityId=<id>` pre-fills commune filter (commune detail **Utilisateurs** tab).

#### Wilaya commune detail (`/municipalities/:municipalityId`)

- **Chip tabs** (order): **Applications** → **État principal** → **Utilisateurs** → **Annexes** (`?tab=apps|etat|users|annexes`; default `apps`).
- **État principal** tab: links to the three état grids with **`?municipalityId=<id>`** so Wilaya sees only that commune in table, statistics, and Excel (see `spec/modules/ETAT_PRINCIPAL.md`).
- **Retour** on commune detail: `BackButton` with `fallbackTo="/municipalities"`.

### Audit events (minimum)
- Municipality create/update (if not already covered globally).
- User create/block/unblock/reset (per APPS/Core).

### Non-functional requirements
- Same pagination/search limits as Core.

### Migration/compatibility notes
- Existing Apps and Operations modules reference municipalities and users unchanged.
- **Access profiles migration:** `20260526_000017_access_profiles.js` — `spec/modules/ACCESS_PROFILES.md`.
- **Municipality annexes** (secondary offices per commune): `spec/modules/ANNEXES.md`.
- **Commune IT professionals** (engineers/technicians roster per commune): `spec/modules/COMMUNE_IT_STAFF.md`.
