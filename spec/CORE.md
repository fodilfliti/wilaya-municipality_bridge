## Core Specification: Wilaya–Municipality Bridge

### Purpose

This document defines **cross-cutting standards** shared by all feature modules (Apps distribution, Internal Mail, and future Bridge features). Modules must not redefine these rules unless explicitly extending them.

### Technical Stack (Baseline)

- **Backend**: Node.js (Express.js)
- **Database**: PostgreSQL (Sequelize ORM)
- **Frontend**: React (RTL-first)
- **UI Languages**: Arabic (Default), French (No English)
- **File Storage**: Local storage for binaries, attachments, logos, and generated PDFs exposed via `/files/...`

### Actors & Roles

- **Wilaya Admin**: `SUPER_ADMIN`
  - Global administrative capabilities across modules.
- **Municipality User (Commune agent)**: `MUNI_ADMIN`
  - Scoped to their `municipality_id`, subject to module rules.

### Identity & Organization Primitives

- **Municipality**: identified by `code`, with Arabic and French names.
- **User**: belongs to a municipality (nullable for Wilaya-level users depending on implementation), has a role and blocked state.

### Authentication & Access Control

- **JWT required** for protected endpoints.
- **Blocked users must be rejected immediately**:
  - The `checkBlocked` middleware (or equivalent) must reject any request with a valid JWT if `Users.is_blocked = true`.
- **Role checks**:
  - Endpoints must enforce role (`SUPER_ADMIN` vs `MUNI_ADMIN`) and scope (e.g., muni user can only access their municipality’s resources) per module rules.
- **Access profiles (granular permissions)** — `spec/modules/ACCESS_PROFILES.md`:
  - Each user may have an **access role template** (`none` / `view` / `manage` per permission key).
  - Phase 1: data + resolver (`userAccessService`) + admin catalog APIs; routes still use role-only checks.
  - Phase 2: use `requirePermission(permissionKey, minLevel)` middleware on routes; frontend hides modules with effective `none`.
  - UI must not expose internal role enum names (`SUPER_ADMIN`, `MUNI_ADMIN`) — use **compte wilaya** / **compte commune**.

### Audit Logging (Mandatory)

All modules must write to `AuditLogs` for critical actions to ensure **absolute traceability**.

#### Minimum audit record shape

- **actor_id**: user id that performed the action
- **action_type**: stable constant string (e.g., `MAIL_THREAD_CREATE`)
- **details**: JSON payload containing relevant ids and metadata
- **timestamp**

#### Global events that must be logged

- Login
- Any download of a file that represents a business action (app binaries, mail attachments, PDFs containing credentials) when applicable
- User lifecycle actions: create, block/unblock, password reset

### API Conventions (Shared)

- **Pagination**: list endpoints must support `page` and `pageSize`.
  - Defaults (unless module overrides): `page=1`, `pageSize=20`
  - Hard limit (unless module overrides): `pageSize <= 100`
- **Search**: use `q` or `search` consistently per module (module spec must declare which).
  - Search should support municipality code/name and username where relevant.
- **Sorting**: list endpoints must define stable ordering (e.g., most recent first) in module spec.
- **Error format**: consistent JSON errors (exact schema to be defined by implementation; keep stable and documented).

### File Storage & Downloads (Shared)

- Store files on the server and expose via **download endpoints or `/files/...` routes**.
- File metadata (filename, mime type, size) must be stored where the module requires traceability.
- Downloads must be **authorized** (role + recipient checks) before serving file bytes.
  - For mail attachments: requester must be a thread recipient.
  - For app binaries: requester must be a permitted municipality user (or admin) per module rules.
  - For generated PDFs (credentials): requester must be authorized (typically admin).
  - Always enforce `checkBlocked`.

### Content Safety (Shared)

- Any feature that stores rich text HTML must store **sanitized HTML** and must document the sanitization approach in its module spec.

### UI/UX Global Rules

- **RTL-first** layout optimized for Arabic.
- Optional **French (LTR) toggle**.
- Navigation uses clear sections; modules add their own screens but follow consistent patterns:
  - List → Details → Actions (modals/forms)
  - Search + pagination on large lists.

#### Page headers: action row order

- On any screen that shows a **row of actions** (links and buttons) next to the title, **primary / secondary actions come first**; the **“Retour” / back** control (navigation to the parent list or previous context) is **always last** in that row (trailing control), including in **LTR** French mode. Do not place back before refresh, export, save, or module-specific actions.

#### Back navigation (`BackButton`)

- Use the shared **`BackButton`** component (`frontend/src/components/BackButton.tsx`) for **Retour** on module pages—not a hard-coded `Link` to `/` or the hub.
- Behaviour: **`navigate(-1)`** when browser history exists; otherwise **`fallbackTo`** (e.g. `/municipalities`, `/operations`, `/apps`) so deep links still have a sensible exit.
- Example: from `/municipalities/1?tab=etat` → état principal grid with `?municipalityId=1` → **Retour** returns to the commune detail page, not the home hub.

