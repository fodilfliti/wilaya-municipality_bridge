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
- **Users**: `id`, `username`, `name`, `password_hash`, `role (SUPER_ADMIN/MUNI_ADMIN)`, `municipality_id`, `is_blocked (Boolean)`
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

### D. Internal Email System (Wilaya ↔ Communes) — Gmail-like Threads

#### D.0 Goals & Constraints
- **Purpose**: Provide an internal “email-like” communication system between **Wilaya admins** (`SUPER_ADMIN`) and **Commune users** (`MUNI_ADMIN`), with rich text, attachments, replies (threading), full traceability, and read/seen evidence.
- **Threading**: Works like Gmail: a **Thread** has a **Subject**, contains multiple **Messages**, and is **ordered by last activity** (new reply moves thread to top).
- **Rich text**: Email body supports bold/italic/lists/links like Gmail. Implementation stores **sanitized HTML** (`body_html`) generated by the frontend editor.
- **Attachments**: Any file type (PDF, images, Excel, Word, etc.) stored on the server and downloadable via `/files/...`.
- **Traceability**: System must always record **who created** a thread/message and **who replied**. Admin should see **commune name** and the **agent name** (fallback to `username`) in details.
- **Read receipts / Seen**:
  - When a user opens a thread, it is recorded as **seen** for that user.
  - Wilaya admin can view exactly which users (including commune agents) have seen the thread (“cannot claim they didn’t see it”).
- **Notifications/unread**:
  - Each user has an **unread count** for threads.
  - Opening thread details **marks as read** and the UI decrements unread count.

#### D.1 Roles & Messaging Rules
- **SUPER_ADMIN (Wilaya)**:
  - Can create new threads and send to:
    - **All communes**
    - **One or more communes**
    - **One or more users** (search by `username`)
  - Can reply in any thread they participate in.
  - Sees mail list with commune name + subject, and inside thread sees author user identities.
- **MUNI_ADMIN (Commune agent)**:
  - Can see threads where they are a recipient (directly or via commune targeting).
  - Can **only message/reply to Wilaya admins** (cannot start/participate in conversations with other communes).
- When a commune agent replies, Wilaya sees the commune name + the agent name (fallback to `username`) (shown in message header or subtitle).

#### D.2 Data Models (New)
- **MailThreads**:
  - `id`
  - `subject` (string, required)
  - `created_by_user_id` (FK Users, required)
  - `created_by_municipality_id` (FK Municipalities, nullable; set when author is `MUNI_ADMIN`)
  - `parent_thread_id` (FK MailThreads, nullable) — when a new private thread is created from a message in another thread
  - `parent_message_id` (FK MailMessages, nullable) — the specific message that started this private thread
  - `last_message_at` (timestamp, required; updated on new message)
  - `created_at` (timestamp)
- **MailMessages**:
  - `id`
  - `thread_id` (FK MailThreads, required)
  - `author_user_id` (FK Users, required)
  - `author_municipality_id` (FK Municipalities, nullable; set when author is `MUNI_ADMIN`)
  - `reply_to_message_id` (FK MailMessages, nullable) — “reply to a specific message” (light sub-thread / tag)
  - `body_html` (text, required; sanitized HTML)
  - `created_at` (timestamp)
- **MailAttachments**:
  - `id`
  - `message_id` (FK MailMessages, required)
  - `filename` (string, required)
  - `mime_type` (string, required)
  - `size_bytes` (bigint, required)
  - `file_url` (string, required; `/files/mail/...`)
  - `created_at` (timestamp)
- **MailRecipients** (per-thread, per-user mailbox state):
  - `id`
  - `thread_id` (FK MailThreads, required)
  - `user_id` (FK Users, required)
  - `recipient_kind` (enum: `DIRECT_USER`, `MUNICIPALITY_TARGET`, `ALL_MUNICIPALITIES`) — indicates why they received it
  - `recipient_municipality_id` (FK Municipalities, nullable)
  - `last_read_at` (timestamp, nullable) — for unread/notification
  - `first_seen_at` (timestamp, nullable) — for “seen evidence”
  - `last_seen_at` (timestamp, nullable)
  - `created_at` (timestamp)
  - **Uniq**: (`thread_id`, `user_id`) unique

