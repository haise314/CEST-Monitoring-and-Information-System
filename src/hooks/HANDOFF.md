# `src/hooks/` — Data-Fetching Hooks Handoff

All hooks follow the same shape: `{ data, loading, error, refetch, mutations... }`. Each calls `lib/supabase.js`'s client directly — no caching layer, no React Query/SWR. Mutations re-fetch the whole list after success (except `updateDocument`, which patches local state directly — see notes).

---

## Hook inventory

| Hook | File | Table(s) | Scope | Notes |
|---|---|---|---|---|
| `useProjects` | `useProjects.js` | `project_instances` (+ joins) | All projects, full CRUD | — |
| `useBeneficiaries` | `useBeneficiaries.js` | `beneficiaries` (+ project count) | All beneficiaries, full CRUD | Has delete-guard: only deletes if zero linked projects |
| `useContacts` | `useContacts.js` | `beneficiary_contacts` (+ beneficiary join) | All contacts, full CRUD | — |
| `useBeneficiaryContacts` | `useBeneficiaryContacts.js` | `beneficiary_contacts` | Read-only, scoped to one beneficiary | Picker use |
| `useProjectContacts` | `useProjectContacts.js` | `project_contacts` ⚠️ | Broken | See **WARNINGS** — table does not exist in schema |
| `useDocuments` | `useDocuments.js` | `documents` (+ document_types join) | Scoped to one project | Contains `generateDocuments()` — the document-gen rule engine |
| `useAllDocuments` | `useAllDocuments.js` | `documents` (+ document_types + project_instances + beneficiaries joins) | Global | Used by Dashboard + Documents page |
| `useDocumentTypes` | `useDocumentTypes.js` | `document_types` | Read-only, all rows | — |
| `useFormData` | `useFormData.js` | `project_types`, `beneficiaries` (id/name only) | Dropdown lookups + inline project-type creation | Also exposes `addProjectType(name)` for inline creation |
| `useItineraries` | `useItineraries.js` | (itinerary-related) | Itinerary feature | New; saveStops not transactional (delete-then-insert, two calls) |
| `useMergedBeneficiaries` | `useMergedBeneficiaries.js` | — | Optional future reuse | Duplicates logic already inline in Map.jsx — optional de-dup later |
| `useAllDocuments` | `useAllDocuments.js` | — | Dashboard + Documents | Global doc view |
| `useFormData` | `useFormData.js` | — | Dropdown lookups | Also does inline project-type creation |

---

## ⚠️ WARNINGS

### `useProjectContacts.js` — broken

Queries `project_contacts` table, which does **NOT** exist in `supabase_backup.sql` (verified by grepping the entire dump — zero matches outside the hook file). Only 7 tables exist in `public`: `beneficiaries`, `beneficiary_contacts`, `document_types`, `documents`, `project_instances`, `project_types`, `remarks`.

Used by `ProjectContacts.jsx` inside `EditPanel`'s Contacts section — any use of that section will fail at runtime.

Possible explanations (none confirmed):
- Table was added to live DB after this backup was taken
- Table exists but wasn't included in this dump
- Genuine bug — feature coded against a schema that was never migrated

**Action**: verify against the live database before assuming which case applies. If the table truly doesn't exist, a straightforward migration would write it (join table: `id serial pk, project_id fk → project_instances, contact_id fk → beneficiary_contacts`), but don't create it speculatively without confirming with the project owner.

---

## Mutation pattern

Every mutation function:
- Calls Supabase (`insert` / `update` / `delete`)
- Then **re-fetches the entire list** (`await fetchX()`) rather than patching local state
- Returns `{ error: string | null }` (and sometimes `data`), never throws
- Callers check `.error` and display it inline

Exception: `useDocuments.updateDocument` / `useAllDocuments.updateDocument` patch the in-memory array directly ("optimistic update... preserve nested joins", per code comments) instead of re-fetching.

---

## Delete guards

- **Beneficiaries**: can only be deleted if zero linked `project_instances` (checked via embedded `project_instances(count)` in fetch query). Mirrors DB constraint: `project_instances.beneficiary_id` is `NO ACTION` (non-cascading) FK — unguarded delete would surface a raw Postgres FK-violation error. Code includes a defensive re-check after delete in case count changes between load and click.
- **Beneficiary contacts**: `beneficiary_contacts.beneficiary_id` is `ON DELETE CASCADE` — deleting a beneficiary silently deletes its contacts too. No guard needed or present.

---

## See also

- `HANDOFF.md` — source tree overview
- `HANDOFF_LIB.md` — Supabase client + utilities
- `docs/database.md` — full schema, RLS findings
- `docs/business-rules.md` — document status + generation rules
