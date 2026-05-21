## Module: État principal — postes MCLT & autorisation RNC

### Purpose & constraints

- Second slice under **État principal**: inventory of **MCLT workstations** per commune (many rows per `municipality_id`), same Wilaya/consolidated-table + Excel pattern as **serveurs de secours**.
- Fixed columns (text): IP MCLT, poste d’utilisation, application installée, version Windows, nom PC, antivirus, **IP autorisée RNC** (Wilaya).
- **Commune** maintains its rows and may **request RNC authorization** for a row; Wilaya receives an **internal mail** notification (all `SUPER_ADMIN` users).
- **Wilaya** approves/rejects and sets `ip_rnc_authorized`; commune sees status (pending / approved / rejected).
- Ordering: communes by code; rows by `display_order` then `id`.

### Roles & rules

- **`SUPER_ADMIN`:** list all communes + rows; export Excel; PATCH any commune’s rows (including `rnc_auth_status`, `ip_rnc_authorized`); approve/reject via PATCH.
- **`MUNI_ADMIN`:** CRUD own rows only; `submit` for transmission timestamp; **POST request-authorization** on a row (not while already pending/approved).

### Data model

#### Table: `mclt_workstations`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | BIGINT PK | |
| `municipality_id` | BIGINT FK | `ON DELETE CASCADE` |
| `display_order` | INT | default 0 |
| `ip_mclt` | STRING(500) nullable | @ IP MCLT utilisée |
| `pc_usage` | STRING(500) nullable | ex. poste de validation |
| `installed_application` | STRING(500) nullable | |
| `windows_version` | STRING(100) nullable | ex. 7, 8, 10, 11 |
| `pc_name` | STRING(255) nullable | |
| `antivirus_name` | STRING(500) nullable | Kaspersky / autre |
| `ip_rnc_requested` | STRING(500) nullable | IP demandée par la commune (optionnel si demande générique) |
| `ip_rnc_authorized` | STRING(500) nullable | set by Wilaya when approved |
| `rnc_auth_status` | STRING(20) | `none` \| `pending` \| `approved` \| `rejected` |
| `rnc_auth_requested_at` | DATE nullable | when commune requested |
| `submitted_at` | DATE nullable | commune transmission (all rows of commune) |
| `updated_by_user_id` | BIGINT nullable FK users |
| `updated_at` | DATE | |

Index: `(municipality_id, display_order)`.

### Workflows

1. **Commune — step 1:** Add/edit lines → **Enregistrer le brouillon** (PATCH without transmit).
2. **Commune — step 2:** On each **saved** line (`id > 0`), **Demander autorisation RNC** (`specific` \| `generic` + optional `ip_rnc_requested`) → `pending` + mail to Wilaya.
3. **Commune — step 3:** **Transmettre à la wilaya** (confirm) — PATCH with `submit: true` (saves + marks transmission).
4. **Wilaya** reviews table (pending highlighted), sets **IP autorisée RNC** + `approved` or `rejected`; optional **`?municipalityId=`** filter on list, charts, Excel from commune detail.

### API endpoints

#### Admin

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/admin/etat-principale/mclt-workstations` | Wilaya payload: `municipalities[]` with `workstations[]`, `submission`, `analytics`. Optional **`municipalityId`** query — filter one commune. |
| `PATCH` | `/admin/etat-principale/mclt-workstations/:municipalityId` | Body: `{ workstations: [...], submit?: boolean }` — Wilaya may set `rnc_auth_status`, `ip_rnc_authorized`. |
| `GET` | `/admin/etat-principale/mclt-workstations/export.xlsx?locale=ar\|fr` | Wilaya export. Optional **`municipalityId`**. |

#### Municipality

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/muni/etat-principale/mclt-workstations` | Own rows + `submitted_at`. |
| `PATCH` | `/muni/etat-principale/mclt-workstations` | Sync `workstations[]` + optional `submit`. |
| `POST` | `/muni/etat-principale/mclt-workstations/:id/request-rnc-authorization` | Body: `{ request_mode: "specific" \| "generic", ip_rnc_requested?: string }` — demande IP précise ou une adresse sans préciser. |
| `GET` | `/muni/etat-principale/mclt-workstations/export.xlsx?locale=ar\|fr` | Commune export. |

### UI/UX

- Hub **État principal**: tile **Postes MCLT / RNC** → `/etat-principale/mclt-workstations`.
- Commune: guided **3-step** UI (`MuniEtatPrincipalWorkflow`); draft badge on unsaved lines; RNC request only after save.
- Wilaya: flat table (code, transmission, columns…, statut RNC, edit modal); filter banner when `?municipalityId=`; **BackButton** for Retour.
- Commune + Wilaya line forms: responsive multi-column field grid; Wilaya edit uses wide état modal with sticky add/save toolbar (see `ETAT_PRINCIPAL.md` UI/UX).

### Audit events

| Action type | When |
| ----------- | ---- |
| `MCLT_WORKSTATION_UPDATE` | Commune PATCH |
| `MCLT_WORKSTATION_ADMIN_UPDATE` | Wilaya PATCH |
| `MCLT_WORKSTATION_EXPORT_WILAYA` | Wilaya export |
| `MCLT_WORKSTATION_EXPORT_COMMUNE` | Commune export |
| `MCLT_RNC_AUTH_REQUEST` | Commune POST request-authorization |

### Implementation map

- Service: `backend/src/modules/etatPrincipale/mcltWorkstationService.js`
- Mail: `backend/src/services/mcltRncAuthorizationMail.js`
- Excel: `backend/src/services/mcltWorkstationExcelExport.js`
- Routes: extend `etatPrincipaleAdmin.js`, `etatPrincipaleMuni.js`
- Migrations: `20260522_000013_mclt_workstations.js`, `20260524_000015_mclt_ip_rnc_requested.js`
- Wilaya filter helper: `wilayaPayloadFilter.js` (shared with other état slices)
