# CLAUDE.md — CEST-MIS Project Memory

This is the entry point for any Claude session working on this codebase. It was
built from a full upload of the project's source files and a Supabase pg_dump,
across a review conversation — not from assumptions. Read this file first, then
the relevant file(s) in `docs/` before making changes.

## Project Purpose

**CEST-MIS** (`cest-monitoring-and-information-system`, page title "CEST-MIS")
is an internal monitoring and document-compliance tracker for technology-transfer
projects deployed to community beneficiaries (LGUs, cooperatives, schools, NGOs,
etc.). It tracks:
- **Projects** (`project_instances`) — a specific technology (Portasol, Water
  Pump, Solar Dryer, Vermi Composting, etc.) deployed to a beneficiary in a
  given year.
- **Beneficiaries** — the organizations receiving projects.
- **Documents** — a per-project compliance checklist (MOAs, progress reports,
  transfer paperwork, etc.) tracked through four phases.
- **Contacts** — people at each beneficiary.

**INFERENCE** (not stated outright, but well supported by evidence): this is
likely a DOST-affiliated Community Empowerment through Science and Technology
program. Evidence: the favicon is `/LOGO-DOST.svg`; the `remark_level` enum
contains `'pcest'` and `'rcest'` (Provincial/Regional CEST); the deployed
"technologies" (Portasol solar dryers, water pumps, vermi-composting) match
DOST community-technology-transfer projects in the Philippines. Treat this as
background context, not a confirmed fact.

## Technology Stack (verified from files, not assumed)

- **Frontend**: React 19.2, Vite 8, React Router 7 (`createBrowserRouter`)
- **Styling**: Tailwind CSS 4 via `@tailwindcss/vite`
- **Tables**: `@tanstack/react-table` v8
- **Backend**: Supabase (Postgres + PostgREST + Auth infra present, but **no
  auth UI exists in the app** — see Warnings below), accessed via
  `@supabase/supabase-js` directly from React hooks (no server layer, no ORM)
- **Deployment**: Vercel (`vercel.json` has a SPA rewrite rule)
- **Linting**: ESLint flat config (`eslint.config.js`)

## High-Level Architecture

```
Browser (React SPA)
   │
   │  supabase-js client (anon key, from .env)
   ▼
Supabase Postgres (7 tables in `public` schema)
```

There is **no backend/API layer of its own** — every page's data hook in
`src/hooks/` calls `supabase.from('table').select/insert/update/delete(...)`
directly. Row Level Security is enabled on all tables but is currently
misconfigured to allow full anonymous access — see `docs/database.md`.

## Directory / File Structure (as verified from uploads)

```
index.html, src/main.jsx        → app bootstrap
src/App.jsx                     → router + shared Layout (Navbar + <Outlet/>)
src/components/Navbar.jsx       → top nav, links to all 6 routes, no auth UI
src/components/common/
  PaginationBar.jsx              → generic TanStack pagination control
  VisibilityPanel.jsx            → generic TanStack column-visibility panel
src/lib/
  supabase.js                    → Supabase client init (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
  documentStatus.js               → status ranking, overdue/upcoming logic, filter conditions
  documentProgress.js             → per-phase / overall completion % calculations
src/hooks/
  useProjects.js, useBeneficiaries.js, useContacts.js,
  useBeneficiaryContacts.js, useProjectContacts.js (⚠ broken, see Warnings),
  useDocuments.js, useAllDocuments.js, useDocumentTypes.js, useFormData.js
src/pages/
  dashboard/Dashboard.jsx         → route "/"
  overview/Overview.jsx           → route "/overview"
  projects/                       → route "/projects" — full CRUD + EditPanel
    Projects.jsx, columns.jsx, statusCell.jsx, filterBar.jsx,
    addModal.jsx, editPanel.jsx, DocumentChecklist.jsx, ProjectContacts.jsx
  documents/                      → route "/documents" — pivot table view
    Documents.jsx, DocBadge.jsx, filterBar.jsx, columns.jsx (⚠ unused, see Warnings)
  beneficiaries/                  → route "/beneficiaries"
    Beneficiaries.jsx, BeneficiaryModal.jsx
  contacts/                       → route "/contacts"
    Contacts.jsx, ContactModal.jsx
```

See `docs/important-files.md` for what's safe to touch and what's central.

## How Major Parts Interact

1. **Every page fetches its own data** via a dedicated hook (no global store,
   no React Query/SWR/Redux). Hooks use plain `useState`/`useEffect` and
   re-fetch the whole list after every mutation (no true optimistic UI except
   `updateDocument`, which patches local state directly).
