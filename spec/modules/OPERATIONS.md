## Module: Operations (Structured Requests + Commune Data Collection)

### Purpose & constraints
- Replace ad-hoc Excel exchanges (Wilaya ↔ Communes) with an in-app **structured spreadsheet-like** workflow.
- Wilaya creates an **Operation** (title/description) and defines **columns** (type + options). Communes fill rows (like Excel) directly in the app.
- Wilaya views consolidated results across communes, ordered by commune code, and sees **graphs** for selected result columns.
- Column types must be enforced (boolean/number/list/text) and UI must be usable for long text cells (auto-grow, sensible max widths).
- **Languages/UI**: Arabic RTL-first, French toggle (per Core).

### Roles & rules
- **SUPER_ADMIN (Wilaya)**:
  - Create operations, define/edit columns (add/delete/update), and decide which columns generate analytics/graphs.
  - Target an operation to:
    - **All communes**
    - **One or more communes**
    - (Optional, if needed later) **One or more users** (direct user targeting)
  - View consolidated results table across all communes.
  - Configure colors for booleans and list choices; colors are persisted and can be changed later.
- **MUNI_ADMIN (Commune agent)**:
  - View operations list (latest first).
  - Open an operation and fill the operation sheet by adding/editing rows.
  - Must respect column types and allowed values.
  - Only sees operations they are a recipient of (directly or via commune targeting).

### Data model

#### Operations
- `id`
- `title`
- `description`
- `created_by_user_id` (FK Users)
- `target_kind` (enum: `ALL_MUNICIPALITIES`, `MUNICIPALITIES`, `USERS`)
- `created_at`
- `updated_at`

#### OperationRecipients
Defines who should see/fill the operation (mailbox-style targeting).
- `id`
- `operation_id` (FK Operations, required)
- `user_id` (FK Users, required)
- `recipient_kind` (enum: `DIRECT_USER`, `MUNICIPALITY_TARGET`, `ALL_MUNICIPALITIES`)
- `recipient_municipality_id` (FK Municipalities, nullable)
- `created_at`
- **Uniq**: (`operation_id`, `user_id`) unique

#### OperationColumns
Defines the schema for an operation’s sheet.
- `id`
- `operation_id` (FK Operations, required)
- `key` (string, required) — stable identifier used in row values (e.g., `fiber_installed`)
- `label_ar` (string, required)
- `label_fr` (string, optional)
- `column_type` (enum: `BOOLEAN`, `NUMBER`, `TEXT`, `CHOICE`, required)
- `position` (int, required) — column ordering
- `is_result` (boolean, default false) — whether column contributes to analytics
  - Constraint: only allowed for `BOOLEAN`, `NUMBER`, `CHOICE` (not `TEXT`)
- `default_value` (JSON, nullable) — defaults depend on type:
  - `BOOLEAN`: default `false`
  - `NUMBER`: default `0`
  - `CHOICE`: optional default choice key
  - `TEXT`: optional default empty string
- `created_at`
- `updated_at`

#### OperationColumnChoices
Choice values for `CHOICE` columns.
- `id`
- `column_id` (FK OperationColumns, required)
- `value_key` (string, required) — stable key (e.g., `protocol_a`)
- `label_ar` (string, required)
- `label_fr` (string, optional)
- `color_hex` (string, required) — persisted display color for this choice
- `position` (int, required)
- `created_at`
- `updated_at`

#### OperationSheets (per municipality)
One sheet per operation per municipality.
- `id`
- `operation_id` (FK Operations, required)
- `municipality_id` (FK Municipalities, required)
- `updated_by_user_id` (FK Users, nullable) — last editor
- `updated_at`
- **Uniq**: (`operation_id`, `municipality_id`) unique

#### OperationRows
Rows within a sheet (per municipality).
- `id`
- `sheet_id` (FK OperationSheets, required)
- `row_index` (int, required) — stable ordering within the sheet
- `created_at`
- `updated_at`

#### OperationCellValues
Cell values stored per row and column.
- `id`
- `row_id` (FK OperationRows, required)
- `column_id` (FK OperationColumns, required)
- `value_json` (JSON, required) — typed value:
  - `BOOLEAN`: `{ "value": true|false }`
  - `NUMBER`: `{ "value": 123.45 }`
  - `TEXT`: `{ "value": "..." }`
  - `CHOICE`: `{ "value_key": "protocol_a" }`
