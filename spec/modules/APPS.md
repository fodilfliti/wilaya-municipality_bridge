## Module: Applications Distribution & Update Tracking

### Purpose & constraints
Centralized management portal for a Wilaya (Admin) to distribute software applications to Municipalities (Users). The module focuses on security, absolute traceability of every action, and monitoring which municipalities have downloaded the latest software updates.

### Roles & rules
- **SUPER_ADMIN (Wilaya)**:
  - Full CRUD on Applications and Versions.
  - Views analytics and municipality adoption status.
- **MUNI_ADMIN (Municipality)**:
  - Downloads application versions made available by Wilaya.
  - Download actions must be tracked.

### Data model
Baseline entities used by this module:
- **Municipalities**: `id`, `name_ar`, `name_fr`, `code`, `created_at`
- **Users**: `id`, `username`, `name`, `password_hash`, `role (SUPER_ADMIN/MUNI_ADMIN)`, `municipality_id`, `is_blocked (Boolean)`
- **Applications**: `id`, `app_name`, `description`, `logo_url`, `current_version_id (FK)`
- **AppVersions**: `id`, `app_id`, `version_number` (e.g., v1.2.0), `file_url`, `release_notes`, `created_at`
- **Downloads**: `id`, `user_id`, `version_id`, `timestamp`, `ip_address`
- **AuditLogs**: `id`, `actor_id`, `action_type`, `details (JSON)`, `timestamp`

### Workflows

#### A. App management & “Latest Version” logic
- Admin creates **Applications** from a dedicated **Apps page** (list with pagination).
- Each App has:
  - Basic info (name, description).
  - One shared **logo** (`Applications.logo_url`) used by all versions, but can be replaced when uploading a new version.
  - A list of **versions** (`AppVersions`) with full CRUD:
    - Create new version (upload binary, version number, optional notes, optional new logo).
    - Edit version metadata (version number, notes).
    - Delete version.
- When Admin uploads a new version, the system sets `Applications.current_version_id` so this becomes the **Latest Version**.
- If the Admin provides a **new logo** during version upload, it replaces the app logo; otherwise the previous logo stays.

#### B. Download progress tracking (admin dashboard + municipality detail)
Track per municipality per app:
- ✅ **Up-to-Date**: Municipality downloaded the latest version.
- ⚠️ **Outdated**: Municipality downloaded an older version.
- ❌ **Never Downloaded**: Municipality hasn’t downloaded any version.
- 🔁 **Downgrade detected**: Municipality downloaded a newer version, then later downloaded an older version of the same app (flag based on download history ordering by version `created_at`).

Detail view for a single Municipality shows:
- Per-app status
- Last downloaded version number and timestamp
- Downgrade indicator when detected

#### C. Version details (who downloaded this version)
Admin can open a **Version details** page for any `AppVersion` to see **only the Municipalities that downloaded that exact version**.
The list shows (per municipality):
- Municipality identity (code, Arabic/French names)
- Last download time for that version
- Total number of downloads for that version (count of events)
Supports pagination and search by municipality code/name.

### API endpoints

#### Admin
- `GET /admin/versions/:versionId/municipalities`
  - Returns municipalities that downloaded that version (only downloaders), with pagination + `search`.
- `GET /admin/municipalities/:municipalityId/apps`
  - Returns per-app status for the municipality plus `downgrade` flag.

### UI/UX
- Entry from the **main hub** (see `spec/CORE.md`): Apps is the primary tile for software distribution (baseline hub order: tile **#2**).
- Navigation sections relevant to this module:
  - **Dashboard**: high-level progress overview.
  - **Apps**: app list, app details, and version management.
  - **Municipalities**: list + per-municipality detail page (history + per-app status and last version installed).
  - Creating/editing **communes** and **commune agents** (Wilaya onboarding) is specified under **`spec/modules/ORGANIZATION.md`** as **separate flows**, not here.
  - **Version Details**: reachable from App details (versions list) to show municipalities that downloaded a specific version.
- Modal-driven UX with single responsibility per modal:
  - Create app
  - Upload logo
  - Create new version

### Audit events (minimum)
- Login
- App create/update/delete
- Version create/update/delete
- Binary download (`Downloads` row + corresponding audit log)

### Non-functional requirements
- Dashboard must avoid rendering an exhaustive matrix if a municipality can have **50+ apps**:
  - Provide a **per-app adoption view** and a **municipality overview list** with compact visualization.

### Migration/compatibility notes
- This module is the original core of the system and remains compatible with the Internal Mail module and any future Bridge modules via shared Core standards.

