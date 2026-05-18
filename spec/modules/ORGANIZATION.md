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
- No merge table required for “commune + agent” beyond `Users.municipality_id`.

### Workflows

#### Flow 1 — Communes (municipalities only)
- List with search/pagination.
- Create / edit / (optional) deactivate commune fields.
- **Does not** require creating a user in the same step.

#### Flow 2 — Commune agents (users only)
- Select a **commune** (existing list/search).
- Create user for that commune: `MUNI_ADMIN`, credentials per global rules (PDF, 8-digit code, block/unblock, reset password).
- List/filter users **by commune**.

Future features (placeholders): bulk import, export, extra municipality metadata, assignment roles inside a commune—attach to **Flow 1** or **Flow 2** explicitly in future spec edits.

### API endpoints
- Defer to implementation naming; typical split:
  - `GET/POST/PATCH /admin/municipalities...`
  - `GET/POST/PATCH /admin/users...` (scoped by `municipality_id` for commune agents)
- **Wilaya consolidated commune agents list** (`SUPER_ADMIN`):
  - `GET /admin/commune-agents` — Query: `page`, `pageSize` (≤100), `q` (search username, name, commune code/names), optional `municipality_id`. Response: `rows` (`MUNI_ADMIN` only, with joined commune), `total`, `page`, `pageSize`. Order: commune **code** ASC, then `id` ASC.
- Per-commune CRUD unchanged: `GET/POST /admin/municipalities/:municipalityId/users`, `POST /admin/users/:userId/reset|block|unblock`.
- Must enforce role + `checkBlocked`; audit user lifecycle events per Core.

### UI/UX
- **Two separate routes** (or two primary actions on an Administration landing—see `spec/CORE.md`).
- Clear labels: commune management vs agent management.
- Do not combine into one modal unless only as a convenience shortcut that still calls the same two APIs separately (optional).
- **Wilaya hub:** tile → `/users` — consolidated table (all `MUNI_ADMIN` agents), optional commune filter, search, create (pick commune in modal), reset password, block/unblock. Primary actions before **Back** per Core. Deep link: `/users?municipalityId=<id>` pre-fills commune filter (e.g. from commune detail **Utilisateurs** tab).

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
- **Municipality annexes** (secondary offices per commune): `spec/modules/ANNEXES.md`.
- **Commune IT professionals** (engineers/technicians roster per commune): `spec/modules/COMMUNE_IT_STAFF.md`.