#### D.3 Ordering, Unread, and Seen Logic
- **Thread ordering**: Inbox list sorts by `MailThreads.last_message_at DESC`.
- **Unread for a user**:
  - A thread is **unread** if `MailRecipients.last_read_at` is `NULL` OR `last_read_at < MailThreads.last_message_at`.
- **Mark as read**:
  - When a user opens thread details, backend sets `last_read_at = NOW()` for that user/thread.
- **Seen evidence**:
  - On first open, set `first_seen_at = NOW()`.
  - Always update `last_seen_at = NOW()` on open.
- **Admin “who saw it”**:
  - For any thread, admin can list all recipients with `first_seen_at/last_seen_at` and user identity (name + username + commune).

#### D.4 API Endpoints (New)
- **Admin (SUPER_ADMIN)**:
  - `GET /admin/mail/threads?page=&pageSize=&q=&unread=0|1`
    - Returns inbox threads for the admin user with unread flag + last_message_at.
  - `POST /admin/mail/threads`
    - Create a new thread with first message.
    - Body fields:
      - `subject`
      - `body_html`
      - `target`:
        - `{ type: "ALL_COMMUNES" }` OR
        - `{ type: "COMMUNES", municipality_ids: number[] }` OR
        - `{ type: "USERS", user_ids: number[] }`
    - Multipart attachments: `attachments[]`
  - `GET /admin/mail/threads/:threadId`
    - Thread details: messages, attachments, participants, and marks as read for requesting admin.
  - `POST /admin/mail/threads/:threadId/messages`
    - Reply with `body_html` + optional `attachments[]` (multipart).
    - Optional: `reply_to_message_id` to link the reply to a specific previous message.
  - `GET /admin/mail/threads/:threadId/recipients`
    - Returns recipients list with seen/read timestamps (evidence).
  - `GET /admin/users/search?q=`
    - Returns users (username + role + municipality) for recipient picker (auto-search).

- **Municipality (MUNI_ADMIN)**:
  - `GET /muni/mail/threads?page=&pageSize=&q=&unread=0|1`
  - `GET /muni/mail/threads/:threadId`
    - Marks as read/seen for requesting user.
  - `POST /muni/mail/threads/:threadId/messages`
    - Reply only to Wilaya admins; body_html + optional attachments.
    - Optional: `reply_to_message_id`.
  - `POST /muni/mail/threads/:threadId/private-reply`
    - Creates a **new private thread** to Wilaya admins only, linked to the original thread/message context:
      - Stores `parent_thread_id = :threadId`
      - Stores `parent_message_id` (optional but recommended when user clicked “Reply to this message”)
    - Body fields:
      - `subject` (optional; default `Re (private): <original subject>`)
      - `body_html`
      - `parent_message_id` (optional)
    - Multipart attachments: `attachments[]`

#### D.6 Reply-to-Message UX (Recommended)
- The system supports a lightweight “reply to a specific message” (similar to Slack/Discord replies but inside an email thread).
- When replying with `reply_to_message_id`, the UI shows a small quoted context block (author + timestamp + snippet) above the message body.
- For **private replies**, if created from a specific message, the new private thread header shows “Created from message …” and keeps the message context.

#### D.5 Audit Logging (Mandatory)
- Must log at minimum:
  - `MAIL_THREAD_CREATE` (actor, target type + ids)
  - `MAIL_MESSAGE_CREATE` (actor, thread_id, message_id)
  - `MAIL_THREAD_SEEN` (actor, thread_id, first_seen_at/last_seen_at)
  - `MAIL_THREAD_READ` (actor, thread_id, last_read_at)
  - `MAIL_ATTACHMENT_UPLOAD` (actor, thread_id, message_id, filename, size)


