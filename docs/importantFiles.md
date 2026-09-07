# Important Files — CEST-MIS

## Central, High-Blast-Radius Files (understand before editing)

| File | Why it's central |
|---|---|
| `src/pages/projects/editPanel.jsx` | Shared "view/edit a project" slide-over, reused by `Projects.jsx`, `Documents.jsx`, and `Overview.jsx`. Hosts the document checklist and project-contacts sub-panels. Changes here ripple across three routes. |
| `src/lib/documentStatus.js` | Defines what "complete", "overdue", and "upcoming" mean for a document. Used by Dashboard, DocBadge, DocumentChecklist, and the Documents filter bar. **Must be kept in sync with `documentProgress.js`'s duplicate `isComplete` check** (explicit code comment). |
| `src/lib/documentProgress.js` | Computes every progress percentage/bar shown in the app (Dashboard, Overview cards, DocumentChecklist). See sync note above. |
| `src/lib/supabase.js` | The one Supabase client instance every hook depends on. |
| `src/hooks/useDocuments.js` | Contains `generateDocuments()` — the actual document-generation rule engine. Central to the core "document compliance" feature. |
| `src/pages/projects/columns.jsx` | Defines `ALL_COLUMNS`, `DEFAULT_VISIBLE`, `FILTERABLE_COLUMN_IDS`, `STATIC_OPTIONS` — imported by `Projects.jsx`, `addModal.jsx`, `editPanel.jsx`, and `projects/filterBar.jsx`. This is the **actively-used** `columns.jsx` — do not confuse with the unused one below. |

## Configuration / Setup Files (safe to modify with care, low feature risk)

- `vite.config.js`, `eslint.config.js`, `package.json` — standard tooling config.
- `vercel.json` — SPA rewrite rule for deployment; only relevant if changing routing/hosting behavior.
- `index.html` — app shell; only the title/favicon are project-specific.
- `.env` (not uploaded, referenced by `src/lib/supabase.js`) — holds
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Never commit real values.

## Safe to Modify (isolated, low cross-file impact)

- Any single `*Modal.jsx` (`BeneficiaryModal.jsx`, `ContactModal.jsx`) — form UI local to one CRUD flow.
- `DocBadge.jsx` — presentational only, consumes `documentStatus.js`, doesn't affect data.
- `App.css` — currently empty; effectively dead.
- Individual page components (`Beneficiaries.jsx`, `Contacts.jsx`) are fairly
  self-contained aside from their shared hooks/modals.

## ⚠️ Duplicate / Orphaned Files — Verify Which Copy Is Live Before Editing

Several files exist in more than one place with near-identical content. Based
on which imports actually resolve in the uploaded code:

| Canonical (imported, live) | Duplicate / likely orphaned |
|---|---|
| `src/components/common/PaginationBar.jsx` (imported by `Projects.jsx` and `Documents.jsx` via `'../../components/common/PaginationBar'`) | An identical `paginationBar.jsx` was also uploaded from what appears to be `src/pages/projects/` — same content, different casing/path. Confirm actual on-disk location before editing either. |
| `src/components/common/VisibilityPanel.jsx` | Same situation — an identical `visibilityPanel.jsx` also uploaded. |
| `src/pages/projects/columns.jsx` (imported by `Projects.jsx`, `addModal.jsx`, `editPanel.jsx`, `projects/filterBar.jsx`) | `src/pages/documents/columns.jsx` defines a *different*, document-row-shaped `ALL_COLUMNS` that **`Documents.jsx` does not import** (it builds its pivot-table columns inline instead). This file is very likely dead code. |
| `src/pages/projects/filterBar.jsx` (project-only filters, imports from `projects/columns.jsx`) | `src/pages/documents/filterBar.jsx` (different component — adds the document-type query builder, imports `DOC_CONDITIONS` from `lib/documentStatus.js`). These two `filterBar.jsx` files are **not duplicates of each other** — they're genuinely different components that happen to share a filename. Don't merge them. |

**Recommendation for any future session**: before deleting or "cleaning up"
any of the above, verify against the actual live repository which files are
on disk and which import paths resolve — this documentation is based on what
was uploaded to a conversation, not a live filesystem inspection.

## Central Data-Fetching Hooks (`src/hooks/`)

All follow the same shape: `{ data, loading, error, refetch, mutations... }`,
call `src/lib/supabase.js`'s client directly, no caching layer.

| Hook | Table(s) | Scope |
|---|---|---|
| `useProjects.js` | `project_instances` (+ joins) | All projects, full CRUD |
| `useBeneficiaries.js` | `beneficiaries` (+ project count) | All beneficiaries, full CRUD, delete-guard |
| `useContacts.js` | `beneficiary_contacts` (+ beneficiary join) | All contacts, full CRUD |
| `useBeneficiaryContacts.js` | `beneficiary_contacts` | Read-only, scoped to one beneficiary (picker use) |
| `useProjectContacts.js` | `project_contacts` ⚠ **table does not exist** | Broken — see `database.md` |
| `useDocuments.js` | `documents` (+ document_types join) | Scoped to one project; includes `generateDocuments()` |
| `useAllDocuments.js` | `documents` (+ document_types + project_instances + beneficiaries joins) | Global, used by Dashboard and Documents page |
| `useDocumentTypes.js` | `document_types` | Read-only, all rows |
| `useFormData.js` | `project_types`, `beneficiaries` (id/name only) | Dropdown lookups + inline project-type creation |

## Dependencies Between Files (import graph highlights)

- `editPanel.jsx` → `DocumentChecklist.jsx` → `useDocuments.js` (+ `documentProgress.js`, `documentStatus.js`)
- `editPanel.jsx` → `ProjectContacts.jsx` → `useProjectContacts.js` (broken) + `useBeneficiaryContacts.js`
- `Documents.jsx` → `filterBar.jsx` (documents version) + `DocBadge.jsx` + `documentStatus.js` + `documentProgress.js`
- `Projects.jsx` → `columns.jsx` (projects version) → `statusCell.jsx`
- `Projects.jsx` / `addModal.jsx` / `editPanel.jsx` all independently import `STATIC_OPTIONS` from `projects/columns.jsx` — changing that file's exports affects all three.