#### Async actions, loading, and errors

- Controls that **trigger network or heavy work** (load, refresh, export, submit, PDF generation, etc.) must:
  - Use a **clear loading/disabled state** on the control while the request is in flight when it avoids double submits.
  - On failure, show a **user-readable message** via the app’s **snackbar** (in addition to inline or modal error where already used), using the same **`formatApiErrorMessage`** (or equivalent) pattern as other screens—not silent `.catch(() => {})` for user-initiated actions.

### App shell & main navigation (dashboard hub)

The client expects **many modules** (target at least **8** features). Use a single **app shell** so navigation stays predictable.

#### Persistent header (all authenticated layouts)

- Place **Internal Mail** entry **in the top header** (icon + label, unread badge when applicable). Mail must be reachable **from any screen** without returning to the home hub first.
- Header also holds: app title/branding, language toggle, user menu (logout, profile if added later).

#### Main landing page (after login)

- Use a **dashboard / hub** layout with **large clickable tiles or buttons**: each tile shows an **icon + short title** (Arabic primary; French where configured), similar to modern launcher-style apps.
- One click opens the corresponding module route (full-screen module UI below the same shell header).
- **Wilaya admin hub section order** (five sections; see `ACCESS_PROFILES.md`):
  1. **État principal** (backup servers, MCLT, annex RNC)
  2. **Commune & organisation** (operations, communes, annexes registry, IT staff)
  3. **Applications** (dashboard + apps distribution)
  4. **Wilaya & comptes** (`/wilaya-admins`, `/users`)
  5. **Accès rapide** (shortcuts — lowest priority)

#### Organization & users (Wilaya only) — **two separate flows**

Commune (municipality) setup and commune **agent** (user) setup must **not** be a single combined wizard. They are **separate features** so each can grow (extra fields, workflows, validations) without coupling.

| Flow               | Responsibility                                                                | Notes                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Communes**       | Create, edit, list **municipality** records (`code`, `name_ar`, `name_fr`, …) | No user credentials here.                                                                                                 |
| **Commune agents** | Create, edit, list **`MUNI_ADMIN`** users **for a chosen commune**            | Follows existing user rules: no self-signup, 8-digit initial password, PDF where applicable (see `spec/modules/APPS.md`). |

- **Independence**: Wilaya may create a commune first and add agents later; may add agents to an existing commune; may manage communes without touching users in the same session.
- **Navigation (frontend)**:
  - **Option A**: Two distinct **hub tiles** (e.g. “Communes” and “Agents des communes”), or
  - **Option B**: One **“Administration”** hub tile that opens a landing page with **two equal primary actions** (same two flows as separate routes).
  - Implementation choice; **requirement** is **two separate routes** and UIs, not one merged form.
- **Add Wilaya admin** (`SUPER_ADMIN`): `/wilaya-admins`; requires `can_create_wilaya_admins` on caller.
- **Access role templates** (system enum + custom): assign on user; customize per-user overrides — `spec/modules/ACCESS_PROFILES.md`.

Canonical detail: `spec/modules/ORGANIZATION.md` (accounts), `spec/modules/ACCESS_PROFILES.md` (permissions).

### Excel export (cross-cutting pattern)

Some modules (starting with **Operations**) allow exporting tabular data to **`.xlsx`** for sharing outside the app.

#### Recommended implementation: **server-generated export**

- **Why**: Authorization matches APIs (only data the user may see); large Wilaya consolidated exports stay reliable; **audit** can log `*_EXPORT` events; filenames and encoding stay consistent.
- **Flow**: `GET .../export.xlsx` or `POST .../export` returns `Content-Disposition: attachment` (or short-lived signed URL). Use a maintained library on the server (e.g. ExcelJS / SheetJS server-side) to build the workbook.

#### Optional: client-only export

- Acceptable **only** for small, already-loaded datasets (e.g. commune exporting **their own** operation sheet after fetch). Still enforce that the user never sees other communes’ rows.

#### Cell borders (mandatory for server-generated `.xlsx`)

- Every **populated table region** (headers, data rows, summary blocks, and extra worksheets such as statistics) must use a **consistent thin border** on all relevant cells so exports read clearly when printed or opened outside the app.
- **Implementation**: reuse `backend/src/services/excelThinBorders.js` (`thinCellBorder()`, and `applyThinBordersToRange()` when you add rows in bulk and need a full grid). Do not duplicate ad‑hoc border constants in each export module unless a product spec explicitly requires a different weight or color.

### Module Template (Canonical)

Every module spec should follow this structure:

1. **Purpose & constraints**
2. **Roles & rules**
3. **Data model**
4. **Workflows**
5. **API endpoints**
6. **UI/UX**
7. **Audit events**
8. **Non-functional requirements**
9. **Migration/compatibility notes**
