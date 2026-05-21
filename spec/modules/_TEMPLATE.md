## Module: <NAME>

### Purpose & constraints
- What problem this module solves
- Hard constraints (legal, language, performance, offline, etc.)

### Roles & rules
- **SUPER_ADMIN**:
  - ...
- **MUNI_ADMIN**:
  - ...
- Any cross-organization restrictions (e.g., no commune-to-commune messaging)

### Data model
- **Tables**:
  - `<TableName>`: fields...
- **Relationships**:
  - ...
- **Indexes & constraints**:
  - Uniq constraints, required indexes, foreign keys

### Workflows
- Main flows (create, update, close, approve, etc.)
- If there is a lifecycle, define a **state machine** and allowed transitions

### API endpoints
- **Admin**:
  - `GET ...`
  - `POST ...`
- **Municipality**:
  - `GET ...`
  - `POST ...`
- Define pagination/search params and ordering for list endpoints
- Note authorization rules for sensitive reads and file downloads

### UI/UX
- Navigation entry point(s)
- Screens:
  - List
  - Details
  - Create/edit (modal or page)
- Key UX requirements (RTL, French toggle, evidence/receipts, etc.)
- **Form validation** (required for every create/edit screen — see `spec/CORE.md` § Form validation):
  - Zod schema path (`frontend/src/validation/schemas/...`) and field → i18n keys
  - Per-field errors, global block above Save, snackbar on block/API failure
  - Matching server `validateBody` + `fieldErrors` on write endpoints

### Audit events (minimum)
- Stable action types and required `details` payload fields

### Non-functional requirements
- Performance constraints (list size, ordering)
- Storage/retention policy (if applicable)
- Security considerations (e.g., sanitized HTML, access checks)

### Migration/compatibility notes
- Interactions with other modules
- Backwards compatibility and rollout considerations

