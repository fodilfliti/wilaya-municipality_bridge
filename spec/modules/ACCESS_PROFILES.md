## Module: Access profiles (roles, permissions & user profile)

### Purpose & constraints

- Extend **`users`** with optional HR-style fields and a **fine-grained permission matrix** per account, without replacing login scope (`SUPER_ADMIN` = compte wilaya, `MUNI_ADMIN` = compte commune).
- **Access role template** = named profile (system enum slugs + optional custom roles) assigning each permission key a level: `none`, `view`, or `manage`.
- **View-only** profiles (e.g. chef de service, audit) must be expressible: module visible but create/edit/delete/export hidden in UI and blocked on API (phase 2).
- **Email privacy:** `email_hidden` hides a user’s email from **other** users; the account owner always sees their own email.
- **UI security copy:** never show raw `SUPER_ADMIN` / `MUNI_ADMIN` to end users — use **« compte wilaya »** / **« compte commune »** (see `spec/modules/ORGANIZATION.md`).
- **Implementation status:**
  - **Phase 1 (done):** schema, permission catalog, 9 system role templates, resolver service, admin read/configure APIs, migration + backfill.
  - **Phase 2 (planned):** `requirePermission` on all routes; frontend user form + permission matrix; hub/menu hiding by effective permissions.

### Roles & rules

| Layer | Meaning |
| ----- | ------- |
| **Account scope** (`users.role`) | `SUPER_ADMIN` (wilaya) or `MUNI_ADMIN` (commune). Decides JWT scope and `municipality_id` rules. **Not replaced** by access templates. |
| **Access role template** | Permission profile for that account. Must match scope: `account_scope = wilaya` only for `SUPER_ADMIN`, `commune` only for `MUNI_ADMIN`. |
| **Custom permissions** | When `use_custom_permissions = true`, rows in `user_permission_overrides` **replace** the template level for those keys only. |

| Actor | Rules |
| ----- | ----- |
| **`SUPER_ADMIN`** | Wilaya permission keys only (+ `both`). Legacy users without template get **full manage** until assigned a template. |
| **`MUNI_ADMIN`** | Commune permission keys only (+ `both`). Scoped to own `municipality_id` regardless of template. |
| **Privileged profile admin** | Create/edit **custom** role templates if `can_manage_access_roles = true` **or** effective `organization.access_roles.manage = manage`. Cannot edit **system** template permission rows via API (slug enum). |
| **Wilaya admin creation** | `can_create_wilaya_admins` (existing flag) — separate from access roles; still required for `POST /admin/wilaya-admins`. |
| **Self-service safety** | User cannot **block** their own account (`POST .../block` returns 400). Own row: **Mon profil** — edit job title / email only; **cannot** change own role template or permission overrides (API **403**). Another admin with `organization.wilaya_admins.manage` edits others via **Profil d'accès**. Session `effective_permissions` refresh after self contact save. |

### Data model

#### `users` (extensions)

| Column | Type | Notes |
| ------ | ---- | ----- |
| `job_title` | STRING(120), nullable | Free text, e.g. « chef service » |
| `department_id` | BIGINT FK → `departments`, nullable | Optional |
| `email` | STRING(255), nullable | Optional contact email |
| `email_hidden` | BOOLEAN, default false | Hide from other users when true |
| `access_role_template_id` | BIGINT FK → `access_role_templates`, nullable | System or custom template |
| `use_custom_permissions` | BOOLEAN, default false | Apply `user_permission_overrides` |
| `can_manage_access_roles` | BOOLEAN, default false | Create custom role templates (AR/FR + matrix) |
| `can_create_wilaya_admins` | BOOLEAN | Unchanged — create wilaya accounts |

#### `departments`

| Column | Type |
| ------ | ---- |
| `id` | BIGINT PK |
| `name_ar`, `name_fr` | STRING(200) |
| `sort_order` | INTEGER |
| `is_active` | BOOLEAN |

