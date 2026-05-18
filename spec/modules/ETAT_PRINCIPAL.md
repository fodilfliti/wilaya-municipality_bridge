## Module: État principal — fixed commune grids (first slice: serveurs de secours)

### Purpose & constraints

- **État principal** groups **fixed-schema** Wilaya ↔ commune data collections (unlike **Operations**, where Wilaya defines dynamic columns per operation).
- First implemented slice: **État des serveurs de secours** — **multiple server lines per commune** (`display_order`), same columns for everyone, ordered by **commune code** then line index (numeric-aware sort, same idea as Operations results).
- **Wilaya** sees a consolidated table, submission-style colouring (transmitted vs pending), quick stats, and **Excel** export (data sheet + statistics sheet).
- **Commune** edits **only its row**; can mark data as **transmitted to the wilaya** (`submitted_at`).
- New communes automatically get a row (migration backfill + create on `POST /admin/municipalities`).
- UI: section **« État principal »** on admin and commune hubs; further slices (3+ planned) should reuse this pattern with new routes under `/etat-principale/...`.

### Roles & rules

- **`SUPER_ADMIN`:** read all rows; export Excel; **PATCH any commune’s row** (corrections / support — same fields as commune + `submit` flag).
- **`MUNI_ADMIN`:** read/update **own** `municipality_id` row only; export own row to Excel.

### Data model

#### Table: `backup_server_statuses`

- `id` (BIGINT, PK)
- `municipality_id` (BIGINT, FK → `municipalities.id`, `ON DELETE CASCADE`) — **many rows per commune** (unique constraint removed in migration `20260520_000011_backup_server_statuses_multi_per_muni.js`)
- `display_order` (INT, default 0)
- `existe` (BOOLEAN, default false) — backup server exists
- `server_type` (STRING 500, nullable) — free text (future: optional dropdown)
- `configured` (BOOLEAN, default false)
- `os_type` (STRING 500, nullable) — OS description (future: optional dropdown)
- `os_active` (BOOLEAN, default false)
- `anomalie` (TEXT, nullable)
- `submitted_at` (DATE, nullable) — set when commune (or wilaya) marks transmission; **null** ⇒ “non transmis” in UI/Excel styling
- `updated_by_user_id` (BIGINT, nullable, FK → `users.id`, `SET NULL` on delete)
- `updated_at` (DATE, not null)

#### Relationships

- `Municipality` **hasMany** `BackupServerStatus` (`as: "backupServers"`); each row **belongsTo** `Municipality` and optional `User` (`updatedByUser`).

### Workflows

1. **Wilaya** opens **État principal → Serveurs de secours** → consolidated table, charts, Excel (optionally filtered).
2. **Commune** opens the same tile → multi-line form; save draft / transmit to wilaya (see commune UX on MCLT/RNC slices for the **3-step** pattern used on RNC modules).
3. **Wilaya** opens **commune detail → État principal** tab → links such as `/etat-principale/backup-servers?municipalityId=<id>`: **table, submission/analytics charts, and Excel** are scoped to that commune only; banner **“Filtre actif”** with clear-filter control; edit modal per commune from the table.

### API endpoints

#### Admin

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/admin/etat-principale/backup-servers` | Full payload: `municipalities[]` (each: `municipality`, `servers[]`, `has_submitted`), `submission`, `analytics`. Optional query: **`municipalityId`** — filter to one commune; recompute `submission` + `analytics` for that subset. |
| `PATCH` | `/admin/etat-principale/backup-servers/:municipalityId` | Body: `{ servers: [...], submit?: boolean }`; returns full wilaya payload (client should reload with filter if active). |
| `GET` | `/admin/etat-principale/backup-servers/export.xlsx?locale=ar\|fr` | Wilaya workbook (data + stats sheets). Optional query: **`municipalityId`** — export only that commune. |

#### Municipality

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/muni/etat-principale/backup-servers` | `{ municipality_id, municipality, servers[], submitted_at }`. |
| `PATCH` | `/muni/etat-principale/backup-servers` | Body: `{ servers: [...], submit?: true\|false }` for `submitted_at` on all rows of the commune. |
| `GET` | `/muni/etat-principale/backup-servers/export.xlsx?locale=ar\|fr` | Single-commune Excel. |

**Implementation:** `backend/src/modules/etatPrincipale/backupServerStatusService.js`, shared filter `wilayaPayloadFilter.js` (`parseMunicipalityIdFilter`, `filterWilayaByMunicipality`), routers `etatPrincipaleAdmin.js`, `etatPrincipaleMuni.js`; Excel `backupServerStatusExcelExport.js`; filenames `exportFilename.js` (`buildBackupServerWilayaXlsxFilename`, `buildBackupServerMuniXlsxFilename`). Frontend: `useAdminEtatWilayaFilter`, `EtatPrincipaleFilterBanner`, `BackButton`.

### UI/UX

- Hub: card under **« État principal »**; route `/etat-principale/backup-servers` (admin vs commune page by role).
- Wilaya table: colour booleans, warm background for pending transmission, highlight non-empty **anomalie**; donuts for submission and boolean distributions; **Refresh** + **Export**.
- Commune: status banner (transmitted / pending); multi-line server cards + add line + save + optional transmit + export.
- **Wilaya filter:** `?municipalityId=` on list + export; UI banner when active.
- **Retour:** `BackButton` (history), not hard link to hub.

### Audit events (minimum)

| Action type | When |
| ----------- | ---- |
| `BACKUP_SERVER_STATUS_EXPORT_WILAYA` | Wilaya full export |
| `BACKUP_SERVER_STATUS_EXPORT_COMMUNE` | Commune export |
| `BACKUP_SERVER_STATUS_UPDATE` | Commune PATCH |
| `BACKUP_SERVER_STATUS_ADMIN_UPDATE` | Wilaya PATCH by `municipalityId` |

### Non-functional requirements

- Ordering: communes sorted by code using the same helper as Operations (`sortMunicipalitiesByCode`).
- Empty PATCH body: no DB write for field updates (service skips when no keys).
- Excel: localized headers (`ar` / `fr` query param).

### Migration / compatibility

- Migration: `backend/src/db/migrations/20260516_000009_backup_server_status.js` (creates table + backfill for existing communes).
- **Postes MCLT & RNC**: see `spec/modules/ETAT_PRINCIPAL_MCLT.md` (`/etat-principale/mclt-workstations`).
- **IP autorisée RNC (annexes)**: see `spec/modules/ETAT_PRINCIPAL_ANNEX_RNC.md` (`/etat-principale/annex-rnc-authorizations`).
- **Future slices** under État principal: add sibling routes + tables + hub tiles; keep cross-cutting hub title and Excel/audit patterns consistent; link new files from this spec or split into `ETAT_PRINCIPAL_<SLUG>.md` if any slice grows large.
