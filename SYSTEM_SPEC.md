## Master Technical Specification (Index): Wilaya–Municipality Bridge

### Objective (Updated)

The system is a **Bridge for communications and operations** between **Wilaya (Admin)** and **Municipalities/Communes (Users)**. It includes software distribution, internal messaging, and will expand with additional modules (announcements, tickets, chat, documents, etc.).

### Canonical spec documents

- **Core (shared standards + app shell / main hub navigation + Excel export pattern + global UI action order & async error/snackbar rules)**: `spec/CORE.md`
- **Modules**:
  - **Apps distribution & update tracking**: `spec/modules/APPS.md`
  - **Internal mail (threads + attachments + seen/read evidence)**: `spec/modules/MAIL.md`
  - **Operations (structured requests + commune data collection)**: `spec/modules/OPERATIONS.md`
  - **Organization (Wilaya): communes vs commune agents — separate flows**: `spec/modules/ORGANIZATION.md`
  - **Access profiles (roles, permissions, job title, department)**: `spec/modules/ACCESS_PROFILES.md`
  - **Municipality annexes (bureaux annexes / points de service)**: `spec/modules/ANNEXES.md`
  - **Commune IT professionals (ingénieurs & techniciens informatique)**: `spec/modules/COMMUNE_IT_STAFF.md`
  - **État principal (fixed per-commune grids; serveurs de secours, etc.)**: `spec/modules/ETAT_PRINCIPAL.md`
  - **État principal — postes MCLT & autorisation RNC**: `spec/modules/ETAT_PRINCIPAL_MCLT.md`
  - **État principal — IP autorisée RNC (annexes)**: `spec/modules/ETAT_PRINCIPAL_ANNEX_RNC.md`

### Cross-cutting updates (recent)

- **Access profiles & permissions:** optional user fields (`job_title`, `department`, `email`, `email_hidden`), role templates (9 system enum slugs + custom roles), permission matrix (`none` / `view` / `manage`) per module — `spec/modules/ACCESS_PROFILES.md`; migration `20260526_000017_access_profiles.js`; APIs under `/admin/access/*`; enforcement UI phase 2.
- **Organization (Wilaya):** consolidated account lists `/wilaya-admins` and `/users`; UI labels **compte wilaya** / **compte commune** (not raw role enums) — `spec/modules/ORGANIZATION.md`.
- **Wilaya hub (5 sections):** 1 État principal → 2 Commune & organisation → 3 Applications → 4 Wilaya & comptes → 5 Accès rapide — `spec/CORE.md`, `ACCESS_PROFILES.md`.
- **Navigation:** `BackButton` — browser back with sensible fallback (`spec/CORE.md`).
- **Wilaya commune detail:** tab order Applications → État principal → Utilisateurs → Annexes; état links pass `?municipalityId=` (`spec/modules/ORGANIZATION.md`, `ETAT_PRINCIPAL.md`).
- **Annex registry:** no `ip_address` column — RNC IPs in `ETAT_PRINCIPAL_ANNEX_RNC.md` (`spec/modules/ANNEXES.md`).
- **Commune état MCLT / annex RNC:** 3-step UX (brouillon → demande RNC → transmission) — `ETAT_PRINCIPAL_MCLT.md`, `ETAT_PRINCIPAL_ANNEX_RNC.md`.
- **Mail pre-send validation:** optional multi-validator approval on **new thread compose only**; scoped validator pickers (commune colleagues / wilaya admins); discussion + send-without-validation flag — `spec/modules/MAIL.md`.

### What to do when adding a new feature

- Create a new module file under `spec/modules/` using the **Module Template** defined in `spec/CORE.md`.
- Link it from this index under **Modules**.
- Only add/extend cross-cutting rules in `spec/CORE.md` when the new feature introduces a rule shared by multiple modules.