#### `access_role_templates`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | BIGINT PK | |
| `slug` | STRING(80) UNIQUE | System enum or `CUSTOM_*` |
| `account_scope` | ENUM `wilaya` \| `commune` | |
| `name_ar`, `name_fr` | STRING(200) | Display in UI |
| `description_ar`, `description_fr` | TEXT, nullable | |
| `is_system` | BOOLEAN | `true` = seeded enum; not editable via PUT permissions |
| `is_active` | BOOLEAN | |
| `created_by_user_id` | BIGINT FK, nullable | Set for custom roles |

#### `access_role_template_permissions`

| Column | Type |
| ------ | ---- |
| `id` | BIGINT PK |
| `role_template_id` | FK → `access_role_templates` ON DELETE CASCADE |
| `permission_key` | STRING(120) |
| `access_level` | ENUM `none` \| `view` \| `manage` |

Unique: `(role_template_id, permission_key)`.

#### `user_permission_overrides`

| Column | Type |
| ------ | ---- |
| `id` | BIGINT PK |
| `user_id` | FK → `users` ON DELETE CASCADE |
| `permission_key` | STRING(120) |
| `access_level` | ENUM `none` \| `view` \| `manage` |

Unique: `(user_id, permission_key)`.

#### Permission levels

| Level | Meaning |
| ----- | ------- |
| `none` | Module/action not available (hide hub tile, 403 on API). |
| `view` | Read-only lists/detail/export where export is a separate key. |
| `manage` | Create, update, delete, and actions implied by the module (includes view). |

**Scope on catalog entries:** `wilaya` = `SUPER_ADMIN` only; `commune` = `MUNI_ADMIN` only; `both` = either account type.

**Source of truth (code):** `backend/src/modules/access/permissionCatalog.js`  
**System slug enum:** `backend/src/modules/access/roleTemplateSlugs.js`  
**Default matrices:** `backend/src/modules/access/defaultRolePermissions.js`

### Full permission catalog

| Key | Scope | Module | FR label (summary) |
| --- | ----- | ------ | ------------------ |
| `hub.dashboard` | both | hub | Tableau de bord |
| `apps.view` | both | apps | Applications — consulter |
| `apps.manage` | wilaya | apps | Applications — gérer |
| `operations.view` | both | operations | Opérations — consulter |
| `operations.manage` | wilaya | operations | Opérations — gérer |
| `operations.export` | wilaya | operations | Opérations — exporter |
| `operations.fill` | commune | operations | Opérations — remplir (commune) |
| `mail.view` | both | mail | Messagerie — consulter |
| `mail.send` | both | mail | Messagerie — envoyer |
| `organization.municipalities.view` | wilaya | organization | Communes — consulter |
| `organization.municipalities.manage` | wilaya | organization | Communes — gérer |
| `organization.commune_agents.view` | wilaya | organization | Comptes commune — consulter |
| `organization.commune_agents.manage` | wilaya | organization | Comptes commune — gérer |
| `organization.wilaya_admins.view` | wilaya | organization | Comptes wilaya — consulter |
| `organization.wilaya_admins.manage` | wilaya | organization | Comptes wilaya — gérer |
| `organization.access_roles.manage` | wilaya | organization | Profils d'accès — gérer |
| `etat.backup_servers.view` | both | etat | Serveurs de secours — consulter |
| `etat.backup_servers.manage` | wilaya | etat | Serveurs de secours — gérer (wilaya) |
| `etat.backup_servers.fill` | commune | etat | Serveurs de secours — saisie commune |
| `etat.backup_servers.export` | wilaya | etat | Serveurs de secours — exporter |
| `etat.mclt.view` | both | etat | Postes MCLT — consulter |
| `etat.mclt.manage` | wilaya | etat | Postes MCLT — gérer (wilaya) |
| `etat.mclt.fill` | commune | etat | Postes MCLT — saisie commune |
| `etat.mclt.export` | wilaya | etat | Postes MCLT — exporter |
| `etat.annex_rnc.view` | both | etat | IP RNC annexes — consulter |
| `etat.annex_rnc.manage` | wilaya | etat | IP RNC — gérer (wilaya) |
| `etat.annex_rnc.fill` | commune | etat | IP RNC — saisie commune |
| `etat.annex_rnc.export` | wilaya | etat | IP RNC — exporter |
| `annexes.view` | both | annexes | Annexes — consulter |
| `annexes.manage` | wilaya | annexes | Annexes — gérer (wilaya) |
| `annexes.status_update` | commune | annexes | Annexes — statut (commune) |
| `commune_it_staff.view` | both | commune_it_staff | IT commune — consulter |
| `commune_it_staff.manage` | both | commune_it_staff | IT commune — gérer |
| `commune_it_staff.export` | wilaya | commune_it_staff | IT commune — exporter |
| `users.email.view_others` | wilaya | organization | Voir e-mail des autres comptes |
| `announcements.view` | both | announcements | Annonces — consulter |
| `announcements.manage` | wilaya | announcements | Annonces — gérer |