- `created_at`
- `updated_at`
- **Uniq**: (`row_id`, `column_id`) unique

#### Notes on evolution (column edits)
- Column changes must not require communes to “start from scratch”.
- If a column is **added**, existing rows implicitly use `default_value`.
- If a column is **deleted**, existing `OperationCellValues` for that column should be removed/ignored.
- If a column type changes, migration rules must be defined (e.g., coercion or reset to default).

### Workflows

#### Operation lifecycle
- **Create**: Wilaya defines title/description, selects targets (all communes or selected), and initial columns.
- **Edit**: Wilaya can update title/description and column definitions:
  - Add column
  - Delete column
  - Update column label/type/default/is_result
  - Manage choice lists and colors for `CHOICE`
- **Retarget (optional)**:
  - Wilaya can change targeting (e.g., from all communes to selected communes) by updating recipients.
- **Commune input**:
  - Commune opens operation → sees spreadsheet-like grid → adds/edits rows → saves.
  - Validation enforced per column type and allowed values.
- **Wilaya results**:
  - Wilaya opens operation results → sees consolidated table with first column = municipality code/name, ordered numerically by code (`1003`, `1004`, ...).
  - Below the table: graphs for columns where `is_result = true`.

#### Excel export (Wilaya & commune)
Both sides may **download an `.xlsx`** file to attach elsewhere (email, USB, manual consolidation outside the app).

| Actor | Export scope | Implementation preference |
|-----|-----|-----|
| **Wilaya** | Consolidated table for an operation (all targeted communes, columns + labels, sorted by commune code) | **Server** (`GET` export endpoint): authz + audit + large payloads |
| **Commune** | That commune’s sheet only (their rows for the operation) | **Server** preferred; **client** acceptable if dataset is already loaded and small |

- **Headers**: Use column labels (`label_ar` / active locale); first column **commune code** then name on Wilaya export; commune export may omit commune column or repeat identifier once in title/metadata row.
- **Values**: Booleans as localized Yes/No (or نعم/لا); numbers as numbers; choice as display label; text as plain text.
- **Audit**: Log `OPERATION_EXPORT_WILAYA` / `OPERATION_EXPORT_COMMUNE` with `operation_id`, optional `municipality_id`.

#### Result graphs (analytics rules)
- **BOOLEAN result columns**:
  - Show counts and percentages of Yes/No.
  - Color mapping: green for true, red for false (configurable if needed, but defaults as stated).
- **CHOICE result columns**:
  - Show distribution by choice, using the persisted `color_hex` per choice.
- **NUMBER result columns**:
  - Show summary statistics (at minimum: count, min, max, avg) and a simple distribution graph if needed.
- **TEXT columns**: never generate graphs.

### API endpoints

#### Admin (SUPER_ADMIN)
- `GET /admin/operations?page=&pageSize=&q=`
  - List operations (latest first).
- `POST /admin/operations`
  - Create operation with initial columns.
  - Body includes `target` (same pattern as Mail):
    - `{ type: "ALL_COMMUNES" }` OR
    - `{ type: "COMMUNES", municipality_ids: number[] }` OR
    - `{ type: "USERS", user_ids: number[] }`
- `GET /admin/operations/:operationId`
  - Operation details (including columns and choices).
- `PATCH /admin/operations/:operationId`
  - Update title/description.
- `PUT /admin/operations/:operationId/recipients`
  - Replace targeting/recipients for the operation.
- `POST /admin/operations/:operationId/columns`
  - Add a column.
- `PATCH /admin/operations/:operationId/columns/:columnId`
  - Update column metadata (`label_*`, `column_type`, `default_value`, `is_result`, `position`).
- `DELETE /admin/operations/:operationId/columns/:columnId`
  - Delete a column.
- `POST /admin/operations/:operationId/columns/:columnId/choices`
  - Add a choice (with `color_hex`).
- `PATCH /admin/operations/:operationId/columns/:columnId/choices/:choiceId`
  - Update choice label/color/position.
