# `src/pages/` — Route Components Handoff

One folder per route. All pages fetch their own data via hooks from `../hooks/` and render TanStack Tables or plain tables/cards.

---

## Route → folder mapping

| Route | Folder | Entry component |
|---|---|---|
| `/` | `dashboard/` | `Dashboard.jsx` |
| `/overview` | `overview/` | `Overview.jsx` |
| `/projects` | `projects/` | `Projects.jsx` |
| `/documents` | `documents/` | `Documents.jsx` |
| `/beneficiaries` | `beneficiaries/` | `Beneficiaries.jsx` |
| `/contacts` | `contacts/` | `Contacts.jsx` |
| (not wired) | `map/` | `Map.jsx` |
| (not wired) | `itinerary/` | `Itinerary.jsx` |

Routes `/map` and `/itinerary` have files but no route entry in `App.jsx` yet — see `docs/itinerary.md` for wiring instructions.

---

## Folder details

### `dashboard/` — Ops summary

- `Dashboard.jsx` — route `/`; overdue/upcoming doc lists, compliance %, attention flags, geographic hotspots
- Contains `AttentionFlagsSection` — UI heuristics, not DB constraints:
  1. Projects with no `project_category` set (can't generate documents for them)
  2. Projects with `project_category` but zero `documents` rows (checklist never generated)
  3. Projects at default `overall_status` of `'For Deployment'` but `date_deployed` > 30 days ago (likely forgot to update status)
- Deep-links from overdue/upcoming rows → `/projects?edit=<project id>`
- Geographic hotspots → `/documents?municipality=...&submitted=No` (**note**: `Documents.jsx` does not appear to read these query params — link target may be unimplemented/aspirational)
- Duplicates `STATUS_COLORS` (redefined per-file — see source tree handoff)

### `overview/` — Projects grouped by year

- `Overview.jsx` — route `/overview`; card view grouped by year, per-phase progress bars
- Uses `EditPanel` for project editing (shared slide-over)
- Progress bars use `progressBarColor()` from `documentProgress.js`
- Imports `MapFilterBar` from `../map/filterBar` (reused as-is)

### `projects/` — Full project CRUD (largest folder)

- `Projects.jsx` — route `/projects`; TanStack Table, full CRUD, deep-link `?edit=<id>` support
- `columns.jsx` — **actively used**: defines `ALL_COLUMNS`, `DEFAULT_VISIBLE`, `FILTERABLE_COLUMN_IDS`, `STATIC_OPTIONS`; imported by `Projects.jsx`, `addModal.jsx`, `editPanel.jsx`, `filterBar.jsx`. **This is the canonical columns.jsx** — do not confuse with the dead one in `documents/`.
- `statusCell.jsx` — status cell renderer for the table
- `filterBar.jsx` — project-specific filters; imports from `projects/columns.jsx`
- `addModal.jsx` — add-project modal; requires `year`, `project_type_id`, `beneficiary_id`, `project_category`
- `editPanel.jsx` — **central, high-blast-radius**: shared "view/edit a project" slide-over, reused by `Projects.jsx`, `Documents.jsx`, and `Overview.jsx`. Hosts document checklist (`DocumentChecklist.jsx`) and project-contacts (`ProjectContacts.jsx`) sub-panels. Changes here ripple across three routes.
- `DocumentChecklist.jsx` — document checklist sub-panel inside EditPanel; contains "Generate Checklist" / "Sync missing documents" button that triggers `useDocuments.generateDocuments()`
- `ProjectContacts.jsx` — project-contacts sub-panel inside EditPanel; **broken** — uses `useProjectContacts.js` which queries a non-existent table
- `paginationBar.jsx` — **likely duplicate** of `src/components/common/PaginationBar.jsx`; verify which is live before editing
- `visibilityPanel.jsx` — **likely duplicate** of `src/components/common/VisibilityPanel.jsx`; verify which is live before editing
- `columns.jsx` (in `documents/` folder — **dead code**): defines a document-row column set that `Documents.jsx` does not import

### `documents/` — Project × document-type pivot table

- `Documents.jsx` — route `/documents`; builds columns dynamically per phase tab (not from `columns.jsx`); manually implements pinned/sticky columns via `PINNED_COLUMNS` map + `sticky` Tailwind class (TanStack's built-in pinning didn't fit this table's auto-sized columns — deliberate workaround per code comment)
- `filterBar.jsx` — document-specific: adds document-type query builder, imports `DOC_CONDITIONS` from `lib/documentStatus.js`. **Not a duplicate** of `projects/filterBar.jsx` — genuinely different component sharing a filename.
- `DocBadge.jsx` — presentational only; consumes `documentStatus.js`; doesn't affect data
- `columns.jsx` — **dead code**; defines document-row columns that `Documents.jsx` does not import (it builds pivot columns inline instead)
- Dynamic pivot columns: generates one table column per `document_type` in the currently-selected phase tab (`activePhase`) — why static `columns.jsx` was abandoned

### `beneficiaries/` — Beneficiary CRUD

- `Beneficiaries.jsx` — route `/beneficiaries`; TanStack Table; deep-link `?edit=<id>` support; delete-guard (only deletes if zero linked projects)
- `BeneficiaryModal.jsx` — add/edit modal; requires `name`, `category`

### `contacts/` — Contact CRUD

- `Contacts.jsx` — route `/contacts`; TanStack Table
- `ContactModal.jsx` — add/edit modal; requires `beneficiary_id`, `name`

### `map/` — Geographic overview (not wired as a route)

- `Map.jsx` — map view of beneficiaries with filters
- `filterBar.jsx` — map filter bar (different from projects/documents filterBars — not a duplicate)
- `Itinerary.jsx` imports `MapFilterBar` directly from this file (reused as-is)

### `itinerary/` — Visit-stop planning (not wired as a route)

- `Itinerary.jsx` — main itinerary page; imports `MapFilterBar` from `../map/filterBar`
- `CandidatePool.jsx` — filtered beneficiary candidate list
- `StopList.jsx` — ordered stop list with auto-order (nearest-neighbor) + drag-free reorder via ▲▼ buttons
- One itinerary = one day (no multi-day grouping without schema change)
- `saveStops` is not transactional (delete-then-insert, two calls — fine for low-traffic internal tool, flagged rather than silently ignored)

---

## Shared components

### `components/common/` — reused across pages

- `PaginationBar.jsx` — generic TanStack pagination control; imported by `Projects.jsx` and `Documents.jsx`
- `VisibilityPanel.jsx` — generic TanStack column-visibility panel

**Duplicates exist** (same content, different casing/path) in `projects/paginationBar.jsx` and `projects/visibilityPanel.jsx` — verify which is live on disk before editing either.

### `components/Navbar.jsx` — top navigation

- Links to all 6 wired routes
- No auth UI
- Imports from `'react-router-dom'` (inconsistent with other files that import from `'react-router'`)

---

## EditPanel — the central file

`src/pages/projects/editPanel.jsx` is the most blast-radius-sensitive file in the app. It's a shared slide-over reused by three routes (Projects, Documents, Overview). It hosts:

- Document checklist (`DocumentChecklist.jsx`) → `useDocuments.js` (+ `documentProgress.js`, `documentStatus.js`)
- Project contacts (`ProjectContacts.jsx`) → `useProjectContacts.js` (broken) + `useBeneficiaryContacts.js`
- Beneficiary section with deep-link to `/beneficiary?edit=<id>`
- Project category change warning: if user changes `project_category` on a project that already had one, UI shows confirmation warning that new required docs will be added but existing docs won't be removed — manual cleanup expected

---

## See also

- `HANDOFF.md` — source tree overview
- `HANDOFF_HOOKS.md` — data-fetching hooks
- `docs/architecture.md` — full frontend architecture
- `docs/important-files.md` — file criticality ratings
- `docs/itinerary.md` — itinerary feature status + wiring