When adding a new module, **add keys here and in `permissionCatalog.js`** before shipping.

### System role templates (enum slugs)

#### Wilaya (`account_scope = wilaya`)

| Slug | name_fr | Intended use |
| ---- | ------- | -------------- |
| `WILAYA_FULL_ADMIN` | Admin wilaya — accès complet | Direction / DSI — all manage keys |
| `WILAYA_VIEW_ONLY` | Consultation seule | Audit, read-only all modules |
| `WILAYA_CHEF_SERVICE` | Chef de service | Operations + mail manage; view état/org/apps |
| `WILAYA_APPS_MANAGER` | Responsable applications | `apps.manage`; view elsewhere |
| `WILAYA_ETAT_MANAGER` | Responsable état principal | All `etat.*` + `annexes.manage` + exports; view org/apps/ops |
| `WILAYA_ORG_MANAGER` | Responsable organisation | Communes, accounts, IT registry manage; view état |

#### Commune (`account_scope = commune`)

| Slug | name_fr | Intended use |
| ---- | ------- | -------------- |
| `MUNI_AGENT_STANDARD` | Agent commune — standard | Fill operations + état; mail; annex status; IT rows |
| `MUNI_VIEW_ONLY` | Consultation seule | Chef de département — view only |
| `MUNI_ETAT_AGENT` | Agent état principal | États + annexes fill only |

#### Custom roles

- Slug pattern: `CUSTOM_<normalized>_<suffix>` (server-generated if omitted).
- `is_system = false`, bilingual `name_ar` / `name_fr`, optional descriptions.
- Created via `POST /admin/access/role-templates` when privileged.
- Permissions set at create or `PUT .../permissions`.

### Workflows

#### Assign profile on user create/update (phase 2)

1. Choose **account scope** (wilaya vs commune) — existing flow.
2. Optional: `job_title`, `department`, `email`, `email_hidden`.
3. Select **access role template** from list filtered by `account_scope`.
4. Optional: enable **Personnaliser les droits** → `use_custom_permissions` + matrix overrides.
5. Save user; store `access_role_template_id` and overrides.

#### Pick system role vs customize

- Dropdown lists **system** templates first (`is_system = true`), then custom templates.
- Choosing a template loads its matrix; customize toggles allow per-key edits (only keys applicable to account scope).
- Changing template resets overrides unless user confirms.

#### Create custom role (privileged user)

1. `can_manage_access_roles` or `organization.access_roles.manage`.
2. POST role with `account_scope`, `name_ar`, `name_fr`, optional `slug`, `permissions[]`.
3. Role appears in picker for new users of that scope.

#### Effective permission resolution (runtime)

1. Load user + `access_role_template` + template permissions.
2. If no template → **legacy full access** (all applicable keys = `manage`) for backward compatibility.
3. If `use_custom_permissions` → merge overrides on template map.
4. `hasPermission(map, key, minLevel)` — `manage` satisfies `view`.

#### Email visibility

- Viewer sees target `email` if: viewer is target, **or** `email_hidden = false`, **or** viewer has `users.email.view_others = manage` (wilaya).

### API endpoints

**Admin** (`SUPER_ADMIN`), base `/admin`. All require JWT + `checkBlocked`.

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| `GET` | `/access/permission-catalog` | any wilaya admin | Keys + `label_fr` / `label_ar` + `module` for caller’s account scope |
| `GET` | `/access/role-template-slugs` | any wilaya admin | `{ wilaya: {...}, commune: {...} }` enum for frontend |
| `GET` | `/access/role-templates` | any wilaya admin | Query `account_scope=wilaya\|commune`. Active templates, system first |
| `GET` | `/access/role-templates/:id` | any wilaya admin | Template + `permissions[]` |
| `POST` | `/access/role-templates` | privileged | Body below — create custom role |
| `PUT` | `/access/role-templates/:id/permissions` | privileged | Replace permissions; **403** if `is_system` |

