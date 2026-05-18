## Module: Municipality annexes (bureaux annexes / ملحق)

### Purpose & constraints

- The Wilaya maintains a **registry of annexes** (secondary offices / service points) **per commune** (`Municipality`): name, contact phones, **position vs. ville**, and a **lifecycle status** so follow-up and reporting stay structured. **RNC IP addresses for annexes** are managed in **État principal — IP RNC annexes** (`spec/modules/ETAT_PRINCIPAL_ANNEX_RNC.md`), not on this registry.
- **Commune agents** reflect **operational reality** by updating **`status` only**. They do not create annex rows, delete them, or change Wilaya-owned descriptive fields through the commune API.
- Aligns with `spec/CORE.md`: JWT, `checkBlocked`, role checks, RTL + French toggle, snackbar-friendly errors where UI exists.

### Implementation status (snapshot)

| Area | Status |
| ---- | ------ |
| DB table `municipality_annexes` + migration | Shipped (`20260517_000010_municipality_annexes.js`, `20260521_000012_municipality_annex_ville_position.js`) |
| Sequelize model + `db/index.js` associations | Shipped (`MunicipalityAnnex`, `Municipality.hasMany`) |
| Service layer (list/create/update/delete + muni list + status patch) | Shipped (`backend/src/modules/annexes/municipalityAnnexService.js`) |
| **Muni** HTTP: list + status patch | Shipped (see API below) |
| **Admin** HTTP CRUD under `/admin/municipalities/.../annexes` | Shipped (`backend/src/routes/admin.js`) |
| **Muni** UI page `MuniAnnexesPage` | Shipped (`App.tsx` route `/annexes`, hub tile on `MuniHubPage`) |
| **Admin** UI on commune detail | Shipped (`AdminMunicipalityDetailPage` annex section + hub tile on `AdminHubPage`) |
| Excel export | Not in v1 (document here if added later) |

### Roles & rules

- **`SUPER_ADMIN` (Wilaya)**  
  - Intended: full **CRUD** on annexes for any commune (`municipality_id` in path).  
  - May set `name`, `phone_numbers`, `ville_position`, and `status`. (IP for annexes: module **État principal — IP RNC annexes**, not this registry.)

- **`MUNI_ADMIN` (Commune)**  
  - **List** annex rows for **their** `municipality_id` only.  
  - **PATCH `status` only** on rows that belong to their commune.  
  - `SUPER_ADMIN` using muni routers without a `municipality_id` should receive **403** on annex list/patch (commune-only flows).

### Data model

#### Table: `municipality_annexes`

- `id` (BIGINT, PK, auto-increment)
- `municipality_id` (BIGINT, FK → `municipalities.id`, **ON DELETE CASCADE**)
- `name` (STRING 255, required) — label of the bureau / point de service
- `phone_numbers` (TEXT, nullable) — free text (multiple numbers, line breaks)
- `ville_position` (TEXT, required) — stored as plain text; API currently accepts only `INSIDE_VILLE` and `OUTSIDE_VILLE` (see below). Default `INSIDE_VILLE` for existing rows.
- `status` (STRING 40, required) — must be one of the canonical values below
- `created_at`, `updated_at` (DATE, not null)

#### Indexes & relationships

- Index: `idx_municipality_annexes_municipality_id` on `municipality_id`.
- `Municipality` **hasMany** `MunicipalityAnnex` (`as: "annexes"`); annex **belongsTo** `Municipality`.

### Status vocabulary (canonical)

Enforced in `municipalityAnnexService` (`ANNEX_STATUSES`); invalid values → 400.

| Value | Meaning |
| ----- | ------- |
| `NEW_NOT_YET_ACTIVE` | Registered, not yet in service |
| `SETUP_IN_PROGRESS` | Installation / configuration in progress |
| `READY_NOT_STARTED` | Ready on paper; operations not started |
| `ACTIVE` | Normal operation |
| `PAUSED` | Temporarily suspended |
| `INACTIVE` | Closed / not used |

**Transitions:** any → any unless business rules are tightened later in this document.

### Position vs. ville (canonical for now)

Enforced in `municipalityAnnexService` (`ANNEX_VILLE_POSITIONS`); column is **TEXT** (not a DB enum) so new labels can be adopted later without a type migration.

