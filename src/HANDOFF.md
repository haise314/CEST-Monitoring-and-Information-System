# `src/` — Source Code Handoff

React SPA source. Everything under here is the frontend; there is no server-side layer.

---

## Entry points

- `main.jsx` — bootstrap: `StrictMode` + `<App />`
- `App.jsx` — `createBrowserRouter` + shared `Layout` (`Navbar` + `<Outlet />`); defines all 6 routes
- `index.css` — Tailwind import + global styles

---

## Top-level source folders

| Folder | Purpose | Handoff file |
|---|---|---|
| `components/` | Shared UI components | see below |
| `hooks/` | Data-fetching hooks (one per entity/feature) | `HANDOFF_HOOKS.md` |
| `lib/` | Pure utilities + Supabase client | `HANDOFF_LIB.md` |
| `pages/` | Route components, one folder per route | `HANDOFF_PAGES.md` |
| `assets/` | Static images (hero, react, vite logos) | N/A — just assets |

---

## Architecture at a glance

- No global state library (no Redux/Zustand/React Query). Each page fetches its own data via a local hook; re-fetches the whole list after every mutation.
- One exception: `useDocuments.updateDocument` / `useAllDocuments.updateDocument` patch local state directly ("optimistic update... preserve nested joins") instead of re-fetching.
- Every mutation function returns `{ error: string | null }` (sometimes `data`), never throws — callers check `.error` and display inline.
- All UI state (modals, edit rows, filters, sort, visibility) is local `useState` per component; only `EditPanel` persists width to `localStorage['editPanelWidth']`.
- The only Supabase client lives in `lib/supabase.js`, created from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (env vars). Every hook imports this same client.
- Tailwind 4 via `@tailwindcss/vite`; no CSS modules, no styled-components.
- TanStack Table v8 used for `/projects` and `/documents`; shared `PaginationBar` and `VisibilityPanel` in `components/common/`.

---

## Routing (defined entirely in `App.jsx`)

| Path | Component | Purpose |
|---|---|---|
| `/` | `pages/dashboard/Dashboard.jsx` | Ops summary: overdue/upcoming docs, compliance %, flags, hotspots |
| `/overview` | `pages/overview/Overview.jsx` | Projects grouped by year, card view with per-phase progress |
| `/projects` | `pages/projects/Projects.jsx` | Full project CRUD table |
| `/documents` | `pages/documents/Documents.jsx` | Project × document-type pivot table |
| `/beneficiaries` | `pages/beneficiaries/Beneficiaries.jsx` | Beneficiary CRUD table |
| `/contacts` | `pages/contacts/Contacts.jsx` | Contact CRUD table |

Not yet wired (files exist but no route): `/map`, `/itinerary`. See `docs/itinerary.md`.

### Deep-linking via `?edit=<id>`

`Projects.jsx` and `Beneficiaries.jsx` consume `?edit=<id>` query params on mount: find the matching record, open its edit UI, then clear the param. Used by Dashboard's overdue/upcoming rows → `/projects?edit=<id>`, EditPanel's beneficiary section → `/beneficiaries?edit=<id>`, Dashboard hotspots → `/documents?municipality=...&submitted=No` (**note**: `Documents.jsx` does not appear to read these query params — this link target may be aspirational/unimplemented; flag as UNKNOWN).

Tradeoff: a bookmarked `/projects?edit=5` URL only works transiently — on refresh, the param is already cleared.

---

## Import inconsistency to normalize (low risk)

Most files `import { useSearchParams } from 'react-router'` (or similar); `Navbar.jsx` imports from `'react-router-dom'`. `package.json` only declares `react-router-dom`. Both resolve at runtime under v7 (`react-router-dom` re-exports `react-router`), but it's inconsistent. Normalize to one source if touched.

---

## Shared status/category color maps — maintenance risk

`STATUS_COLORS`, `CATEGORY_COLORS`, `PHASE_COLORS` are redefined independently in:
- `Dashboard.jsx`
- `Documents.jsx`
- `projects/columns.jsx`
- `projects/statusCell.jsx`

No central constants file. If a color ever changes, all four locations need updating. Not a deliberate design choice as far as evidence shows — likely grew feature-by-feature without a refactor pass.

---

## Resizable panel

`EditPanel` implements drag-to-resize via raw `mousedown`/`mousemove`/`mouseup` listeners (no library). Width persisted to `localStorage`. Worth preserving the pattern if edited.

---

## Hook-call-order safety

`ProjectContacts.jsx` has an explicit code comment: its `if (!project) return null` guard is placed *after* all hooks are called, to keep hook order stable across renders. Preserve this if the component is edited.

---

## File count

Roughly 40 source files across the tree (excluding `node_modules`). No test files exist anywhere.

---

## See also

- `HANDOFF_HOOKS.md` — data-fetching hooks
- `HANDOFF_LIB.md` — utilities + Supabase client
- `HANDOFF_PAGES.md` — route components
- `docs/architecture.md` — full frontend architecture
- `docs/important-files.md` — file-by-file guide, what's safe to touch
