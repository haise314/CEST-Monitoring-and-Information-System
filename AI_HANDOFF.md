# AI_HANDOFF — CEST-MIS

Current-state handoff. Basis: supplied source files + supplied `pg_dump` schema (schema-only, Postgres 17.6).
Labels: `CONFIRMED` (seen in code/SQL) · `INFERENCE` · `UNKNOWN` · `OPEN`.
**Not supplied:** `package.json`, Vite config, `main.jsx`, `index.css`, `migrations/`, `docs/*.md` (referenced in code comments), tests, seed data (`document_types`, `project_types` rows). File paths below are `INFERENCE` from import statements (uploads were flattened).
Fastest onboarding: read **§11** first.

---

## 1. Project Overview

- **What:** CEST-MIS ("Monitoring & Information"), an internal web app for a **Provincial CEST office in Zambales, PH** (`INFERENCE`: CEST = DOST's Community Empowerment thru S&T program; office coords in `officeLocation.js`, map centered on Zambales).
- **Purpose:** track CEST **projects** (equipment/interventions deployed to **beneficiaries** like LGUs, schools, co-ops), their **document compliance checklists**, contacts, yearly **budget**, and **field-visit itineraries** on a map.
- **Users:** small office staff, three roles: `admin`, `editor`, `viewer`.
- **Stack:** React (Vite, JS not TS) · react-router v7 (data router) · Tailwind v4 · TanStack Table · react-leaflet/Leaflet (OSM tiles) · Supabase (Postgres + Auth, `supabase-js`, no backend of our own). Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **State:** feature-complete internal tool in active iteration. Deployment host: `UNKNOWN`.

## 2. Architecture

```
Browser SPA (Vite/React)
  App.jsx: ThemeProvider > ToastProvider > AuthProvider > RouterProvider
     └ RequireAuth > AppLayout (Sidebar + Topbar + BackupReminder + <Outlet/>)
          pages/*  ──►  hooks/*  ──►  supabase-js  ──►  Supabase Postgres (RLS) + Auth
                    └─► lib/* (pure logic: filterEngine, documentStatus, documentProgress, budget, geo)
```

- **Routes** (`App.jsx`): `/login`; under auth: `/` Dashboard, `/overview`, `/projects`, `/projects/:id`, `/documents`, `/beneficiaries`, `/contacts`, `/map`, `/budget`, `/backup`. `/itinerary` → redirect `/map?mode=plan`.
- **Provider order matters:** `AuthProvider` calls `useToast()`, so `ToastProvider` must wrap it.
- **Data access:** every hook calls Supabase directly. **No shared cache / no react-query.** Each hook instance owns its own state; two hooks on the same table = two independent copies (hence the `onDocumentsChanged` callback between `DocumentChecklist` and `Documents.jsx`).
- **Hook contract:** `{ data, loading, error, refetch, ...mutations }`. Mutations **never throw**; they return `{ error }` (string|null). Callers show errors inline; toasts only confirm success.
- **Auth:** Supabase email+password. `AuthContext` exposes `session, user, profile, role, isAdmin, canEdit, signIn, signOut`. Role comes from `profiles.role`; profile re-read on window focus (role changes made in Supabase dashboard apply without re-login). App holds on loading until profile is read.
- **Session policy:** hard 12 h limit, **client-side only** (`localStorage.cest_signed_in_at`, checked on load/focus/1-min interval, warning toast 10 min before). Protects unattended PCs, not an attacker.
- **Permissions are enforced twice:** hooks/UI check `canEdit`/`isAdmin` for UX; **RLS is the real enforcement**.
- **Theming:** `theme.css` implements dark mode by **remapping Tailwind color CSS variables** under `.dark` (no `dark:` variants anywhere). `bg-white` is overridden to `--surface`. Toggle in `ThemeContext` (`localStorage.cest_theme`, defaults to OS).
- **Responsive:** list pages render both a table (`hidden md:block`) and `MobileCardList` (`md:hidden`); modals become bottom sheets on phones; inputs use `text-base sm:text-sm` (iOS zoom).
- **Persistence keys:** `sessionStorage`: `projectsFilters`, `documentsFilters`, `mapOverviewFilters`, `mapPlanFilters`, backup-reminder dismiss. `localStorage`: `projectsColumnSizing`, `beneficiariesColumnSizing`, `contactsColumnSizing`, `editPanelWidth`, `cest_sidebar_collapsed`, `cest_theme`, `cest_signed_in_at`.
- **External services:** Supabase; OpenStreetMap tile servers.

## 3. Important Files / Modules

```
src/App.jsx                      routes, providers, RequireAuth
src/lib/
  AuthContext.jsx                session, profile/role, 12h limit
  supabase.js                    client
  filterEngine.js                pure filter logic (types: select|text|number|date|link|custom)
  documentStatus.js              status rank, overdue/upcoming, DOC_CONDITIONS
  documentProgress.js            phase order, completion %, bar colors
  budget.js                      budget rules (see §6)
  geo.js / officeLocation.js     haversine, nearest-neighbor order, office start point
  exportCsv.js                   CSV export for any TanStack table
src/hooks/
  useProjects                    project_instances CRUD (+project_types, beneficiaries embed)
  useBeneficiaries               beneficiaries CRUD (+ linked project count)
  useContacts                    beneficiary_contacts CRUD (all)
  useBeneficiaryContacts         read contacts of one beneficiary (picker)
  useProjectContacts             project_contacts link table for one project
  useDocuments(projectId)        checklist per project + generateDocuments + updateDocument (optimistic)
  useAllDocuments                every document + project/beneficiary embed (Dashboard, Documents, Map)
  useDocumentTypes               document_types read
  useRemarks(projectId)          append-only remarks + author-name resolution from profiles
  useAllRemarks(limit)           read-only feed for Dashboard
  useBudgets                     annual_budgets read + upsert by year
  useBeneficiaryLocations        beneficiaries + coords + project count; setLocation (optimistic)
  useMergedBeneficiaries         locations + projects + documents merged per beneficiary (Map)
  useItineraries                 itineraries + stops; saveStops = delete-then-insert
  useFormData                    lookups for add/edit forms; inline create project_type / beneficiary
  useSessionState, useColumnSizing   storage-backed state helpers
src/components/common/           FilterChips, Select, ResizableTh, VisibilityPanel, PaginationBar, MobileCards
src/components/layout/           AppLayout, Sidebar, Topbar, navConfig (single source for nav+breadcrumb), CommandPalette, BackupReminder, icons
src/pages/projects/              Projects (table), ProjectDetail (full page), editPanel (slide-over), addModal,
                                 DocumentChecklist, ProjectContacts, RemarksSection, columns.jsx, filterFields.js, statusCell
src/pages/documents/             Documents (project × document-type status grid), DocBadge, filterFields.js, DocumentRulesEditor
src/pages/map/                   Map (Overview + Plan Visit tabs), mapFilterFields.jsx
src/pages/itinerary/             CandidatePool, StopList (used by Map's Plan Visit tab)
src/pages/{dashboard,overview,budget,backup,beneficiaries,contacts,auth}/
```

Things to know before editing:

- **`filterEngine.js` + `FilterChips.jsx`** power Projects, Documents and Map filters. A page supplies `fields` (`{id,label,group,type,get(row)}`); `custom` fields must supply `emptyValue/isEmpty/matches/summarize/Editor`. Same-chip values OR; different chips AND.
- **`documentStatus.js` ↔ `documentProgress.js`:** `isAccomplished()` and `isComplete()` are deliberate duplicates, comment says *keep in sync*.
- **`navConfig.jsx`** drives sidebar, breadcrumb and CommandPalette "Go to" list; add pages there.
- **`Select.jsx`** wrapper exists so dropdowns theme correctly in dark mode; use it (pass your `inputClass`) for new selects.
- Several files share names across folders (`columns.jsx`, `filterBar.jsx`, `filterFields.js`); check the import path.

## 4. Database (current schema)

**Enums** (all hand-mirrored as string arrays in the frontend, see §9):
`app_role(admin|editor|viewer)` · `beneficiary_category(LGU|Academe|SDO|NGO|Cooperative|Others|BLGU)` · `document_applies_to(Both|In-house|Fund Transfer)` · `document_phase(Pre-Implementation|Semi-Annual|Annual|Transfer)` · `operational_status(Operational|Non-operational|For Repair & Maintenance)` · `overall_status(For Deployment|For Implementation|For Monitoring|For Transfer|Transfer Ongoing|Fully Transferred|For Pull Out|Done)` · `project_category(In-house|Fund Transfer)` · `project_scope(Provincial|Regional)` · `remark_level(provincial|regional)`.

**Tables** (int identity PKs named `id` unless noted):

| Table | Key columns / relations / notes |
|---|---|
| `beneficiaries` | name, category (enum, NOT NULL), district, municipality, barangay, **latitude/longitude numeric(9,6)** (map pins live here, not on projects), updated_at (trigger) |
| `beneficiary_contacts` | beneficiary_id → beneficiaries **CASCADE**; name, role, contact_number, messenger_link; updated_at nullable |
| `project_types` | name UNIQUE |
| `project_instances` | year smallint, project_type_id → project_types, **beneficiary_id → beneficiaries (NO ACTION)**, title, project_category (nullable), **project_scope NOT NULL default Provincial**, overall_status NOT NULL default 'For Deployment', operational_status, amount numeric(12,2), property_number, date_deployed, entry_point (**free text, no lookup table**), intervention, demographic ints (members_male/female, senior_citizen, pwds, fourps, ips), interventions_count, people_trained, impact_notes, gdrive_folder_link, updated_at (trigger) |
| `document_types` | name, phase (nullable), applies_to (default Both), is_required (default true), is_default; **UNIQUE(name, phase)** |
| `documents` | project_id → project_instances **CASCADE**; document_type_id → document_types (nullable); custom_label; **CHECK (type OR label)**; expected_date, submitted, submitted_date, notes, has_hard_copy, hard_copy_claimable, gdrive_link, is_not_applicable; updated_at (trigger). **No UNIQUE(project_id, document_type_id)** |
| `project_contacts` | project_id → project_instances CASCADE; contact_id → beneficiary_contacts CASCADE; UNIQUE(project_id, contact_id) |
| `remarks` | project_id CASCADE; level; content; added_by (legacy free text); **created_by uuid DEFAULT auth.uid()** → auth.users (SET NULL; deliberately *not* → profiles, so no PostgREST embed) |
| `itineraries` / `itinerary_stops` | stops: itinerary_id CASCADE, beneficiary_id CASCADE, stop_order, UNIQUE(itinerary_id, beneficiary_id). `notes` columns exist but UI doesn't use them |
| `annual_budgets` | year smallint **UNIQUE**, allocated_amount ≥ 0, notes; also has identity `id` (used by backup/restore) |
| `profiles` | id → auth.users CASCADE; full_name; role default `viewer` |
| `backup_status` | single row (`id = 1` CHECK): last_backup_at/by, last_restore_at/by |

**Functions:** `is_admin()`, `can_edit()` (admin or editor), `is_member()` (has a profiles row) — all `SECURITY DEFINER STABLE`. `set_updated_at()` trigger fn on beneficiaries, beneficiary_contacts, project_instances, documents, annual_budgets. `backup_export()` / `backup_restore(payload, apply, overwrite)` — admin-only, SECURITY DEFINER. `handle_new_user()` exists but **its trigger on `auth.users` is NOT in the dump** (lives in `migrations/01_profiles.sql`, not supplied).

**RLS model (all tables RLS-enabled):**

| Capability | Who |
|---|---|
| SELECT everything | any `is_member()` (any signed-in user with a profile; `profiles` readable by all authenticated) |
| INSERT/UPDATE: beneficiaries, contacts, project_instances (insert+update), documents, itineraries, stops, project_contacts, remarks (insert only, `created_by = auth.uid()`), project_types (insert) | `can_edit()` |
| DELETE: beneficiary_contacts, itineraries, itinerary_stops, project_contacts | `can_edit()` |
| DELETE: beneficiaries, project_instances, documents, project_types, document_types, annual_budgets | **admin only** |
| INSERT/UPDATE: annual_budgets, document_types; UPDATE project_types | admin only |
| DELETE remarks | admin, or editor deleting **own** remark within **15 min** |
| remarks UPDATE; profiles write; backup_status write | no policy (remarks append-only; profiles managed in Supabase dashboard; backup via DEFINER functions) |

Storage buckets: none (Google Drive links stored as text URLs).

## 5. Application ↔ Database Relationships

```
Dashboard        → useAllDocuments, useProjects, useBeneficiaries, useAllRemarks, useBudgets
                   → documents(+types,+project_instances+beneficiaries), project_instances, beneficiaries, remarks, annual_budgets
Overview         → useProjects + useAllDocuments (cards with per-phase progress) → navigates to /projects/:id
Projects         → useProjects → project_instances; FilterChips(PROJECT_FILTER_FIELDS); AddModal(useFormData); EditPanel
ProjectDetail    → useProjects, useBeneficiaries(updateBeneficiary), useFormData, DocumentChecklist(useDocuments),
                   ProjectContacts(useProjectContacts + useBeneficiaryContacts), RemarksSection(useRemarks)
                   ⚠ "Save Beneficiary Info" updates the shared beneficiaries row → affects every project of that beneficiary
EditPanel        → same project form + DocumentChecklist + ProjectContacts (NO remarks, NO beneficiary editing)
                   used by Projects.jsx and Documents.jsx
Documents        → useProjects + useAllDocuments + useDocumentTypes; grid = projects × document types of active phase
Beneficiaries    → useBeneficiaries (select * + project_instances(count)); delete blocked in UI if count > 0
Contacts         → useContacts (+beneficiaries embed), useFormData for the beneficiary dropdown
Map (Overview)   → useMergedBeneficiaries (useBeneficiaryLocations + useProjects + useAllDocuments); pins via setLocation
Map (Plan Visit) → useItineraries (itineraries, itinerary_stops); CandidatePool/StopList; geo.js; OFFICE_LOCATION
Budget           → useProjects + useBudgets; lib/budget.js; imports parseAmount from pages/projects/columns
Backup           → supabase.rpc('backup_export' | 'backup_restore'), backup_status; BackupReminder (admin banner, >7 days stale)
CommandPalette   → mounts useProjects/useBeneficiaries/useContacts on open (fresh fetch each open)
```

Cross-module dependencies to respect:
- Adding a field to `project_instances` touches: `columns.jsx`, `filterFields.js`, `addModal.jsx`, `editPanel.jsx`, **`ProjectDetail.jsx`** (form logic is duplicated between the last two), maybe `CommandPalette` haystack.
- `useAllDocuments` embed selects specific `project_instances`/`beneficiaries` columns; Dashboard, Documents filters, Map merge rely on them (`d.project_instances.id`). Changing the select can silently break those pages.
- `useMergedBeneficiaries` keys documents → beneficiary through `project_instances.id → beneficiary_id`.

## 6. Business Logic (preserve)

- **Document status rank** (`documentStatus.js`): N/A < none < claimable < soft (gdrive_link) < hard < submitted. A missing doc row is treated as N/A.
- **"Complete"** (`documentProgress.js` & `isAccomplished`): `gdrive_link || has_hard_copy || hard_copy_claimable || submitted`. N/A docs are excluded from numerator and denominator. Progress is per phase in order `Pre-Implementation → Semi-Annual → Annual → Transfer`.
- **Overdue** = has `expected_date` < today, not N/A, not accomplished. **Upcoming** = within 14 days, not overdue, not accomplished.
- **`DOC_CONDITIONS`** (missing soft/hard, not submitted, submitted, overdue, upcoming, N/A) are independent of the rank; "missing soft" means exactly "no gdrive_link". Used by Documents "Document status" chip and Map "Document compliance" chip.
- **Checklist generation** (`useDocuments.generateDocuments`): from `document_types` where `phase IS NOT NULL` and `applies_to IN ('Both', project_category)`; **add-only, never deletes**; skips types already present (client-side check). Optional types (`is_required=false`) are created with `is_not_applicable = true`. Needs `project_category` set first. Changing a project's category warns, then only *adds* docs; user must mark obsolete ones N/A manually.
- **Budget** (`lib/budget.js`, shared by Budget page + Dashboard card): project counts toward the year in its `year` field; **only `project_scope = 'Provincial'`** counts; Regional shown but ignored; all statuses count; null amount adds 0 and is flagged. Over-budget when used > allocated; bar color: >100% red, ≥80% amber.
- **Remarks:** append-only, level `provincial|regional`; author = `profiles.full_name` via `created_by`, fallback `added_by`; delete window 15 min (**constant duplicated in `RemarksSection.jsx` and the RLS policy**).
- **Beneficiary deletion:** admin only; blocked in UI while any project references it (FK is NO ACTION); otherwise cascades to contacts, project links, itinerary stops.
- **Project's beneficiary is fixed at creation** (no reassignment UI).
- **Amount input** goes through `parseAmount()` (strips ₱ , spaces; null on invalid).
- **Map:** pins belong to beneficiaries. Overview filters **dim** non-matching pins (not hide); the "Needs pinning" queue *does* hide non-matches. Color-by category or status (status: gray = no projects, near-black = mixed statuses).
- **Itinerary geometry:** haversine straight-line km; drive time = km ÷ 30 km/h ("approx" only); auto-order = greedy nearest neighbor from `OFFICE_LOCATION` (intentionally not TSP). Candidate pool shows only pinned beneficiaries, sorted by distance from last stop. One itinerary = one day.
- **Backup/restore:** JSON of all tables (+profiles in export only). Restore is **additive** (insert missing by id; optional overwrite of differing rows), preview first, atomic, never deletes, resets sequences, nulls dangling `remarks.created_by`, defaults missing `project_scope`. Accounts/roles are never restored.

## 7. Current Features

| Feature | Status | Notes |
|---|---|---|
| Auth, roles, 12h session limit | COMPLETE | client-side limit only |
| Projects table (filter chips, sort, resize, column toggle, CSV, mobile cards) | COMPLETE | |
| Project detail page (edit, beneficiary edit, unsaved-changes guard) | COMPLETE | |
| Project edit slide-over | COMPLETE | overlaps with detail page (§8) |
| Document checklist per project | COMPLETE | no UI for custom docs / `submitted_date` |
| Documents grid (phase tabs, status dots, rule-based filters, CSV) | COMPLETE | |
| Overview (project cards w/ phase progress) | COMPLETE | |
| Dashboard (KPIs, overdue/upcoming, activity, compliance, charts, budget) | COMPLETE | see mismatches in §9 |
| Beneficiaries / Contacts CRUD + CSV | COMPLETE | |
| Map overview (pins, dim filters, color-by, place/reposition/remove pin) | COMPLETE | |
| Plan Visit (itineraries) | COMPLETE | no map drawing of the route; list-based |
| Budget (yearly ceiling, over-budget alert) | COMPLETE | admin edits |
| Backup & restore + reminder | COMPLETE | |
| Global search (Ctrl/Cmd+K) | COMPLETE | |
| Dark mode | COMPLETE | via variable remap |
| Per-project-type custom map icons | PLANNED | noted in `Map.jsx`; plain colored dot today |
| Editing demographics (`members_*`, `pwds`, `fourps`, `ips`, `senior_citizen`) | PARTIAL | shown as columns/filters, **no form edits them** (`CONFIRMED` in forms) |
| Managing `document_types` / `project_types` in UI | PLANNED/UNKNOWN | no admin UI exists; RLS is admin-only → done in Supabase |

## 8. Important Design Decisions

- **Additive over destructive** (checklist sync, restore). Don't add auto-deletes.
- **Hooks own fetching; pages stay thin; pure logic in `lib/`** (framework-free, testable).
- **Extract to `common/` only when a second real consumer exists** (author convention, see `ResizableTh`, `useColumnSizing`). Also: "don't touch working things without discussing"; "verify before assuming."
- **Dark mode by CSS-variable remap**; don't add `dark:` classes or hard-coded colors for surfaces. Keep using `gray/blue/...` utilities and `bg-white`. Saturated 400–600 fills are intentionally unmapped.
- **Map + Itinerary merged into `/map`** (tabs); `/itinerary` redirect keeps old links.
- **ProjectDetail vs EditPanel coexist:** panel = quick edit from tables (incl. Documents page); detail = full page (adds beneficiary editing + remarks + dirty-guard). Overview intentionally goes to the full page.
- **Optimistic updates only** for document edits, pin placement, remark delete, project-contact removal; everything else refetches.
- **Refetch must not blank the page:** `ProjectDetail` only shows the loading screen on first load.
- **Remarks are history:** corrections are new remarks, not edits.
- **Coordinates on beneficiaries**, so one pin serves all of that beneficiary's projects.
- **Hand-synced enums** instead of fetching them (see risks).

## 9. Known Issues / Risks

**Mismatches found (code vs code/DB):**

```
CODE EXPECTS: BeneficiaryModal handles readOnly (Beneficiaries.jsx passes readOnly={!canEdit})
ACTUAL: BeneficiaryModal ignores the prop → viewers see an editable form; Save returns the hook's "no permission" error
STATUS: MISMATCH (ContactModal does implement readOnly)

CODE EXPECTS: Dashboard RecentActivity shows author via remark.added_by
ACTUAL: new remarks never set added_by (author is created_by → profiles); useAllRemarks doesn't resolve names → shows "Unknown"
STATUS: MISMATCH (RemarksSection/useRemarks resolve correctly)

CODE: Dashboard "Total deployed" + "Budget rollup" sum ALL projects' amount
RULE (budget.js): only Provincial counts toward budget
STATUS: INCONSISTENT by design or oversight — OPEN, ask user

CODE: Backup.jsx TABLE_LABELS omits annual_budgets
DB: backup_export/restore include annual_budgets
STATUS: preview table doesn't list it, though totals include it

CODE: Dashboard LEVEL_COLORS includes pcest/rcest
DB: remark_level only provincial|regional
STATUS: stale legacy entries
```

**Risks:**

1. **1000-row truncation (INFERENCE, high impact):** all list hooks `select()` without pagination; Supabase's default API max is 1000 rows. `documents` (≈ projects × checklist size) will hit it first and silently skew Dashboard compliance/overdue, Documents grid, Map filters. Verify the project's max-rows setting; fix with ranged/paged fetch or server-side aggregation.
2. **Open signups?** `handle_new_user` makes every new auth user a `viewer` with full read access. Whether public sign-up is disabled in Supabase is `UNKNOWN` — verify.
3. **Session limit is client-side only** (documented in code).
4. **`useItineraries.saveStops` is non-atomic** (delete then insert); failure between leaves an empty itinerary. Fix = Postgres RPC.
5. **Duplicate documents possible:** no unique `(project_id, document_type_id)`; guard is client-side only.
6. **Hidden documents:** `documents` with `phase IS NULL` or only `custom_label` are never rendered or counted (checklist and progress iterate `PHASE_ORDER`); no UI creates custom docs.
7. **`documents.submitted_date` never set** by UI (checkbox only sets `submitted`), yet `DocBadge` tooltip reads it.
8. **Enum duplication:** status/category/scope/beneficiary-category lists are hard-coded in `columns.jsx`, `statusCell`, `mapFilterFields`, `Map.jsx` (colors), `Dashboard.jsx`, `Documents.jsx`, `addModal`, `BeneficiaryModal`, `ProjectDetail`. A DB enum change requires editing all.
9. **Form duplication:** `editPanel.jsx` and `ProjectDetail.jsx` repeat payload-building; keep in sync.
10. **No client permission check** in `useDocuments.updateDocument`, `useBeneficiaryLocations.setLocation`, `useRemarks`, `useProjectContacts` (RLS rejects; UI may show buttons to viewers on the map).
11. **Dead/legacy files (INFERENCE, not imported by any routed code):** `Navbar.jsx` (imports `react-router-dom`), `pages/itinerary/Itinerary.jsx`, `pages/map/filterBar.jsx`, `lib/beneficiaryFilters.js`, `pages/projects/filterBar.jsx`, `pages/documents/filterBar.jsx`, `pages/documents/columns.jsx`, `pages/projects/paginationBar.jsx` + `visibilityPanel.jsx` (lowercase duplicates of `common/`), `lib/localAuthor.js`. Comment in `useMergedBeneficiaries.js` saying Map "has NOT" been switched is stale (Map now uses it). Confirm with repo before deleting.
12. **Schema dump gaps:** `auth.users` trigger and all seed data absent; `document_types` contents `UNKNOWN`.
13. **Perf:** `CommandPalette` refetches three full tables on every open; Map/Dashboard load all documents.
14. No tests found (`UNKNOWN` whether any exist).

## 10. Pending Work

No explicit in-progress task is recorded in the supplied files — **OPEN: ask the user what's next.** Candidates grounded in code/comments:

### Immediate / High Priority (defects found, not user-confirmed priorities)
| Item | Files | Notes |
|---|---|---|
| Verify/handle 1000-row limit | `useAllDocuments`, `useProjects`, others | Check Supabase max-rows first; paging changes hook contracts |
| Make `BeneficiaryModal` honor `readOnly` | `BeneficiaryModal.jsx` (copy `ContactModal` pattern) | Beneficiaries.jsx already passes it |
| Fix Dashboard remark author | `useAllRemarks.js`, `Dashboard.jsx RemarkRow` | Reuse name-resolution from `useRemarks` |
| Confirm public sign-up is off | Supabase dashboard | Not code |

### Later / Optional
- Per-project-type custom map icons (user-supplied SVGs) — `Map.jsx createDotIcon`; flagged in code as not started.
- Delete dead files in §9 item 11 after user confirmation.
- Atomic `saveStops` via RPC (`useItineraries.js`, comment already describes the fix).
- UI to edit demographic columns; UI for `submitted_date`.
- Dashboard "Add …" shortcuts deep-linking into add modals (needs `?add=1` support in `Projects.jsx`/`Beneficiaries.jsx`; deliberately deferred in code).
- Server-side session enforcement (needs paid Supabase plan per `AuthContext` comment).
- Add `annual_budgets` to `Backup.jsx` `TABLE_LABELS`.

## 11. New AI Quick Start

**Before modifying this project, know:**

1. **Architecture:** Vite React SPA → hooks → Supabase (Postgres + RLS + Auth). No custom backend. No shared cache; each hook has its own state. Mutations return `{ error }`, never throw.
2. **Critical files:** `App.jsx`, `lib/AuthContext.jsx`, `hooks/useProjects|useDocuments|useAllDocuments|useMergedBeneficiaries`, `lib/filterEngine.js` + `FilterChips.jsx`, `lib/documentStatus.js` + `documentProgress.js`, `lib/budget.js`, `pages/projects/ProjectDetail.jsx` + `editPanel.jsx`, `pages/map/Map.jsx`, `theme.css`, `components/layout/navConfig.jsx`, `cest-mis-schema.sql`.
3. **Critical DB relationships:** `project_instances → beneficiaries` (NO ACTION; shared row, holds map coords) · `documents → project_instances` (CASCADE) `→ document_types` · `project_contacts` links projects to a beneficiary's contacts · `remarks.created_by → auth.users` (not profiles) · `itinerary_stops` cascade from itineraries & beneficiaries.
4. **Business rules not to break:** document "complete" definition (two synced copies), overdue/upcoming, add-only checklist generation (optional types start N/A), Provincial-only budget, append-only remarks (15-min delete), beneficiary delete guard, additive restore.
5. **Roles:** viewer = read; editor = create/edit + delete contacts/itineraries/links; admin = deletes of projects/beneficiaries/documents, budgets, document_types, backups. **RLS is authoritative**, UI checks are cosmetic.
6. **Unfinished/uncertain:** no recorded in-progress task (ask the user); demographic fields not editable; custom map icons planned; see §10.
7. **Hazards:** possible 1000-row truncation; enum lists duplicated across ~9 files; `editPanel` ↔ `ProjectDetail` duplicated logic; `ProjectDetail` beneficiary save affects all that beneficiary's projects; `AuthProvider` must stay inside `ToastProvider`; many dead/legacy files that look live (§9.11).
8. **Don't change casually:** dark-mode variable-remap approach (no `dark:` variants), table+card dual rendering, `useAllDocuments` embed shape, `DOC_CONDITIONS` semantics, `saveStops`/restore atomicity assumptions, the `created_by`/`added_by` remark attribution scheme.
9. **Conventions:** extract shared components only on second consumer; ask before touching working code; keep `NO_EDIT`/`NO_ADMIN` client guards consistent with RLS; use `Select` wrapper and `parseAmount`; mobile inputs `text-base sm:text-sm`.