| Value | Meaning |
| ----- | ------- |
| `INSIDE_VILLE` | Inside the town / city |
| `OUTSIDE_VILLE` | Outside the town / city |

### Workflows

1. **Wilaya (shipped)** — From **commune detail** (`/municipalities/:municipalityId`): list annexes, create, edit fields, delete. Admin API + UI wired to the annex service.
2. **Commune (shipped)** — Page lists annexes; user selects a new **status** and saves; server validates and updates `updated_at`.

### API endpoints

Base: JSON, `Authorization: Bearer`; errors `{ "error": "message" }`.

#### Municipality (`MUNI_ADMIN` + `municipality_id`)

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/muni/annexes` | Returns `{ annexes: [...], statuses: string[], ville_positions: string[] }`. Annexes ordered by `id` ascending. `statuses` is the full canonical list for the status `<select>`. `ville_positions` lists allowed values for labels; commune PATCH does not change `ville_position`. |
| `PATCH` | `/muni/annexes/:annexId` | Body: `{ "status": "<canonical>" }`. Annex must belong to the user’s `municipality_id`. |

**Frontend helpers:** `muniListAnnexes`, `muniPatchAnnexStatus` in `frontend/src/api.ts`.

#### Admin (`SUPER_ADMIN`)

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/admin/municipalities/:municipalityId/annexes` | List + `statuses[]` + `ville_positions[]`. |
| `POST` | `/admin/municipalities/:municipalityId/annexes` | Create: `name` (required), optional `phone_numbers`, optional `status`, optional `ville_position` (defaults to `INSIDE_VILLE` if omitted). |
| `PATCH` | `/admin/municipalities/:municipalityId/annexes/:annexId` | Partial update of `name`, `phone_numbers`, `status`, `ville_position`. |
| `DELETE` | `/admin/municipalities/:municipalityId/annexes/:annexId` | Delete row. |

**Frontend helpers:** `adminListMunicipalityAnnexes`, `adminCreateMunicipalityAnnex`, `adminUpdateMunicipalityAnnex`, `adminDeleteMunicipalityAnnex` in `frontend/src/api.ts`.

### UI/UX

- **Commune:** route `/annexes` (hub + `App.tsx`); read-only name/phones/**position**; status dropdown + save per row; **Retour** uses browser history (`BackButton`); errors via `formatApiErrorMessage` + snackbar.
- **Wilaya:** commune detail (`/municipalities/:id`) — **Annexes** tab (chip order: Applications → État principal → Utilisateurs → Annexes); create/edit/delete annexes; hub tile on `AdminHubPage` points to `/municipalities`.
- **i18n:** keys such as `annexStatus_*`, `annexVillePosition_*`, page title, hints for commune vs admin; Arabic default + French toggle.

### Audit events

| Action type (as implemented or planned) | When | Typical `details` |
| --------------------------------------- | ---- | ----------------- |
| `MUNICIPALITY_ANNEX_STATUS_UPDATE` | After successful commune `PATCH` | `annex_id`, `municipality_id`, `status` |
| `MUNICIPALITY_ANNEX_CREATE` | After admin create | `municipality_id`, `annex_id` |
| `MUNICIPALITY_ANNEX_UPDATE` | After admin patch | `municipality_id`, `annex_id` |
| `MUNICIPALITY_ANNEX_DELETE` | After admin delete | `municipality_id`, `annex_id` |

### Non-functional requirements

- Validation: required `name`; max lengths per DB; `status` in canonical set; `ville_position` in `ANNEX_VILLE_POSITIONS` (or omitted → default).
- No cross-commune reads or writes on muni paths.
- Deleting a **commune** cascades annex rows (FK `ON DELETE CASCADE`).

### Migration / compatibility

- Migration file: `backend/src/db/migrations/20260517_000010_municipality_annexes.js`.
- `ville_position`: `backend/src/db/migrations/20260521_000012_municipality_annex_ville_position.js`.
- **Removed** `ip_address` from annex registry: `backend/src/db/migrations/20260525_000016_drop_municipality_annex_ip_address.js` (IPs live in `annex_rnc_authorizations` only).
- Depends on `municipalities`; see `spec/modules/ORGANIZATION.md`.
- Future: links to tickets, mail threads, or asset inventory — extend this module spec when introduced.
