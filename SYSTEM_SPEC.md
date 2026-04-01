## Master Technical Specification: Wilaya-Municipality Bridge (Version 3.0)

### System Objective
Centralized management portal for a Wilaya (Admin) to distribute software applications to Municipalities (Users). The system focuses on security, absolute traceability of every action, and monitoring which municipalities have downloaded the latest software updates.

### Technical Stack
- **Backend**: Node.js (Express.js)
- **Database**: PostgreSQL (Sequelize ORM)
- **Frontend**: React (RTL-first)
- **UI Languages**: Arabic (Default), French (No English)
- **File Storage**: Local storage for App Binaries (.exe/.msi/etc.), **Application Logos** (SVG/PNG/JPG/WebP), and generated PDFs.

### Detailed Data Models & Schema
- **Municipalities**: `id`, `name_ar`, `name_fr`, `code`, `created_at`
- **Users**: `id`, `username`, `password_hash`, `role (SUPER_ADMIN/MUNI_ADMIN)`, `municipality_id`, `is_blocked (Boolean)`
- **Applications**: `id`, `app_name`, `description`, `logo_url`, `current_version_id (FK)`
- **AppVersions**: `id`, `app_id`, `version_number` (e.g., v1.2.0), `file_url`, `release_notes`, `created_at`
- **Downloads**: `id`, `user_id`, `version_id`, `timestamp`, `ip_address`
- **AuditLogs**: `id`, `actor_id`, `action_type`, `details (JSON)`, `timestamp`

### Key Functional Features

#### A. App Management & "Latest Version" Logic
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
- **Download progress tracking** (Admin dashboard + Municipality detail page):
  - ✅ **Up-to-Date**: Municipality downloaded the latest version.
  - ⚠️ **Outdated**: Municipality downloaded an older version.
  - ❌ **Never Downloaded**: Municipality hasn’t downloaded any version.
  - 🔁 **Downgrade detected**: Municipality downloaded a newer version, then later downloaded an older version of the same app (flag based on download history ordering by version `created_at`).
  - Detail view for a single Municipality shows:
    - Per-app status.
    - Last downloaded version number and timestamp.
    - Downgrade indicator when detected.

#### A.1 Version Details (Who downloaded this version)
- Admin can open a **Version details** page for any `AppVersion` to see **only the Municipalities that downloaded that exact version**.
- The list shows (per municipality):
  - Municipality identity (code, Arabic/French names)
  - Last download time for that version
  - Total number of downloads for that version (count of events)
- Supports pagination and search by municipality code/name.

#### B. User Onboarding & 8-Digit Security
- **No self-signup**: Accounts created by Admin only, from a dedicated **Users page** (list per Municipality, with pagination).
- **Credential PDF**: When Admin creates a user:
  - System generates a username and a random **8-digit code**.
  - A PDF is generated automatically and stored server-side.
  - In the **Create User modal**, Admin immediately sees:
    - The 8-digit code.
    - A button/link to download the PDF.
- The **8-digit code** is used as the initial password (stored as `password_hash`).
- **User management**:
  - List and filter users by Municipality.
  - Block/Unblock, Reset password (new 8-digit code + new PDF).
  - Edit basic user info if needed.
- **Block mechanism**: If a user is **Blocked**, the `checkBlocked` middleware must reject their JWT immediately.

#### C. Traceability & Audit
- Every **login**, every **download**, every **password reset**, and every **block/unblock** must be stored in `AuditLogs`.
- Admins must be able to see the **history** of any municipality (e.g., “User X downloaded v2.0 at 10:00 AM”).

### Admin Analytics & Representation (Scalable Dashboard)
- Because a municipality can have **50+ apps**, the dashboard must avoid rendering an exhaustive matrix.
- Dashboard provides:
  - **Per-app adoption view**: select an app and see municipality counts across statuses (Up-to-Date / Outdated / Never Downloaded / No Versions), plus a simple stacked bar.
  - **Municipality overview list**: searchable list where each municipality shows a compact stacked progress bar across all apps + link to municipality details.

### UI/UX Design (For Simple Users)
- **Navigation**:
  - Top-level navigation with clear sections:
    - **Dashboard**: high-level progress overview.
    - **Apps**: app list, app details, and version management.
    - **Municipalities**: municipalities list + per-municipality detail page (history + per-app status and last version installed).
    - **Users**: per-municipality user management (list, create, block/unblock, reset).
    - **Version Details**: reachable from App details (versions list) to show municipalities that downloaded a specific version.
- **RTL layout** optimized for Arabic, with optional French (LTR) toggle.
- **Modal-driven UX with single responsibility per modal**:
  - One modal for **creating an app**.
  - One modal for **uploading a logo**.
  - One modal for **creating a new version**.
  - One modal for **creating a user** (shows generated 8-digit code + PDF link).
  - One modal for **resetting a user password**.
- **Theme**:
  - Navy Blue `#1e293b`
  - Success Green `#10b981`
  - Warning Orange `#f59e0b`
- **Font**: Tajawal for Arabic text.

### Execution Steps (Cursor)
1. **File Setup**: Create this `SYSTEM_SPEC.md`.
2. **Database**: Sequelize models + migrations for Users, Municipalities, Applications, AppVersions, Downloads, AuditLogs.
3. **PDF Service**: 8-digit code generation + PDF creation and local storage.
4. **Download Tracker**: API logs a download entry whenever a user downloads an app version.
5. **Analytics API**: Endpoint compares `Applications.current_version_id` with Downloads to calculate municipality progress for the Admin dashboard.
5.1 **Version Details API**: Endpoint returns municipalities that downloaded a specific `version_id` (with last_download_at + downloads_count).
5.2 **Municipality Apps API**: Endpoint returns per-app status for a municipality plus downgrade detection.
6. **Application Logos**: Admin uploads app logos (SVG/images) saved in server storage and exposed via `Applications.logo_url`.

### API Endpoints (Additions)
- **Admin**
  - `GET /admin/versions/:versionId/municipalities`
    - Returns municipalities that downloaded that version (only downloaders), with pagination + `search`.
  - `GET /admin/municipalities/:municipalityId/apps`
    - Returns per-app status for the municipality plus `downgrade` flag.

