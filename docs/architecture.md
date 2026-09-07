# Architecture — CEST-MIS

## Frontend Structure

Single-page React app bootstrapped in `src/main.jsx` (StrictMode + `App`).
`src/App.jsx` builds a `createBrowserRouter` with a single shared `Layout`
(`Navbar` + `<main className="p-6"><Outlet/></main>`) wrapping every route.

## Routing

Defined entirely in `src/App.jsx`:

| Path             | Component                                | Purpose                                  |
|------------------|-------------------------------------------|-------------------------------------------|
| `/`              | `pages/dashboard/Dashboard.jsx`           | Ops summary: overdue/upcoming docs, compliance %, flags, hotspots |
| `/overview`      | `pages/overview/Overview.jsx`             | Projects grouped by year, card view with per-phase progress |
| `/projects`      | `pages/projects/Projects.jsx`             | Full project CRUD table |
| `/documents`     | `pages/documents/Documents.jsx`           | Project × document-type pivot table |
| `/beneficiaries` | `pages/beneficiaries/Beneficiaries.jsx`   | Beneficiary CRUD table |
| `/contacts`      | `pages/contacts/Contacts.jsx`             | Contact CRUD table |

**Deep-linking**: `/projects?edit=<id>` and `/beneficiaries?edit=<id>` are
consumed by a `useEffect` in `Projects.jsx` / `Beneficiaries.jsx` respectively:
find the matching record once data has loaded, open its edit UI, then clear
the query param via `setSearchParams({}, { replace: true })`. Used by:
- Dashboard's overdue/upcoming document rows → `/projects?edit=<project id>`
- `EditPanel`'s beneficiary section → `/beneficiaries?edit=<beneficiary id>`
- Dashboard's geographic hotspots → `/documents?municipality=...&submitted=No`
  (**note**: `Documents.jsx` does not appear to read these query params in the
  uploaded code — this link target may be aspirational/unimplemented; flagging
  as UNKNOWN rather than assuming it works).

**Import inconsistency**: most files `import { useSearchParams } from 'react-router'`
or similar from `'react-router'`; `Navbar.jsx` imports from `'react-router-dom'`.
`package.json` only declares `react-router-dom`. Both resolve at runtime under
v7 (react-router-dom re-exports react-router), but this is inconsistent and
worth normalizing to one import source if touched.

## State Management

No global store (no Redux/Zustand/Context-based data store). Each page pulls
its own data via a dedicated hook in `src/hooks/`, using local `useState` +
`useEffect(fetchX, [])`. Pattern is consistent across all data hooks:

- `{ data, loading, error, refetch, add/update/delete... }` returned.
- Mutations (`add*`, `update*`, `delete*`) call Supabase, then **re-fetch the
  entire list** (`await fetchX()`) rather than patching local state — except:
  - `useDocuments.updateDocument` / `useAllDocuments.updateDocument`, which
    patch the in-memory array directly ("optimistic update... preserve nested
    joins", per code comments) instead of re-fetching.
- Every mutation function returns `{ error: string | null }` (and sometimes
  `data`), never throws — callers check `.error` and display it inline.

Local UI state (which modal is open, which row is being edited, filter
values, table sort/visibility) lives in each page component via `useState`;
none of it is persisted except `EditPanel`'s panel width
(`localStorage['editPanelWidth']`).

## Data Flow (typical page)

```
Page component
  ├─ calls useXxx() hook  → supabase.from(...).select(...) with joins
  ├─ derives filtered/sorted view with useMemo
  ├─ renders TanStack Table (Projects.jsx, Documents.jsx) or a plain <table>/cards
  ├─ row click → opens EditPanel or a Modal, passing the row + mutation callbacks
  └─ Modal/EditPanel calls onSave/onUpdate/onDelete → hook mutation → re-fetch
```

## Important Services / Utilities / Hooks

**`src/lib/supabase.js`** — the only Supabase client instance, created from
`import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Every hook
imports this same client.

**`src/lib/documentStatus.js`** — pure functions, no I/O:
- `getDocStatus(doc)` → `'na' | 'none' | 'claimable' | 'soft' | 'hard' | 'submitted'`
- `statusRank(doc)` → numeric rank for sorting (used by `Documents.jsx`'s
  custom `sortingFn` on document columns)
- `isOverdue(doc)`, `isUpcoming(doc, days = 14)`
- `DOC_CONDITIONS` — array of `{ id, label, test(doc) }`, powers the "Find
  documents: [type] that are [condition]" query builder in
  `documents/filterBar.jsx`

**`src/lib/documentProgress.js`** — pure functions:
- `computeProgress(documents)` → `{ byPhase, overallPct, totalApplicable, totalComplete }`
- `progressBarColor(pct)` → Tailwind class, shared by every progress bar in
  the app (Dashboard, Overview, DocumentChecklist) so color meaning stays
  consistent
- `PHASE_ORDER = ['Pre-Implementation', 'Semi-Annual', 'Annual', 'Transfer']`

**`src/hooks/useFormData.js`** — lookup data (project types, beneficiaries)
for populating dropdowns in `addModal.jsx` and `editPanel.jsx`; also exposes
`addProjectType(name)` for inline creation.

## Authentication Flow

**None exists in the uploaded code.** `src/lib/supabase.js` creates a client
with only the anon key; no `supabase.auth.*` calls, no login page, no
protected routes, no session/user state anywhere in `App.jsx`, hooks, or
`Navbar.jsx`. Supabase's `auth.*` schema tables exist in the database dump
(standard Supabase infrastructure), but nothing in the app uses them. Treat
the app as effectively open/unauthenticated as currently built — see
`docs/database.md` for how this interacts with RLS.

## External Integrations

- **Supabase** (Postgres, via `@supabase/supabase-js`) — the only backend.
- **Google Drive** — not an API integration; documents/projects just store
  plain URL text fields (`gdrive_link` on `documents`, `gdrive_folder_link`
  on `project_instances`) that render as "Open" links. No Drive API calls.
- **Vercel** — deployment target only (`vercel.json` SPA rewrite), not a
  runtime integration.

## Important Implementation Patterns

- **Pinned/sticky columns** in `Documents.jsx` are implemented manually
  (fixed `left`/`width` px values in a `PINNED_COLUMNS` map + `sticky`
  Tailwind class) rather than via TanStack's built-in column pinning, per an
  explicit code comment explaining the built-in approach didn't fit this
  table's auto-sized columns.
- **Dynamic pivot columns**: `Documents.jsx` generates one table column per
  `document_type` in the currently-selected phase tab (`activePhase`), rather
  than having static columns — this is why it does not use the static
  `columns.jsx` in its own folder.
- **Shared color/status maps are duplicated per file** rather than imported
  from one source (e.g. `STATUS_COLORS` for `overall_status` appears
  separately in `Dashboard.jsx`, `Documents.jsx`, `projects/columns.jsx`, and
  `projects/statusCell.jsx`). See `docs/decisions.md`.
- **Resizable panel**: `EditPanel` implements drag-to-resize via raw
  `mousedown`/`mousemove`/`mouseup` listeners and persists width to
  `localStorage`, rather than using a library.
- **Hook-call-order safety**: `ProjectContacts.jsx` has an explicit code
  comment noting its `if (!project) return null` guard is placed *after* all
  hooks are called, to keep hook order stable across renders — a React rules-
  of-hooks consideration worth preserving if this component is edited.