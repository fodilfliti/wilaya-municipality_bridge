## Module: Commune IT professionals (ingénieurs & techniciens informatique)

### Purpose & constraints

- Central **registry of IT engineers and technicians** attached to a **commune** (`Municipality`), inspired by the **Operations** module idea: a **fixed-column table** where each **row** is one person (not a dynamic schema engine like `OperationColumns`).
- **Wilaya** needs a **consolidated view** across all communes, **CRUD** on any row, and **Excel export** for offline sharing (same operational pattern as `spec/modules/OPERATIONS.md` exports).
- **Commune agents** add and maintain **rows for their commune only** (same columns); they cannot change another commune’s rows.
- See `spec/CORE.md` for auth, blocking, audit, RTL/FR, and snackbar error patterns.

### Roles & rules

| Actor | Scope |
| ----- | ----- |
| **`SUPER_ADMIN`** | List (paginated, searchable, filter by commune), create/update/delete **any** row. Export **all** rows or **filtered by** `municipality_id`. |
| **`MUNI_ADMIN`** | List/create/update/delete rows where `municipality_id = user.municipality_id` only. Export **their** rows. |

### Data model

**Table: `commune_it_professionals`**

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | BIGINT PK | |
| `municipality_id` | BIGINT FK → `municipalities.id` | **ON DELETE CASCADE** |
| `first_name` | STRING(120) | Required |
| `last_name` | STRING(120) | Required |
| `nin` | STRING(50), nullable | National identification number when known |
| `phone` | STRING(40) | Required |
| `email` | STRING(255), nullable | Simple format validation in app |
| `programming_languages` | TEXT | Required — free text (comma/newline separated skills) |
| `created_at`, `updated_at` | TIMESTAMP | |

**Indexes:** `municipality_id` for listing by commune.

**Derived display:** “Code commune” and “Nom commune” come from the joined `Municipalities` row (`code`, `name_ar`, `name_fr`).

### Relationship to Operations

- **Same UX concept:** spreadsheet-like **rows** of structured data per commune, Wilaya **table + Excel**.
- **Different implementation:** columns are **fixed in this module** (no `OperationColumns` / `OperationCellValues`). If a future need requires per-operation custom columns, extend via Operations or add a second phase here—document the choice in this file.

### API endpoints

**Admin** (`SUPER_ADMIN`), base path `/admin/commune-it-staff`:

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/admin/commune-it-staff` | Query: `page`, `pageSize` (≤100), `q` (search), `municipality_id` (optional filter). Response: `rows`, `total`, `page`, `pageSize`. Order: commune **code** ASC, then `id` ASC. |
| `GET` | `/admin/commune-it-staff/export.xlsx` | Query: `locale=ar|fr`, optional `municipality_id`. Wilaya consolidated Excel. |
| `GET` | `/admin/commune-it-staff/:id` | Single row (for future detail screens). |
| `POST` | `/admin/commune-it-staff` | Body includes `municipality_id` + person fields. |
| `PATCH` | `/admin/commune-it-staff/:id` | Partial update; may change `municipality_id` to move a person. |
| `DELETE` | `/admin/commune-it-staff/:id` | Hard delete row. |

**Municipality** (`MUNI_ADMIN` with `municipality_id`), base path `/muni/commune-it-staff`:

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/muni/commune-it-staff` | All rows for the user’s commune. |
| `GET` | `/muni/commune-it-staff/export.xlsx` | Query: `locale`. Commune-only Excel. |
| `POST` | `/muni/commune-it-staff` | Create row; `municipality_id` forced server-side. |
| `PATCH` | `/muni/commune-it-staff/:id` | Update if row belongs to commune. |
| `DELETE` | `/muni/commune-it-staff/:id` | Delete if row belongs to commune. |

### UI/UX

- **Wilaya hub:** tile → `/commune-it-staff` — table, filters, modal create/edit, delete, export (primary actions before **Back** per Core).
- **Commune hub:** tile → `/commune-it-staff` — same table columns except commune columns can be omitted in the grid (commune is implicit); add/edit modal, export.

### Audit events (minimum)

- `COMMUNE_IT_STAFF_CREATE`, `COMMUNE_IT_STAFF_UPDATE`, `COMMUNE_IT_STAFF_DELETE` — include `municipality_id` and `id` where applicable.
- `COMMUNE_IT_STAFF_EXPORT_WILAYA`, `COMMUNE_IT_STAFF_EXPORT_COMMUNE` — include `locale`, optional filter, `row_count`.

### Non-functional requirements

- Search uses case-insensitive match on person fields and commune code/names (Postgres `ILIKE`).
- Large `programming_languages` text: cap in validation (e.g. 16k chars) to protect DB and exports.
- **Form UX**: client Zod validation on save (per-field messages + snackbar + banner above submit); server returns `VALIDATION_ERROR` with `fieldErrors` i18n keys on `POST`/`PATCH` `/admin/commune-it-staff` and muni equivalents.

### Migration / compatibility notes

- Migration: `backend/src/db/migrations/20260518_000011_commune_it_professionals.js`.
- No change to Operations tables; optional cross-link from `spec/modules/OPERATIONS.md` if desired.