**`POST /access/role-templates` body:**

```json
{
  "account_scope": "wilaya",
  "slug": "CUSTOM_MON_PROFIL",
  "name_ar": "…",
  "name_fr": "…",
  "description_ar": "…",
  "description_fr": "…",
  "permissions": [
    { "permission_key": "operations.view", "access_level": "view" },
    { "permission_key": "mail.send", "access_level": "manage" }
  ]
}
```

**User lifecycle APIs** (organization module) — phase 2 extensions to existing create/update:

- Include `job_title`, `department_id`, `email`, `email_hidden`, `access_role_template_id`, `use_custom_permissions`, `permission_overrides[]` on admin user create/patch (to be implemented).

**Shared user actions** (unchanged paths):

- `POST /admin/users/:userId/reset|block|unblock` — block rejects self.

### UI/UX

#### Wilaya hub section order (5 sections)

1. **État principal**
2. **Commune & organisation** (operations, communes, annexes, IT staff)
3. **Applications**
4. **Wilaya & comptes** (`/wilaya-admins`, `/users`)
5. **Accès rapide** (shortcuts — least prominent)

#### Account list pages (organization)

- `/wilaya-admins` — own row: **Mon profil** (contact only); other rows: **Profil d'accès** when `organization.wilaya_admins.manage`; reset/block require manage; block hidden for self.
- `/users` — commune agents + account type column + commune filter.

#### Phase 2 screens (planned)

- **Role templates admin** — list/create custom roles, matrix editor.
- **User modal** — profile fields + template dropdown + « Personnaliser » matrix.
- **Menu/tiles** — hide modules where effective level is `none`.
- **View mode** — disable primary/secondary actions when level is `view` only.

### Audit events (minimum)

| action_type | When |
| ----------- | ---- |
| `ACCESS_ROLE_TEMPLATE_CREATE` | Custom role created |
| `ACCESS_ROLE_TEMPLATE_PERMISSIONS_UPDATE` | Custom role matrix replaced |
| `USER_ACCESS_PROFILE_UPDATE` | User template / overrides / profile fields changed (phase 2) |

### Non-functional requirements

- Permission catalog is versioned in code; DB stores only key strings — deploy catalog before relying on new keys.
- Resolver cached per request (`req.effectivePermissions`) once middleware enabled.
- System templates seeded in migration `20260526_000017_access_profiles.js`; re-run not idempotent for permissions (use new migration to adjust seeds).

### Migration / compatibility notes

- **Migration:** `backend/src/db/migrations/20260526_000017_access_profiles.js`
- **Backfill:** all `SUPER_ADMIN` → `WILAYA_FULL_ADMIN`; all `MUNI_ADMIN` → `MUNI_AGENT_STANDARD`; oldest wilaya admin → `can_manage_access_roles = true`.
- **Related modules:** `spec/modules/ORGANIZATION.md` (account lists), each feature module for phase-2 route guards.
- **Backend layout:**
  - `backend/src/modules/access/permissionCatalog.js`
  - `backend/src/modules/access/roleTemplateSlugs.js`
  - `backend/src/modules/access/defaultRolePermissions.js`
  - `backend/src/modules/access/userAccessService.js`
  - `backend/src/modules/access/accessRoleService.js`
  - `backend/src/middleware/requirePermission.js`
  - `backend/src/routes/accessAdmin.js`

### Phase 2 checklist (for implementers)

- [ ] Wire `requirePermission` on admin/muni routes per table above
- [ ] Extend login/me payload with `effectivePermissions` or fetch catalog client-side
- [ ] Frontend: `GET /access/role-template-slugs` + template picker + matrix
- [ ] Hide hub tiles / nav by `none`
- [ ] Respect `email_hidden` on user detail APIs
- [ ] Audit events on profile/role changes
