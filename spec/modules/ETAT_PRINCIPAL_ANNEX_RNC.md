## Module: État principal — IP autorisée RNC (annexes)

### Purpose & constraints

- Third slice under **État principal**: **RNC IP authorization per commune annex** (many rows per `municipality_id`), linked to `municipality_annexes`.
- Columns (text): **IP autorisée** (Wilaya), **année d’autorisation** (commune saisit), **PC utilisé**, **@ IP demandée à autoriser** (commune). **`authorized_ip_count`** retained in DB only — not shown in UI/Excel.
- **Commune** selects an annex from the Wilaya registry, fills request fields, may **submit** transmission, and **requests authorization** → internal mail to all `SUPER_ADMIN`.
- **Wilaya** sets authorized IP, year, count, approves/rejects.
- Display in UI/Excel: code commune, nom commune, nom annexe (from annex registry).

### Roles & rules

- **`SUPER_ADMIN`:** list all; export Excel; PATCH any commune (including `ip_authorized`, `authorization_year`, `rnc_auth_status`).
- **`MUNI_ADMIN`:** CRUD own lines; fills `pc_used`, `authorization_year`, `ip_requested` (required on save); cannot change `ip_authorized` / `rnc_auth_status`; POST request-authorization when `ip_requested` is set.

### Data model

#### Table: `annex_rnc_authorizations`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | BIGINT PK | |
| `municipality_id` | BIGINT FK | `ON DELETE CASCADE` |
| `municipality_annex_id` | BIGINT FK | → `municipality_annexes.id` |
| `display_order` | INT | default 0 |
| `ip_authorized` | STRING(500) nullable | Wilaya |
| `authorization_year` | STRING(20) nullable | |
| `authorized_ip_count` | STRING(50) nullable | legacy — not exposed in UI/Excel |
| `pc_used` | STRING(500) nullable | |
| `ip_requested` | STRING(500) nullable in DB | commune demand — **required on commune PATCH** (non-empty per line) |
| `rnc_auth_status` | STRING(20) | `none` \| `pending` \| `approved` \| `rejected` |
| `rnc_auth_requested_at` | DATE nullable | |
| `submitted_at` | DATE nullable | shared per commune transmission |
| `updated_by_user_id` | BIGINT nullable | |
| `updated_at` | DATE | |

### Workflows (commune)

1. **Step 1:** Select annex + fill fields (including **IP demandée** and **année**) → **Enregistrer** or **Demander autorisation** (button saves all lines then submits the request for that line).
2. **Step 2:** **Demander autorisation** sends mail to Wilaya. Changing **IP demandée** after a prior request resets `rnc_auth_status` to `none` (and clears Wilaya **IP autorisée** on save) — commune must request again for the new address.
3. **Step 3:** **Transmettre à la wilaya** when inventory is complete.

### API endpoints

#### Admin

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/admin/etat-principale/annex-rnc-authorizations` | Wilaya payload. Optional **`municipalityId`** — filter one commune. |
| `PATCH` | `/admin/etat-principale/annex-rnc-authorizations/:municipalityId` | Body: `{ lines: [...], submit?: boolean }` |
| `GET` | `/admin/etat-principale/annex-rnc-authorizations/export.xlsx?locale=ar\|fr` | Wilaya export. Optional **`municipalityId`**. |

#### Municipality

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/muni/etat-principale/annex-rnc-authorizations` | Own lines + `annexes[]` for dropdown + `submitted_at` |
| `PATCH` | `/muni/etat-principale/annex-rnc-authorizations` | Sync `lines[]` + optional `submit` |
| `POST` | `/muni/etat-principale/annex-rnc-authorizations/:id/request-rnc-authorization` | Request; mail to Wilaya |
| `GET` | `/muni/etat-principale/annex-rnc-authorizations/export.xlsx?locale=ar\|fr` | Commune export |

### UI/UX

- Hub **État principal**: tile **IP RNC annexes** → `/etat-principale/annex-rnc-authorizations`.
- Commune: no commune name on page; guided steps via `MuniEtatPrincipalWorkflow` (no duplicate intro paragraph); annex dropdown; field order — **annexe**, **PC utilisé**, **année d’autorisation**, **IP demandée** (`etatMuniRncBlock` + **Demander autorisation**); **IP demandée** required with `inputInvalid` + per-field error. Excel: no **nombre IP** column.
- Wilaya: table with code, annex name, columns, statut; edit modal; **`?municipalityId=`** filter + banner; **BackButton**.
- Commune + **Wilaya edit modal**: same patterns as MCLT (`EtatLineCardHeader`, 3 fields per row, IP demandée before IP autorisée in RNC block, wide modal + sticky toolbar — see `ETAT_PRINCIPAL_MCLT.md`).

### Audit events

| Action type | When |
| ----------- | ---- |
| `ANNEX_RNC_AUTH_UPDATE` | Commune PATCH |
| `ANNEX_RNC_AUTH_ADMIN_UPDATE` | Wilaya PATCH |
| `ANNEX_RNC_AUTH_REQUEST` | Commune POST request |
| `ANNEX_RNC_AUTH_EXPORT_WILAYA` / `ANNEX_RNC_AUTH_EXPORT_COMMUNE` | Excel |

### Implementation map

- Service: `backend/src/modules/etatPrincipale/annexRncAuthorizationService.js`
- Mail: `backend/src/services/annexRncAuthorizationMail.js`
- Excel: `backend/src/services/annexRncAuthorizationExcelExport.js`
- Migration: `20260523_000014_annex_rnc_authorizations.js`
