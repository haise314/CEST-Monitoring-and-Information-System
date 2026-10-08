# AI_HANDOFF — CEST-MIS

Current-state handoff. Basis: supplied source files + supplied `cest-mis-schema.sql` (`pg_dump` schema-only, Postgres 17.6).
Labels: `CONFIRMED` (seen in code/SQL) · `INFERENCE` · `UNKNOWN` · `OPEN`.
**Not supplied:** `vite.config`, `migrations/` folder, `docs/*.md` (referenced in code comments), tests, seed data (`document_types`, `project_types` rows), and several files this doc names from earlier rounds (`ProjectDetail`'s siblings are present; `useMergedBeneficiaries.js`, `useBeneficiaryLocations.js`, `useDocuments`-style helpers not re-sent are marked `UNKNOWN` where relevant). File paths are `INFERENCE` from import statements (uploads were flattened).
Fastest onboarding: read **§11** first.
**Last re-synced:** against the full current source + a re-dumped schema. Big changes since the previous version: **map pins now live on projects (not beneficiaries)**, **custom per-project-type map icons shipped**, **a project's beneficiary can now be reassigned**, **contacts have an email**, a public **About page**, and a shared **`ModalShell`**. `cest-mis-schema.sql` **is now current** (includes `contact_beneficiaries`, `save_contact` w/ email, `reassign_project_beneficiary`, `icon_svg`, project coordinates).

---

## 1. Project Overview

- **What:** CEST-MIS ("Monitoring & Information"), an internal web app for a **Provincial CEST office in Zambales, PH** (`CONFIRMED` by `About.jsx`: "DOST CEST 2.0 – Implementation of CEST 2.0 Project in Region 3"; office coords in `officeLocation.js`, map centered on Zambales).
- **Purpose:** track CEST **projects** (equipment/interventions deployed to **beneficiaries** like LGUs, schools, co-ops), their **document compliance checklists**, contacts, yearly **budget**, and **field-visit itineraries** on a map.
- **Users:** small office staff, three roles: `admin`, `editor`, `viewer`.
- **Stack** (`CONFIRMED` from `package.json`): React 19 (Vite 8, JS not TS) · react-router v7 (data router) · Tailwind v4 (`@tailwindcss/vite`) · TanStack Table v8 · react-leaflet 5 / Leaflet + `react-leaflet-cluster` / `leaflet.markercluster` (OSM tiles) · Supabase (`supabase-js` v2; Postgres + Auth; no backend of our own) · ESLint 10. Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Scripts: `dev`, `build`, `lint`, `preview` (no test script).
- **State:** feature-complete internal tool in active iteration. Deployment host: `UNKNOWN`.

## 2. Architecture

```
Browser SPA (Vite/React)
  main.jsx: index.css (just @import tailwindcss) + theme.css  →  App
  App.jsx: ThemeProvider > ToastProvider > AuthProvider > RouterProvider
     ├ /login, /about              (public)
     └ RequireAuth > AppLayout (Sidebar + Topbar + BackupReminder + <Outlet/>)
          pages/*  ──►  hooks/*  ──►  supabase-js  ──►  Supabase Postgres (RLS + RPCs) + Auth
                    └─► lib/* (pure logic: filterEngine, documentStatus, documentProgress, budget, geo, svgIcon)
```

- **Routes** (`App.jsx`): public `/login`, `/about`; under auth: `/` Dashboard, `/overview`, `/projects`, `/projects/:id`, `/documents`, `/beneficiaries`, `/contacts`, `/map`, `/budget`, `/backup`. `/itinerary` → redirect `/map?mode=plan`. `/about` is **not** in the sidebar (reachable from the Login card; its back-link goes to `/` or `/login`).
- **Provider order matters:** `AuthProvider` calls `useToast()`, so `ToastProvider` must wrap it. `ToastContext` only exposes `success/error/info`; `AuthContext.notify()` picks `warning || info || error || success`, so the session warnings render as `info`.
- **Data access:** every hook calls Supabase directly. **No shared cache / no react-query.** Each hook instance owns its own state; two hooks on the same table = two independent copies (hence `onDocumentsChanged` between `DocumentChecklist` and `Documents.jsx`, and `onChanged`/`refetchProjectTypes` for the type manager).
- **Hook contract:** `{ data, loading, error, refetch, ...mutations }`. Mutations **never throw**; they return `{ error }` (string|null). Callers show errors inline; toasts only confirm success.
- **Auth:** Supabase email+password. `AuthContext` exposes `session, user, loading, profile, role, isAdmin, canEdit, signIn, signOut`. Role comes from `profiles.role`; profile re-read on window focus (role changes in the Supabase dashboard apply without re-login). App holds on loading until the profile is read.
- **Session policy:** hard 12 h limit, **client-side only** (`localStorage.cest_signed_in_at`, checked on load/focus/visibility/1-min interval, warning 10 min before).
- **Permissions are enforced twice:** hooks/UI check `canEdit`/`isAdmin` for UX; **RLS is the real enforcement**. Mutations that could be silently rejected by RLS use `.select('id')` and treat 0 rows as "no permission" (`useProjectTypes`, `useProjectTypeIcons`, `useContactMutations`, `useMapSites.setLocation`).
- **Theming:** `theme.css` implements dark mode by **remapping Tailwind color CSS variables** under `.dark` (no `dark:` variants). `bg-white` is overridden to `--surface`. Native `<select>` popups get explicit colors under `.dark`. Leaflet tiles are inverted in dark mode; `.cest-cluster` styles the cluster bubble. Toggle in `ThemeContext` (`localStorage.cest_theme`, defaults to OS).
- **Responsive:** list pages render both a table (`hidden md:block`) and `MobileCardList` (`md:hidden`); modals become bottom sheets on phones; inputs use `text-base sm:text-sm` (iOS zoom); filter pop-ups become bottom sheets.
- **Persistence keys:** `sessionStorage`: `projectsFilters`, `documentsFilters`, `mapOverviewFilters`, `mapPlanFilters`, backup-reminder dismiss. `localStorage`: `projectsColumnSizing`, `beneficiariesColumnSizing`, `contactsColumnSizing`, `editPanelWidth`, `cest_sidebar_collapsed`, `cest_theme`, `cest_signed_in_at`.
- **External services:** Supabase; OpenStreetMap tile servers.

## 3. Important Files / Modules

```
src/main.jsx, App.jsx            bootstrap, routes, providers, RequireAuth
src/lib/
  AuthContext.jsx                session, profile/role, 12h limit
  ToastContext.jsx, ThemeContext.jsx
  supabase.js                    client
  filterEngine.js                pure filter logic (types: select|text|number|date|link|custom)
  documentStatus.js              status rank, overdue/upcoming, DOC_CONDITIONS
  documentProgress.js            phase order, completion %, bar colors
  budget.js                      budget rules (see §6)
  geo.js / officeLocation.js     haversine, nearest-neighbor order, office start point
  svgIcon.js                     sanitizeSvg (upload validation) + svgMaskUrl (CSS mask url) for map icons
  exportCsv.js                   CSV export for any TanStack table
  formatRelativeTime.js          "3 days ago" (Contacts "Updated" column)
  Leafleticon.js                 fixes Leaflet default marker image paths under Vite (imported by Map.jsx)
src/hooks/
  useProjects                    project_instances CRUD (+project_types, beneficiaries embed); reassignBeneficiary (RPC)
  useBeneficiaries               beneficiaries CRUD (+ linked project count; exports projectCount)
  useContacts                    beneficiary_contacts, all; each row has `beneficiaries[]` + `beneficiary_ids[]`; add/update via save_contact RPC
  useContactMutations            write-only: saveContact(id,data) RPC (incl. email), linkContact, unlinkContact, deleteContact
  useBeneficiaryContacts         contacts of ONE beneficiary via contact_beneficiaries (+ beneficiary_ids); silent refetch()
  useProjectContacts             project_contacts link table for one project (+ beneficiary_ids per contact); silent refetch()
  useDocuments(projectId)        checklist per project + generateDocuments + updateDocument (optimistic)
  useAllDocuments                every document + project/beneficiary embed; fetched in 1000-row ranged pages
  useDocumentTypes               document_types read
  useRemarks(projectId)          append-only remarks + author-name resolution from profiles
  useAllRemarks(limit)           read-only feed for Dashboard
  useBudgets                     annual_budgets read + upsert by year
  useMapSites                    ★ one "site" per PROJECT (beneficiary details flattened on top, pin = project lat/lng); setLocation/clearLocation (optimistic overrides); documentTypesByPhase; exports siteLabel()
  useItineraries                 itineraries + stops (stops are PROJECTS); saveStops = delete-then-insert
  useFormData                    lookups for add/edit forms; inline create project_type / beneficiary; silent refetchProjectTypes()
  useProjectTypes                project_types + usage count; add / rename / delete (admin manager; delete blocked while in use)
  useProjectTypeIcons            project_types.icon_svg read (separate so SVG text isn't on every project row); saveIcon (admin); iconsById
  useSessionState, useColumnSizing   storage-backed state helpers
src/components/common/           FilterChips, Select, SearchableSelect (portal list, search), ModalShell (header/scroll body/sticky footer; Esc closes, backdrop does NOT), ResizableTh, VisibilityPanel, PaginationBar, MobileCards
src/components/layout/           AppLayout, Sidebar, Topbar (breadcrumb, theme toggle, user menu, ⌘/Ctrl-K), navConfig (single source for nav+breadcrumb), CommandPalette, BackupReminder, icons
src/pages/projects/              Projects (table), ProjectDetail (full page), editPanel (slide-over), addModal (ModalShell), DocumentChecklist,
                                 ProjectContacts, ProjectTypesManager, ProjectTypeIconsEditor (exports IconPreview), RemarksSection, columns.jsx, filterFields.js, statusCell
src/pages/documents/             Documents (project × document-type status grid), DocBadge, filterFields.js, DocumentRulesEditor
src/pages/map/                   Map (Overview + Plan Visit tabs), mapFilterFields.jsx, pinIcons.js (pin/cluster icon factory), IconLegend
src/pages/itinerary/             CandidatePool, StopList (used by Map's Plan Visit tab)
src/pages/{dashboard,overview,budget,backup,beneficiaries,contacts,auth,about}/
                                 contacts/ContactModal (multi-beneficiary + email), ContactEditorModal (portal wrapper, loads beneficiaries);
                                 beneficiaries/BeneficiaryContacts (section inside BeneficiaryModal); about/About (public static page)
```

Things to know before editing:

- **`filterEngine.js` + `FilterChips.jsx`** power Projects, Documents and Map filters. A page supplies `fields` (`{id,label,group,type,get(row)}`); `custom` fields must supply `emptyValue/isEmpty/matches/summarize/Editor`. Same-chip values OR; different chips AND.
- **`documentStatus.js` ↔ `documentProgress.js`:** `isAccomplished()` and `isComplete()` are deliberate duplicates, comment says *keep in sync*.
- **`navConfig.jsx`** drives sidebar, breadcrumb and CommandPalette "Go to" list; add pages there.
- **`Select.jsx`** wrapper exists so dropdowns theme correctly in dark mode; use it (pass your `inputClass`). `SearchableSelect` for long lists.
- **Map icons:** icons are stored as SVG text and drawn as **CSS masks** filled with the pin color, so only the SHAPE matters (single-shape silhouettes, no background `<rect>`). `sanitizeSvg` strips scripts/foreignObject/event handlers/external hrefs, requires a viewBox (or numeric width+height), max ~60 KB (also enforced by DB CHECK `project_types_icon_svg_size`).
- Several files share names across folders (`columns.jsx`, `filterBar.jsx`, `filterFields.js`); check the import path.

## 4. Database (current schema, `cest-mis-schema.sql` is current)

**Enums** (all hand-mirrored as string arrays in the frontend, see §9):
`app_role(admin|editor|viewer)` · `beneficiary_category(LGU|Academe|SDO|NGO|Cooperative|Others|BLGU)` · `document_applies_to(Both|In-house|Fund Transfer)` · `document_phase(Pre-Implementation|Semi-Annual|Annual|Transfer)` · `operational_status(Operational|Non-operational|For Repair & Maintenance)` · `overall_status(For Deployment|For Implementation|For Monitoring|For Transfer|Transfer Ongoing|Fully Transferred|For Pull Out|Done)` · `project_category(In-house|Fund Transfer)` · `project_scope(Provincial|Regional)` · `remark_level(provincial|regional)`.

**Tables** (int PKs named `id` unless noted):

| Table | Key columns / relations / notes |
|---|---|
| `beneficiaries` | name, category (enum, NOT NULL), district, municipality, barangay, **latitude/longitude numeric(9,6) — now LEGACY: no current UI reads or writes them (pins moved to projects)**, updated_at (trigger) |
| `beneficiary_contacts` | name, role, contact_number, messenger_link, **email varchar(255)**; updated_at nullable. No beneficiary column — membership lives in `contact_beneficiaries`. A contact may have zero beneficiaries (orphan) |
| `contact_beneficiaries` | contact_id → beneficiary_contacts **CASCADE**; beneficiary_id → beneficiaries **CASCADE**; **UNIQUE(contact_id, beneficiary_id)**; identity id (used by backup/restore); index on beneficiary_id. Role is per contact, not per link |
| `project_types` | name UNIQUE; **icon_svg text (nullable, CHECK ≤ 60000 chars)** |
| `project_instances` | year smallint, project_type_id → project_types, **beneficiary_id → beneficiaries (NO ACTION)**, title, project_category (nullable), **project_scope NOT NULL default Provincial**, overall_status NOT NULL default 'For Deployment', operational_status, amount numeric(12,2), property_number, date_deployed, entry_point (**free text, no lookup table**), intervention, demographic ints (members_male/female, senior_citizen, pwds, fourps, ips), interventions_count, people_trained, impact_notes, gdrive_folder_link, **latitude/longitude numeric(9,6) = the map pin**, updated_at (trigger) |
| `document_types` | name, phase (nullable), applies_to (default Both), is_required (default true), is_default; **UNIQUE(name, phase)** |
| `documents` | project_id → project_instances **CASCADE**; document_type_id → document_types (nullable); custom_label; **CHECK (type OR label)**; expected_date, submitted, submitted_date, notes, has_hard_copy, hard_copy_claimable, gdrive_link, is_not_applicable; updated_at (trigger). **No UNIQUE(project_id, document_type_id)** |
| `project_contacts` | project_id → project_instances CASCADE; contact_id → beneficiary_contacts CASCADE; UNIQUE(project_id, contact_id) |
| `remarks` | project_id CASCADE; level; content; added_by (legacy free text); **created_by uuid DEFAULT auth.uid()** → auth.users (SET NULL; deliberately *not* → profiles, so no PostgREST embed) |
| `itineraries` | name, visit_date, notes (notes unused by UI), created_at |
| `itinerary_stops` | itinerary_id CASCADE; **project_id → project_instances CASCADE (NULLABLE in DB)**; beneficiary_id → beneficiaries CASCADE (NOT NULL, kept in sync from the project); stop_order; **UNIQUE(itinerary_id, project_id)** (no longer unique on beneficiary); notes unused |
| `annual_budgets` | year smallint **UNIQUE**, allocated_amount ≥ 0, notes; identity `id` (used by backup/restore) |
| `profiles` | id → auth.users CASCADE; full_name; role default `viewer` |
| `backup_status` | single row (`id = 1` CHECK): last_backup_at/by, last_restore_at/by |

**Functions:** `is_admin()`, `can_edit()` (admin or editor), `is_member()` (has a profiles row) — all `SECURITY DEFINER STABLE`. `set_updated_at()` trigger fn on beneficiaries, beneficiary_contacts, project_instances, documents, annual_budgets. `backup_export()` / `backup_restore(payload, apply, overwrite)` — admin-only, SECURITY DEFINER; both cover `contact_beneficiaries`; `backup_restore` rebuilds links from `beneficiary_contacts.beneficiary_id` for pre-migration-02 backups. `save_contact(p_id, p_name, p_role, p_contact_number, p_messenger_link, p_beneficiary_ids int[], p_email)` — SECURITY **INVOKER**, atomic contact + links save, returns the contact id. **`reassign_project_beneficiary(p_project_id, p_beneficiary_id, p_unlink_contacts)`** — SECURITY **INVOKER**, atomic: updates `project_instances.beneficiary_id`, re-points that project's `itinerary_stops.beneficiary_id`, and (optionally) deletes that project's `project_contacts` links whose contact doesn't belong to the new beneficiary (links only; contacts kept). `handle_new_user()` exists but **its trigger on `auth.users` is NOT in the dump** (lives in `migrations/01_profiles.sql`, not supplied).

**Migrations** (names from code comments/handoff; folder not supplied): `01_profiles.sql` (profiles + signup trigger), `02_contact_beneficiaries.sql`, `03_project_type_icons.sql`, `04_…` (`reassign_project_beneficiary`), `05_contact_email.sql`. The migration that added `project_instances.latitude/longitude` and `itinerary_stops.project_id` is `UNKNOWN` (number/name not referenced in supplied code).

**RLS model (all tables RLS-enabled):**

| Capability | Who |
|---|---|
| SELECT everything | any `is_member()` (any signed-in user with a profile; `profiles` readable by all authenticated; `backup_status` admin only) |
| INSERT/UPDATE: beneficiaries, contacts (+ insert on contact_beneficiaries), project_instances (insert+update), documents, itineraries, stops, project_contacts, remarks (insert only, `created_by = auth.uid()`), project_types (insert) | `can_edit()` |
| DELETE: beneficiary_contacts, contact_beneficiaries, itineraries, itinerary_stops, project_contacts | `can_edit()` |
| DELETE: beneficiaries, project_instances, documents, project_types, document_types, annual_budgets | **admin only** |
| INSERT/UPDATE: annual_budgets, document_types; UPDATE project_types (rename **and icon**) | admin only |
| DELETE remarks | admin, or editor deleting **own** remark within **15 min** |
| remarks UPDATE; profiles write; backup_status write | no policy (remarks append-only; profiles managed in Supabase dashboard; backup via DEFINER functions) |

Storage buckets: none (Google Drive links stored as text URLs; SVG icons stored as text in `project_types.icon_svg`).

## 5. Application ↔ Database Relationships

```
Dashboard        → useAllDocuments, useProjects, useBeneficiaries, useAllRemarks, useBudgets
Overview         → useProjects + useAllDocuments (cards with per-phase progress) → navigates to /projects/:id
Projects         → useProjects → project_instances; FilterChips(PROJECT_FILTER_FIELDS); AddModal(useFormData, ModalShell, SearchableSelect); EditPanel
                   AddModal: "Add Project" or "Add & open full page →" (navigates to /projects/:id); inline "+ Add new beneficiary / project type / entry point"
ProjectDetail    → useProjects(+reassignBeneficiary), useBeneficiaries(updateBeneficiary), useFormData, DocumentChecklist(useDocuments),
                   ProjectContacts(useProjectContacts + useBeneficiaryContacts), RemarksSection(useRemarks), ProjectTypesManager (admin)
                   • "Save Beneficiary Info" updates the SHARED beneficiaries row → affects every project of that beneficiary
                   • "Wrong beneficiary? Change it for this project only" → reassign_project_beneficiary RPC (disabled while form is dirty)
EditPanel        → same project form + DocumentChecklist + ProjectContacts (NO remarks, NO beneficiary editing/reassign, plain project-type dropdown)
                   used by Projects.jsx and Documents.jsx
Documents        → useProjects + useAllDocuments + useDocumentTypes; grid = projects × document types of active phase
Beneficiaries    → useBeneficiaries (select * + project_instances(count)); delete blocked in UI if count > 0; BeneficiaryModal (edit) embeds BeneficiaryContacts
Contacts         → useContacts (embeds contact_beneficiaries → beneficiaries), useFormData for beneficiary list; ContactModal (multi-beneficiary chips, email)
Map (Overview)   → useMapSites (useProjects + useAllDocuments → sites); useProjectTypeIcons → pinIcons.js; pins written to project_instances.latitude/longitude
Map (Plan Visit) → useItineraries (itineraries, itinerary_stops by project_id); CandidatePool/StopList; geo.js; OFFICE_LOCATION
Budget           → useProjects + useBudgets; lib/budget.js; imports parseAmount from pages/projects/columns
Backup           → supabase.rpc('backup_export' | 'backup_restore'), backup_status; BackupReminder (admin banner, >7 days stale)
CommandPalette   → mounts useProjects/useBeneficiaries/useContacts on open (fresh fetch each open)
Project types    → ProjectTypesManager (admin modal on ProjectDetail): rename/delete (useProjectTypes) + icon upload (useProjectTypeIcons → sanitizeSvg)
```

Cross-module dependencies to respect:
- Adding a field to `project_instances` touches: `columns.jsx`, `filterFields.js`, `addModal.jsx`, `editPanel.jsx`, **`ProjectDetail.jsx`** (form logic duplicated between the last two), maybe `CommandPalette` haystack.
- `useAllDocuments` embed selects specific `project_instances`/`beneficiaries` columns; Dashboard, Documents filters, Map (`useMapSites`) rely on them (`d.project_instances.id`). Changing the select can silently break those pages.
- **A map "site" = a project.** `site.id` is the PROJECT id; `site.projects` always has exactly one project (kept array-shaped so `mapFilterFields.jsx` and `pinIcons.typeIdsFor` work unchanged). Itinerary `stopIds` are project ids.
- Contacts are written ONLY through `useContactMutations.saveContact` (RPC) so contact + links stay atomic. Anything reading `contact.beneficiaries` must treat it as an **array**.
- `ProjectContacts` picks from `useBeneficiaryContacts(project.beneficiary_id)`; "+ New contact" there creates the contact (pre-linked to that beneficiary) then attaches it via `project_contacts`. `ProjectDetail` mounts it with `key={project.beneficiary_id}` so a reassign remounts/refetches it.

## 6. Business Logic (preserve)

- **Document status rank** (`documentStatus.js`): N/A < none < claimable < soft (gdrive_link) < hard < submitted. A missing doc row is treated as N/A.
- **"Complete"** (`documentProgress.js` & `isAccomplished`): `gdrive_link || has_hard_copy || hard_copy_claimable || submitted`. N/A docs are excluded from numerator and denominator. Progress is per phase in order `Pre-Implementation → Semi-Annual → Annual → Transfer`.
- **Overdue** = has `expected_date` < today, not N/A, not accomplished. **Upcoming** = within 14 days, not overdue, not accomplished.
- **`DOC_CONDITIONS`** (missing soft/hard, not submitted, submitted, overdue, upcoming, N/A) are independent of the rank; "missing soft" means exactly "no gdrive_link". Used by the Documents "Document status" chip and the Map "Document compliance" chip.
- **Checklist generation** (`useDocuments.generateDocuments`): from `document_types` where `phase IS NOT NULL` and `applies_to IN ('Both', project_category)`; **add-only, never deletes**; skips types already present (client-side check). Optional types (`is_required=false`) are created with `is_not_applicable = true`. Needs `project_category` set first. Changing category warns, then only *adds* docs; user must mark obsolete ones N/A manually.
- **Budget** (`lib/budget.js`, shared by Budget page + Dashboard card): project counts toward the year in its `year` field; **only `project_scope = 'Provincial'`** counts; Regional shown but ignored; all statuses count; null amount adds 0 and is flagged. Over-budget when used > allocated; bar color: >100% red, ≥80% amber.
- **Remarks:** append-only, level `provincial|regional`; author = `profiles.full_name` via `created_by`, fallback `added_by`; delete window 15 min (**constant duplicated in `RemarksSection.jsx` and the RLS policy**).
- **Beneficiary deletion:** admin only; blocked in UI while any project references it (FK is NO ACTION); otherwise cascades to contact–beneficiary links and itinerary stops (contacts kept, may become orphans).
- **Contacts:** many-to-many with beneficiaries; ≥1 beneficiary required when saving in the UI; email validated client-side (simple regex); deleting a contact removes it everywhere (links + project_contacts cascade); "Unlink" removes one link only. A project keeps a contact even if later unlinked from the project's beneficiary (no auto-cleanup) — except during **reassign**, where the checkbox (default on) removes project links to contacts not in the new beneficiary.
- **A project's beneficiary CAN be changed** (this project only) via `reassign_project_beneficiary`; the page refetches `useProjects` (resets the form), so the UI blocks the action while there are unsaved edits. The project's pin stays (pins are on the project).
- **Amount input** goes through `parseAmount()` (strips ₱ , spaces; null on invalid).
- **Map:** pins are **per project**. Overview filters **dim** non-matching pins (small gray dots, outside the cluster group); the "Needs pinning" queue *does* hide non-matches. Matching pins are clustered only when practically overlapping (`CLUSTER_RADIUS_PX = 25`); same-spot pins spiderfy. Color-by category (beneficiary category) or status (the project's `overall_status`; gray = none; `STATUS_COLOR_MIXED` is kept but unused). Pin = white pill with colored border showing up to 3 project-type glyphs (+N); types without an uploaded icon render a colored dot. Pin place/reposition/remove is optimistic via `useMapSites` overrides.
- **Itinerary geometry:** haversine straight-line km; drive time = km ÷ 30 km/h ("approx" only); auto-order = greedy nearest neighbor from `OFFICE_LOCATION` (intentionally not TSP). Candidate pool shows only pinned projects, sorted by distance from last stop. One itinerary = one day. Stops are saved as `{ project_id, beneficiary_id }`.
- **Backup/restore:** JSON of all tables (+profiles in export only). Restore is **additive** (insert missing by id; optional overwrite of differing rows), preview first, atomic, never deletes, resets sequences, nulls dangling `remarks.created_by`, defaults missing `project_scope`. Accounts/roles are never restored. Pre-migration-02 backups restore with contact links rebuilt from each contact's old `beneficiary_id`.

## 7. Current Features

| Feature | Status | Notes |
|---|---|---|
| Auth, roles, 12h session limit | COMPLETE | client-side limit only |
| Projects table (filter chips, sort, resize, column toggle, CSV, mobile cards) | COMPLETE | |
| Add Project modal (ModalShell; inline new beneficiary/type/entry point; "Add & open full page") | COMPLETE | |
| Project detail page (edit, beneficiary edit, **change beneficiary**, unsaved-changes guard) | COMPLETE | |
| Project edit slide-over | COMPLETE | overlaps with detail page (§8) |
| Document checklist per project | COMPLETE | no UI for custom docs / `submitted_date` |
| Documents grid (phase tabs, status dots, rule-based filters, CSV) | COMPLETE | |
| Overview (project cards w/ phase progress) | COMPLETE | |
| Dashboard (KPIs, overdue/upcoming, activity, compliance, charts, budget) | COMPLETE | mismatches in §9 |
| Beneficiaries / Contacts CRUD + CSV | COMPLETE | |
| Contacts ↔ beneficiaries many-to-many + **email** + tel:/mailto: links | COMPLETE | |
| Project types: inline "+ Add new", admin manager (rename/delete) **with SVG icon upload** | COMPLETE | `editPanel.jsx` still has plain dropdown, no manager |
| **Map overview (per-project pins, project-type icons, dim filters, color-by, place/reposition/remove)** | COMPLETE | custom icons shipped; admin-facing hint if `icon_svg` migration missing |
| Plan Visit (itineraries) | COMPLETE | list-based; no route drawn on map |
| Budget (yearly ceiling, over-budget alert) | COMPLETE | admin edits |
| Backup & restore + reminder | COMPLETE | |
| Global search (Ctrl/Cmd+K) | COMPLETE | |
| Dark mode | COMPLETE | via variable remap |
| Public About page (`/about`) | COMPLETE | static content (DOST CEST 2.0 vision, goals, modes, SDGs) |
| Editing demographics (`members_*`, `pwds`, `fourps`, `ips`, `senior_citizen`) | PARTIAL | shown as columns/filters, **no form edits them** |
| Managing `document_types` in UI | PLANNED/UNKNOWN | no admin UI; RLS admin-only → done in Supabase |

## 8. Important Design Decisions

- **Additive over destructive** (checklist sync, restore). Don't add auto-deletes.
- **Hooks own fetching; pages stay thin; pure logic in `lib/`**.
- **Extract to `common/` only when a second real consumer exists** (author convention: `ResizableTh`, `useColumnSizing`, `ModalShell` after AddModal+ContactModal). Also: "don't touch working things without discussing"; "verify before assuming."
- **Dark mode by CSS-variable remap**; don't add `dark:` classes or hard-coded surface colors. Saturated 400–600 fills intentionally unmapped.
- **Map + Itinerary merged into `/map`** (tabs); `/itinerary` redirect keeps old links.
- **Pins live on projects**, because one beneficiary's projects aren't necessarily at the same place (reversal of the earlier "coordinates on beneficiaries" decision; `beneficiaries.latitude/longitude` columns remain but are unused).
- **Icons are masks, not images**, so they take the pin's color-by color; icons are stored as sanitized SVG text in the DB (fetched via a separate hook to keep project rows light).
- **ProjectDetail vs EditPanel coexist:** panel = quick edit from tables (incl. Documents page); detail = full page (adds beneficiary editing/reassign, remarks, project-type manager, dirty-guard). Overview intentionally goes to the full page.
- **Optimistic updates only** for document edits, pin placement, remark delete, project-contact removal; everything else refetches.
- **Refetch must not blank the page:** `ProjectDetail` only shows the loading screen on first load.
- **Remarks are history:** corrections are new remarks, not edits.
- **Hand-synced enums** instead of fetching them (see risks).
- **Long pick lists use `SearchableSelect`** (portal-rendered); short enum lists use the native `Select` wrapper.
- **Multi-row writes go through a Postgres RPC** (`save_contact`, `reassign_project_beneficiary`, backup fns); `saveStops` is still the non-atomic exception. RPCs are SECURITY INVOKER so RLS applies.
- **Modals:** `ModalShell` doesn't close on backdrop click (protects half-filled forms). `BeneficiaryModal` and `ProjectTypesManager` still use their own hand-rolled shell.

## 9. Known Issues / Risks

**Mismatches found (code vs code/DB) — all still present in the supplied code:**

```
CODE EXPECTS: BeneficiaryModal handles readOnly (Beneficiaries.jsx passes readOnly={!canEdit})
ACTUAL: BeneficiaryModal's signature has no readOnly → viewers see an editable form; Save returns the hook's "no permission" error
STATUS: MISMATCH (ContactModal does implement readOnly)

CODE EXPECTS: Dashboard RecentActivity shows author via remark.added_by
ACTUAL: new remarks never set added_by (author is created_by → profiles); useAllRemarks doesn't resolve names → shows "Unknown"
STATUS: MISMATCH (RemarksSection/useRemarks resolve correctly)

CODE: Dashboard "Total deployed" + "Budget rollup" sum ALL projects' amount
RULE (budget.js): only Provincial counts toward budget
STATUS: INCONSISTENT by design or oversight — OPEN, ask user

CODE: Dashboard LEVEL_COLORS includes pcest/rcest
DB: remark_level only provincial|regional
STATUS: stale legacy entries

CODE: Dashboard QuickActions say "Opens Projects, then + Add Project"
ACTUAL: still just links (no ?add=1 deep link); viewers also see them
STATUS: known/deferred
```

**Risks:**

1. **1000-row truncation (partly fixed):** `useAllDocuments` pages in 1000-row ranges. `useProjects`, `useBeneficiaries`, `useContacts`, `useFormData`, `useProjectTypeIcons` fetch full tables unpaged; revisit if any table nears 1000 rows (projects is the first likely).
2. **Open signups?** `handle_new_user` makes every new auth user a `viewer` with full read access. Whether public sign-up is disabled in Supabase is `UNKNOWN` — verify. (`/about` is intentionally public but static.)
3. **Session limit is client-side only** (documented in code).
4. **`useItineraries.saveStops` is non-atomic** (delete then insert); failure between leaves an empty itinerary.
5. **Legacy itinerary stops:** `itinerary_stops.project_id` is nullable. Stops from before the project-pin change may have `project_id = NULL`; `Map.loadItinerary` silently drops them (`filter(pid => pid != null)`) and the next save deletes them. Check existing data.
6. **Duplicate documents possible:** no unique `(project_id, document_type_id)`; guard is client-side only.
7. **Hidden documents:** `documents` with `phase IS NULL` or only `custom_label` are never rendered or counted; no UI creates custom docs.
8. **`documents.submitted_date` never set** by UI, yet `DocBadge` tooltip reads it.
9. **Enum duplication:** status/category/scope/beneficiary-category lists are hard-coded in `columns.jsx`, `statusCell`, `mapFilterFields`, `Map.jsx` (colors), `Dashboard.jsx`, `Documents.jsx`, `addModal`, `BeneficiaryModal`, `ProjectDetail`, `documents/columns.jsx`. A DB enum change requires editing all.
10. **Form duplication:** `editPanel.jsx` and `ProjectDetail.jsx` repeat payload-building; keep in sync. `editPanel` lacks reassign, project-type manager, remarks.
11. **No client permission check** in `useDocuments.updateDocument`, `useRemarks`, `useProjectContacts` (RLS rejects; UI may show buttons to viewers). `useMapSites.setLocation` does check, but Map popup "Reposition / Remove pin" and "Place pin" buttons are shown to everyone.
12. **Dead/legacy files (INFERENCE, not imported by routed code in the supplied set):** `components/Navbar.jsx` (imports `react-router-dom`), `pages/map/filterBar.jsx`, `lib/beneficiaryFilters.js` (both safe to delete per a comment in `mapFilterFields.jsx`), `pages/projects/filterBar.jsx`, `pages/documents/filterBar.jsx`, `pages/documents/columns.jsx`, `pages/projects/paginationBar.jsx` + `visibilityPanel.jsx` (lowercase duplicates of `common/`), `lib/localAuthor.js`, `pages/itinerary/Itinerary.jsx` (not supplied). Also stray assets: `src/assets/vite.svg` (huge traced SVG, ~MBs of path data), `react.svg`, `DOST_seal.svg:Zone.Identifier` (Windows download metadata, delete). `useMergedBeneficiaries.js` / `useBeneficiaryLocations.js` were not supplied and are no longer used by `Map.jsx` (replaced by `useMapSites`) — probably deletable, confirm in repo.
13. **Schema dump gaps:** `auth.users` signup trigger and all seed data absent; `document_types` contents `UNKNOWN`. The dump now includes `\restrict`/`\unrestrict` lines (newer pg_dump) — strip them if the file is replayed with an older `psql`.
14. **Perf:** `CommandPalette` refetches three full tables on every open; Map/Dashboard load all documents; `useProjectTypeIcons` ships up to 60 KB SVG per type.
15. **Orphan contacts:** deleting a beneficiary leaves its exclusive contacts with zero beneficiaries; they still list on /contacts and need a beneficiary to be re-saved.
16. **Stale project contacts:** unlinking a contact from a beneficiary doesn't remove it from that beneficiary's projects (reassign is the only auto-cleanup, opt-in).
17. **Rename staleness:** renaming a project type in the manager refreshes the dropdown (and icons on next map load) but not the project header/table until reload.
18. **Legacy-backup restore preview** undercounts contact links when contacts/beneficiaries don't exist yet (apply is correct). Untested against a real old backup. Backups predating project pins restore with null project coordinates.
19. **`package.json` lacks a direct `react-router` dependency** while most files import from `'react-router'` (only `Navbar.jsx` uses `react-router-dom`, which is listed). Works because `react-router-dom` v7 depends on `react-router`; if `Navbar.jsx` is deleted, also swap/keep the dependency deliberately.
20. **Unused columns:** `beneficiaries.latitude/longitude`, `itineraries.notes`, `itinerary_stops.notes`, demographic columns (no edit UI). Leave unless the user asks.
21. No tests found (`UNKNOWN` whether any exist).

## 10. Pending Work

No explicit in-progress task is recorded in the supplied files — **OPEN: ask the user what's next.** Candidates grounded in code/comments:

### Immediate / High Priority (defects found, not user-confirmed priorities)
| Item | Files | Notes |
|---|---|---|
| Make `BeneficiaryModal` honor `readOnly` | `BeneficiaryModal.jsx` (copy `ContactModal` pattern, e.g. `<fieldset disabled>` + hide Save) | Beneficiaries.jsx already passes it |
| Fix Dashboard remark author | `useAllRemarks.js`, `Dashboard.jsx RemarkRow` | Reuse name resolution from `useRemarks` |
| Check legacy itinerary stops with NULL `project_id` | DB data, `Map.jsx loadItinerary` | Risk 5 |
| Hide pin-edit buttons from viewers | `Map.jsx` (`SiteMarker`, `SiteQueueItem`) | gate on `canEdit` |
| Finish 1000-row handling | `useProjects`, `useBeneficiaries`, `useContacts` | Check Supabase max-rows |
| Confirm public sign-up is off | Supabase dashboard | Not code |

### Later / Optional
- Delete dead files in §9 item 12 after user confirmation (and the stray `.svg:Zone.Identifier`).
- Atomic `saveStops` via RPC (`useItineraries.js`, comment already describes the fix).
- UI to edit demographic columns; UI for `submitted_date`.
- Dashboard "Add …" shortcuts deep-linking into add modals (`?add=1` support in `Projects.jsx`/`Beneficiaries.jsx`; deferred in code).
- Server-side session enforcement (needs paid Supabase plan per `AuthContext` comment).
- Pick contacts at project creation; per-link contact roles; add-new/manage project types and beneficiary reassign in `editPanel.jsx`; auto-clean `project_contacts` on unlink.
- Move `BeneficiaryModal`/`ProjectTypesManager` onto `ModalShell`.
- Add a Dashboard KPI/budget filter for Provincial-only if the user confirms that's intended.

## 11. New AI Quick Start

**Before modifying this project, know:**

1. **Architecture:** Vite React SPA → hooks → Supabase (Postgres + RLS + RPCs + Auth). No custom backend. No shared cache; each hook has its own state. Mutations return `{ error }`, never throw.
2. **Critical files:** `App.jsx`, `lib/AuthContext.jsx`, `hooks/useProjects|useDocuments|useAllDocuments|useMapSites`, `lib/filterEngine.js` + `FilterChips.jsx`, `lib/documentStatus.js` + `documentProgress.js`, `lib/budget.js`, `pages/projects/ProjectDetail.jsx` + `editPanel.jsx`, `pages/map/Map.jsx` + `pinIcons.js`, `theme.css`, `components/layout/navConfig.jsx`, `cest-mis-schema.sql` (now current).
3. **Critical DB relationships:** `project_instances → beneficiaries` (NO ACTION; shared row; the project itself holds the map coords) · `documents → project_instances` (CASCADE) `→ document_types` · `contact_beneficiaries` (contact ↔ beneficiary, many-to-many) · `project_contacts` links a project to a contact picked from its beneficiary's contacts · `itinerary_stops` are project-based (`project_id`, CASCADE) with `beneficiary_id` kept in sync · `remarks.created_by → auth.users` (not profiles) · `project_types.icon_svg` feeds map pins.
4. **Business rules not to break:** document "complete" definition (two synced copies), overdue/upcoming, add-only checklist generation (optional types start N/A), Provincial-only budget, append-only remarks (15-min delete), beneficiary delete guard, additive restore, one-pin-per-project map model.
5. **Roles:** viewer = read; editor = create/edit + delete contacts/itineraries/links; admin = deletes of projects/beneficiaries/documents, budgets, document_types, project-type rename/delete/icon, backups. **RLS is authoritative**, UI checks are cosmetic.
6. **Unfinished/uncertain:** no recorded in-progress task (ask the user); demographic fields not editable; known mismatches in §9; migration list for pins/stops is `UNKNOWN`.
7. **Hazards:** possible 1000-row truncation; enum lists duplicated across ~10 files; `editPanel` ↔ `ProjectDetail` duplicated logic; `ProjectDetail` beneficiary save affects all that beneficiary's projects (vs. reassign = this project only); `AuthProvider` must stay inside `ToastProvider`; legacy NULL `project_id` itinerary stops; many dead/legacy files that look live (§9.12).
8. **Don't change casually:** dark-mode variable-remap approach (no `dark:` variants), table+card dual rendering, `useAllDocuments` embed shape, `DOC_CONDITIONS` semantics, site-as-project shape from `useMapSites` (`site.projects` is a 1-element array on purpose), `saveStops`/restore atomicity assumptions, the `created_by`/`added_by` remark attribution scheme, SVG-as-CSS-mask icons.
9. **Conventions:** extract shared components only on second consumer; ask before touching working code; keep `NO_EDIT`/`NO_ADMIN` client guards consistent with RLS; use `Select` wrapper and `parseAmount`; mobile inputs `text-base sm:text-sm`; `SearchableSelect` for long lists; `ModalShell` for new centered modals; write contacts only via `useContactMutations.saveContact`; re-dump `cest-mis-schema.sql` after any schema/migration change (Backup page has the `pg_dump` command; never paste the connection string anywhere).