2. **`EditPanel`** (`src/pages/projects/editPanel.jsx`) is the single shared
   "view/edit a project" slide-over, reused by both `Documents.jsx` and
   `Overview.jsx` (in addition to `Projects.jsx`). It hosts the document
   checklist and project-contacts sub-panels. Treat it as a central,
   high-blast-radius file.
3. **Deep-linking pattern**: `?edit=<id>` query params (on `/projects` and
   `/beneficiaries`) auto-open that record's edit modal/panel on load, then
   clear the param. Used to link from the Dashboard's overdue-document list
   and from a project's beneficiary link.
4. **Document generation is user-triggered**, not a DB trigger — see
   `docs/business-rules.md` for the exact algorithm.

## Development Commands

```
npm run dev       # vite dev server
npm run build      # vite build
npm run lint       # eslint .
npm run preview    # preview production build
```

No test suite was present in any uploaded batch.

## Important Coding Conventions

- Feature folders under `src/pages/<feature>/`, one folder per route.
- Modals: `<Feature>Modal.jsx` / `addModal.jsx`, controlled by parent state
  (`showModal`, `editing<Item>`), shared for both Add and Edit.
- TanStack Table used for both `/projects` and `/documents`, each with its own
  `columns.jsx`, `filterBar.jsx`, and reuse of the shared
  `PaginationBar`/`VisibilityPanel` from `components/common/`.
- Tailwind utility classes inline; no CSS modules or styled-components.
- Status/category color maps (`STATUS_COLORS`, `CATEGORY_COLORS`, `PHASE_COLORS`)
  are **redefined per-file** rather than centralized — see
  `docs/decisions.md`.

## ⚠️ Important Warnings — Do Not Break, and Known Issues

1. **`useProjectContacts.js` queries a table, `project_contacts`, that does
   NOT exist in the database** (verified directly against the full
   `supabase_backup.sql` schema dump — only 7 tables exist in `public`:
   `beneficiaries`, `beneficiary_contacts`, `document_types`, `documents`,
   `project_instances`, `project_types`, `remarks`). Any use of the Contacts
   section inside `EditPanel` will fail at runtime. **Before touching
   project-contact linking, either find/create the missing table or confirm
   with the project owner what the intended fix is** — do not silently
   "fix" this by guessing the schema.
2. **RLS is effectively disabled.** All 7 public tables have an `"allow all"`
   policy (`USING (true) WITH CHECK (true)`, no role restriction) layered on
   top of the intended anon-read / authenticated-write policies. This means
   anonymous users currently have full read/write access. Do not assume RLS
   is protecting anything until this is addressed. See `docs/database.md`.
3. **No authentication UI exists anywhere in the app**, despite Supabase Auth
   tables existing in the DB. Don't assume there's a login flow to plug into.
4. **Document generation is additive-only.** Changing a project's
   `project_category` does not remove now-irrelevant `documents` rows — it
   only adds newly-applicable ones. `EditPanel` warns the user and expects
   manual cleanup (marking old docs N/A). Don't "helpfully" auto-delete
   documents on category change without discussing it first.
5. **Duplicate / orphaned files exist.** `src/pages/documents/columns.jsx`
   defines a document-row column set that `Documents.jsx` does not import
   (it builds columns inline instead) — likely dead code. There are also two
   near-identical copies of `PaginationBar`/`VisibilityPanel` logic (the
   canonical ones live in `src/components/common/`). See
   `docs/important-files.md` before assuming which copy is "the" one in use.
6. **Router import inconsistency**: most files import from `'react-router'`,
   but `Navbar.jsx` imports from `'react-router-dom'` and `package.json` only
   lists `react-router-dom` as a dependency. Both currently work (v7's
   `react-router-dom` re-exports `react-router`), but don't assume the
   pattern is intentional either way.
7. `documentStatus.js` and `documentProgress.js` each independently define an
   "is this document complete/accomplished" check. **A code comment in
   `documentProgress.js` explicitly states these must be kept in sync** — if
   you change one, change the other.
8. Never commit real Supabase credentials. `.env` should hold
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` locally only.

## Further Reading

- `docs/architecture.md` — full frontend architecture, routing, data flow, patterns
- `docs/database.md` — full schema, RLS findings, seed-data context
- `docs/business-rules.md` — validation, status logic, document-generation rules
- `docs/important-files.md` — file-by-file guide, what's safe to touch
- `docs/decisions.md` — inferred rationale for notable patterns, with confidence levels