- `DELETE /admin/operations/:operationId/columns/:columnId/choices/:choiceId`
  - Remove a choice.
- `GET /admin/operations/:operationId/results`
  - Consolidated results across municipalities:
    - First column: municipality code/name
    - Sorted by municipality code ascending (numeric ordering)
    - Includes computed aggregates for `is_result` columns for graphs.
- `GET /admin/operations/:operationId/export.xlsx`
  - Returns Excel workbook for **Wilaya consolidated** view (authorized recipients only). Audit `OPERATION_EXPORT_WILAYA`.

#### Municipality (MUNI_ADMIN)
- `GET /muni/operations?page=&pageSize=&q=`
  - List available operations for that user (recipient filter), latest first.
- `GET /muni/operations/:operationId`
  - Operation details + column schema for rendering the grid.
- `GET /muni/operations/:operationId/sheet`
  - Returns the municipality sheet: rows + values.
- `PUT /muni/operations/:operationId/sheet`
  - Upsert the sheet content (rows and values) with type validation.
- `GET /muni/operations/:operationId/export.xlsx`
  - Returns Excel workbook for **this commune’s sheet only**. Audit `OPERATION_EXPORT_COMMUNE`.

### UI/UX
- Entry from the **main hub** (see `spec/CORE.md`): Operations is the hub tile for this module (baseline hub order: tile **#3**).
- **Municipality side**
  - Operations list (latest first).
  - Operation details screen: Excel-like grid.
    - Supports add row, edit cells, select choice values, toggle boolean, number input.
    - TEXT cells should be comfortable for 1–2 sentences (auto-grow height, reasonable max width).
    - Column width heuristics:
      - `TEXT`: wider
      - `CHOICE`/`BOOLEAN`: compact
      - `NUMBER`: medium
    - Validation messages should be clear and localized.
- **Wilaya side**
  - Operations list.
  - Operation editor: title/description + column builder:
    - Pick column type and default value.
    - `is_result` toggle available only when type is `BOOLEAN`/`NUMBER`/`CHOICE`.
    - For `CHOICE`, manage list of choices and set a persisted color per choice.
  - Results view:
    - Table view first (sorted by commune code)
    - Graphs section for `is_result` columns below the table
    - Optionally color-highlight cells using boolean/choice colors in the table view when enabled.
    - **Export Excel** button (icon + label) on results view; file suitable for forwarding “any direction” (email attachment, etc.).
- **Commune operation sheet screen**
  - **Export Excel** button for local copy of their submission.

### Audit events (minimum)
- `OPERATION_CREATE` (actor, operation_id)
- `OPERATION_UPDATE` (actor, operation_id, changed_fields)
- `OPERATION_COLUMN_CREATE` / `OPERATION_COLUMN_UPDATE` / `OPERATION_COLUMN_DELETE` (actor, operation_id, column_id)
- `OPERATION_CHOICE_CREATE` / `OPERATION_CHOICE_UPDATE` / `OPERATION_CHOICE_DELETE` (actor, operation_id, column_id, choice_id)
- `OPERATION_SHEET_UPDATE` (actor, operation_id, municipality_id, row_count)
- `OPERATION_RESULTS_VIEW` (actor, operation_id) — optional, if you want evidence of “who consulted results”
- `OPERATION_EXPORT_WILAYA` / `OPERATION_EXPORT_COMMUNE` (actor, operation_id, municipality_id optional)

### Non-functional requirements
- Must support many municipalities and multiple operations without heavy payloads:
  - Paginate operation lists.
  - For sheets, support reasonably sized row sets; if very large, add server-side paging later.
- Enforce authorization on all reads/writes:
  - MUNI_ADMIN can only access their municipality sheet.
  - Admin can access all.
- Persist and reuse colors for choices to ensure stable analytics visuals over time.

### Migration/compatibility notes
- This module complements Internal Mail (for discussion/clarification) and Apps (for distribution) but is independent in data model.
- **Import** of Excel back into the system (upload to bulk-fill rows) is **out of scope** unless added later; **export** is specified above.
- **Related:** fixed-schema commune IT staff registry (same “table + Excel” idea, no dynamic columns): `spec/modules/COMMUNE_IT_STAFF.md`.
