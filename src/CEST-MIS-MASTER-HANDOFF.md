# CEST-MIS — Master Project Handoff

**Purpose of this file**: paste this whole file into a new Claude conversation
and it will be fully caught up on the CEST-MIS codebase — no other docs
required. Originally synthesized from the project's full `docs/` set, then
**verified and corrected against a real `pg_dump` of the live database**
(uploaded 2026-09-23, after a `document_types` data-loss incident and
recovery). Where the live dump contradicted the older docs, this file
reflects the live dump — those points are called out under **✅ VERIFIED /
CORRECTED FROM LIVE DUMP**.

Confidence labels:
- **CONFIRMED** — verified in code and/or the live DB dump
- **INFERENCE** — reasonable but not explicitly stated
- **UNKNOWN** — genuinely undetermined
- **⚠️ DRIFT** — older docs said one thing, uploaded code/DB shows another
- **✅ CORRECTED** — a specific claim in the older docs has now been disproven by the live dump

---

## 0. Changelog — what changed in this update

1. **`document_types` was accidentally emptied, then recovered.** Full 43-row
   dataset restored from a real backup and captured below (§5a) — this is
   the actual official CEST/DOST document-compliance checklist, not a
   placeholder.
2. **✅ CORRECTED — `project_contacts` table is NOT missing.** Every prior
   doc (`database.md`, `architecture.md`, `claude.md`, `important-files.md`,
   the hooks/pages HANDOFF files) states this table doesn't exist and that
   `useProjectContacts.js`/`ProjectContacts.jsx` are broken. **The live dump
   proves this wrong** — the table exists, with exactly the schema those
   docs speculated it would need. See §4/§7 for the full correction. This
   was evidently either fixed in a session that didn't update the docs, or
   the original "missing table" finding was based on an incomplete/stale
   dump from the start.
3. **`project_instances.title` column confirmed live** — the migration from
   `pending-issues.md` Resolved Item #3 was in fact run.
4. **`beneficiaries.latitude`/`longitude` confirmed live**, matching `map-itinerary.md`.
5. **All enum values confirmed to match the code exactly** — including
   `'In-house'` spelled identically in both the `project_category` and
   `document_applies_to` enums — ruling out an enum-mismatch theory raised
   earlier while debugging the Generate Checklist failure.
6. **New finding**: only **one** project (`id=4`) in the live data actually
   has any `documents` rows generated. Projects 2, 3, 5, and 6 all have
   `project_category` set but zero documents — this is precisely the
   Dashboard's "category set but no documents generated" attention flag.
   **Action item**: once this doc is loaded, someone should open each of
   those 4 projects and click "Generate Checklist" now that `document_types`
   is restored.
7. **Confirmed no evidence of cascading data loss** beyond `document_types`
   itself — `documents`, `project_instances`, `beneficiaries`,
   `project_types` all have sensible live data. The FK from
   `documents.document_type_id → document_types.id` has **no cascade rule**
   (default `NO ACTION`), so the earlier incident could only have emptied
   `document_types` without also wiping `documents` if the delete happened
   via something that bypassed/dropped the constraint (e.g. a table
   drop+recreate) — full certainty on the exact mechanism isn't possible
   from the dump alone, but the practical damage was contained to
   `document_types`.

---

## 1. Project Overview

**CEST-MIS** (`cest-monitoring-and-information-system`) is an internal
monitoring/document-compliance tracker for technology-transfer projects
deployed to community beneficiaries (LGUs, cooperatives, schools, NGOs). It
tracks **Projects** (`project_instances`), **Beneficiaries**, **Documents**
(a per-project compliance checklist across 4 phases), and **Contacts**.

**CONFIRMED by the live document_types data (§5a)**: this is a **DOST-Region
III CEST program** — form names like "F1 - Endorsement of PSTO," "F2 -
Evaluation and Endorsement of RPMO," and project titles referencing "CEST in
Region III" put this beyond inference now. PSTO = Provincial Science and
Technology Office, RPMO = Regional Project Monitoring... (office names
specific to DOST's regional structure). Deployed technologies seen in live
data: Portasol solar dryers, Solar-Powered Pump w/ Drip Irrigation, Sambong
Processing Facility, Solar IMTA.

## 2. Tech Stack

- React 19.2, Vite 8, React Router 7 (`createBrowserRouter`)
- Tailwind CSS 4 (`@tailwindcss/vite`)
- `@tanstack/react-table` v8
- Supabase (Postgres + PostgREST + Auth infra present, **no auth UI in the app**), via `@supabase/supabase-js` directly from hooks — no server layer, no ORM
- Leaflet + react-leaflet (Map feature; no API key, OSM tiles)
- Vercel deployment (`vercel.json` SPA rewrite)
- No test suite exists in any uploaded batch.

## 3. Architecture

```
Browser (React SPA)
   │  supabase-js client (anon key, from .env)
   ▼
Supabase Postgres (public schema)
```

No backend/API layer — every hook in `src/hooks/` calls
`supabase.from('table').select/insert/update/delete(...)` directly. RLS is
enabled on every table but effectively disabled (see §7).

No global state store — **INFERENCE**: deliberate simplicity for app scale.
Each page fetches its own data via a dedicated hook, re-fetching the whole
list after mutations, **except** `useDocuments.updateDocument` /
`useAllDocuments.updateDocument`, which patch local state directly
(optimistic, preserves nested joins). Every mutation returns
`{ error: string | null }`, never throws.

### Routing table

| Path | Component | Purpose |
|---|---|---|
| `/` | `dashboard/Dashboard.jsx` | Overdue/upcoming docs, compliance %, attention flags, geo hotspots |
| `/overview` | `overview/Overview.jsx` | Projects grouped by year, cards w/ per-phase progress |
| `/projects` | `projects/Projects.jsx` | Full project CRUD table |
| `/documents` | `documents/Documents.jsx` | Project × document-type pivot table |
| `/beneficiaries` | `beneficiaries/Beneficiaries.jsx` | Beneficiary CRUD |
| `/contacts` | `contacts/Contacts.jsx` | Contact CRUD |
| `/map` | `map/Map.jsx` | Leaflet map, pin beneficiaries, filter by doc compliance |
| `/itinerary` | `itinerary/Itinerary.jsx` | Build/save ordered visit itineraries |

> **⚠️ DRIFT (unresolved)**: `Navbar.jsx` links to both `/map` and
> `/itinerary`, but `App.jsx` was never part of any upload batch, so it's
> still **UNKNOWN** whether the matching route entries exist there. Verify
> `App.jsx` directly before assuming these routes are reachable.

**Deep-linking**: `?edit=<id>` on `/projects` and `/beneficiaries` — opens
the record's edit UI on load, then clears the param. Used by Dashboard's
overdue/upcoming rows and EditPanel's beneficiary link. Dashboard's
geographic-hotspot links to `/documents?municipality=...&submitted=No` —
`Documents.jsx` does not read these params; unconfirmed if aspirational or
broken.

**Import inconsistency**: most files use `'react-router'`, `Navbar.jsx` uses
`'react-router-dom'`. Both work under v7 but aren't consistent.

### Key lib/utility files

- **`src/lib/supabase.js`** — the one Supabase client. No `supabase.auth.*` calls anywhere.
- **`src/lib/documentStatus.js`** — `getDocStatus(doc)`, `statusRank(doc)`, `isOverdue(doc)`, `isUpcoming(doc, days=14)`, `DOC_CONDITIONS`. **Must stay in sync with `documentProgress.js`'s duplicate completeness check.**
- **`src/lib/documentProgress.js`** — `computeProgress(documents)`, `progressBarColor(pct)`, `PHASE_ORDER`.
- **`src/lib/geo.js`** — `haversineDistanceKm`, `estimateMinutes` (crude, ~30km/h assumption), `nearestNeighborOrder` (greedy, not true TSP), `totalRouteDistanceKm`, `legDistances`.
- **`src/lib/officeLocation.js`** — `OFFICE_LOCATION = { latitude: 15.179, longitude: 119.980 }` — **now a real coordinate**, not the `null` placeholder the original `itinerary.md` described.
- **`src/lib/beneficiaryFilters.js`** — shared filter predicate for Map + Itinerary; **not yet wired into `Map.jsx`** (still has its own inline copy) — optional future de-dup.
- **`src/lib/Leafleticon.js`** — fixes Leaflet's default marker icon under Vite's asset bundling. *(Filename casing note: referred to as `leafletIcon.js` in `map-itinerary.md` — verify actual on-disk casing.)*

### Hooks (`src/hooks/`)

All follow `{ data, loading, error, refetch, mutations... }`.

| Hook | Table(s) | Notes |
|---|---|---|
| `useProjects` | `project_instances` (+joins) | Full CRUD |
| `useBeneficiaries` | `beneficiaries` (+project count) | Full CRUD; delete-guard (0 linked projects) |
| `useContacts` | `beneficiary_contacts` (+beneficiary join) | Full CRUD |
| `useBeneficiaryContacts` | `beneficiary_contacts` | Read-only, scoped to one beneficiary (picker) |
| `useProjectContacts` | `project_contacts` | **✅ CORRECTED — table exists live, this hook is NOT broken.** See §7. |
| `useDocuments` | `documents` (+document_types join) | Scoped to one project; `generateDocuments()` |
| `useAllDocuments` | `documents` (+joins) | Global; Dashboard + Documents page |
| `useDocumentTypes` | `document_types` | Read-only |
| `useFormData` | `project_types`, `beneficiaries` | Dropdown lookups + inline creation |
| `useBeneficiaryLocations` | `beneficiaries` (+lat/lng+count) | Map feature |
| `useItineraries` | `itineraries`, `itinerary_stops` | `saveStops()` **not transactional** (delete-then-insert, 2 calls) |
| `useMergedBeneficiaries` | (composed) | Factored out of Map.jsx's merge logic; Map.jsx itself still uses its own inline version |
| `useColumnSizing` | — | Persists TanStack `columnSizing` to localStorage. **Not in any original doc** — see §11. |

### Components not in original docs
`src/components/common/ResizableTh.jsx` — resizable/sortable `<th>` with
drag handle, used by Projects/Beneficiaries/Contacts tables. See §11.

---

## 4. Database Schema (Supabase / Postgres) — Verified Live 2026-09-23

Source: a real `pg_dump --schema=public` of the live database, uploaded and
read directly. This section supersedes the schema description in the
original `database.md` wherever they conflict.

### Enums — all CONFIRMED matching the code exactly

```sql
beneficiary_category:  LGU, Academe, SDO, NGO, Cooperative, Others, BLGU
document_applies_to:   Both, In-house, Fund Transfer
document_phase:        Pre-Implementation, Semi-Annual, Annual, Transfer
operational_status:    Operational, Non-operational, For Repair & Maintenance
overall_status:        For Deployment, For Implementation, For Monitoring,
                        For Transfer, Transfer Ongoing, Fully Transferred,
                        For Pull Out, Done
project_category:      In-house, Fund Transfer
remark_level:           provincial, regional, pcest, rcest
```
`'In-house'` is spelled identically (hyphen, lowercase h) in both
`project_category` and `document_applies_to` — no mismatch between them.

### Tables

**`beneficiaries`** — `id` PK, `name` varchar(255) NOT NULL, `category`
enum NOT NULL, `district`/`municipality`/`barangay` varchar(100) nullable,
**`latitude numeric(9,6)`, `longitude numeric(9,6)` — both nullable, CONFIRMED live.**

**`beneficiary_contacts`** — `id` PK, `beneficiary_id` FK → beneficiaries
(no explicit ON DELETE in the dump's constraint list shown, but prior docs
say CASCADE and app behavior assumes it), `name` NOT NULL, `role`,
`contact_number`, `messenger_link` nullable.

**`document_types`** — `id` PK, `name` varchar(255) NOT NULL, `is_default`
boolean NOT NULL default true (still unused by frontend — UNKNOWN purpose),
`phase` enum nullable, `applies_to` enum NOT NULL default `'Both'`,
`is_required` boolean NOT NULL default true. UNIQUE(name, phase).
**Full live data in §5a.**

**`documents`** — `id` PK, `project_id` FK → project_instances **ON DELETE
CASCADE**, `document_type_id` FK → document_types **NO explicit ON DELETE
(default NO ACTION — cannot delete a document_type still referenced by a
documents row)**, `custom_label` nullable, `expected_date`, `submitted`
bool, `submitted_date`, `notes`, `has_hard_copy` bool, `hard_copy_claimable`
bool, `gdrive_link`, `is_not_applicable` bool.

**`project_contacts`** — ✅ **EXISTS LIVE. Schema:**
```sql
CREATE TABLE public.project_contacts (
    id integer NOT NULL,
    project_id integer NOT NULL,
    contact_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
-- PK: id
-- UNIQUE(project_id, contact_id)
-- FK: contact_id -> beneficiary_contacts(id) ON DELETE CASCADE
-- FK: project_id -> project_instances(id) ON DELETE CASCADE
-- RLS: "allow all" policy, same as every other table
```
This is **exactly** the shape the old docs guessed it would need to be if
someone built the missing migration. Whether it was built in a later
session that didn't update the docs, or the earlier "table doesn't exist"
finding was simply wrong (stale/incomplete dump at the time), can't be
determined from here — but the table is real, matches
`useProjectContacts.js`'s queries field-for-field, and currently has
**0 rows** (unused, not broken).

**`project_instances`** — `id` PK, `year` smallint NOT NULL, `project_type_id`
FK → project_types (no cascade), `beneficiary_id` FK → beneficiaries (no
cascade — app enforces delete-guard client-side), `property_number`,
`amount` numeric(12,2), `date_deployed`, `entry_point` varchar (free text),
`intervention` text, demographic counts (default 0), `operational_status`
enum nullable, `interventions_count`, `people_trained` (default 0),
`impact_notes` text, `overall_status` enum NOT NULL default `'For
Deployment'`, `gdrive_folder_link`, `created_at`/`updated_at` timestamptz
default now(), `project_category` enum nullable, **`title varchar(255)` —
CONFIRMED live, the migration from `pending-issues.md` was run.**

**`project_types`** — `id` PK, `name` varchar(100) UNIQUE. Live data: Solar
IMTA, Portasol, Samahang Ayta ng Pasambot, Sambong Processing Facility,
Solar-Powered Pump w/ Drip Irrigation.

**`remarks`** — `id` PK, `project_id` FK CASCADE, `level` enum NOT NULL,
`content` text NOT NULL, `added_by` free text, `created_at`. **0 rows live
— confirmed still unused**, no uploaded frontend reads/writes it.

**`itineraries`** / **`itinerary_stops`** — schema as documented in
`map-itinerary.md`, **0 rows live** — feature built but not yet used in
production, or was wiped along with `document_types` (can't distinguish
from the dump alone; worth asking whether any itineraries were ever
actually saved before this incident).

### Row Level Security
Unchanged from before: every table (including the newer ones) has an
"allow all" policy granting `anon` full read/write. Real-world access
control is currently none.

### ⚠️ Live data snapshot (as of this dump)
- 5 `project_types`, 6 `beneficiaries` (ids 1–6, though only 2–6 appear in
  `project_instances`), 5 `project_instances` (ids 2–6, all `project_category
  = 'In-house'`), **43 `document_types`** (just restored),
  **only 1 project (id=4) has any `documents` rows** (27 of them) — see
  Changelog item 6 for the action this implies, `project_contacts` / `remarks`
  / `itineraries` / `itinerary_stops` all empty.

---

## 5. Business Rules

(Unchanged from original docs — verified consistent with the live schema.)

### Document status (`documentStatus.js`), priority order via `getDocStatus(doc)`:
1. `na` — `is_not_applicable = true` (or row doesn't exist for this project)
2. `submitted`
3. `hard` — `has_hard_copy = true`
4. `soft` — `gdrive_link` set
5. `claimable` — `hard_copy_claimable = true`
6. `none` — nothing on file

### "Accomplished"/"complete"
Any of `submitted`, `has_hard_copy`, `gdrive_link`, `hard_copy_claimable`
truthy — independent of the ranking above. Duplicated in
`isAccomplished()`/`isComplete()` — **must stay in sync** (explicit code
comment in both).

**N/A documents excluded from both numerator and denominator** of any completion %.

### Overdue / Upcoming
- Overdue: `expected_date` past, not N/A, not accomplished.
- Upcoming: due within 14 days (`UPCOMING_WINDOW_DAYS`), not overdue, not accomplished, not N/A.
- No `expected_date` → never overdue/upcoming.

### Progress calculation
`pct = round(completeCount / applicableCount * 100)`, or 0 if
`applicableCount === 0`. Bar: green@100%, blue≥50%, yellow<50%.

### Document generation (`useDocuments.generateDocuments(projectCategory)`)
1. Project must have `project_category` set.
2. Fetch `document_types` where `phase IS NOT NULL` and `applies_to IN ('Both', projectCategory)`.
3. Skip types the project already has a `documents` row for.
4. Insert new rows: `submitted=has_hard_copy=hard_copy_claimable=false`; `is_not_applicable = !document_types.is_required`.
5. **Never deletes existing rows** — additive-only.

### Project category change warning, beneficiary deletion guard, required
fields, dashboard attention flags, status vocabularies — all unchanged from
original docs, see prior sections in this project's history if the detail
is needed; core logic files (`documentStatus.js`, `documentProgress.js`,
`useDocuments.js`, `editPanel.jsx`, `useBeneficiaries.js`) are unchanged.

---

## 5a. `document_types` — Full Restored Dataset (43 rows)

This is the actual, complete, official CEST document-compliance checklist —
recovered from a real backup after an accidental deletion. Treat this table
as the canonical reference; nothing in the earlier docs enumerated this.

| id | name | is_default | phase | applies_to | is_required |
|---|---|---|---|---|---|
| 1 | TNA 1 | true | Pre-Implementation | Both | true |
| 2 | TNA 4 | true | Pre-Implementation | Both | true |
| 3 | TNA Addendum | true | Pre-Implementation | Both | true |
| 4 | TNA Beneficiary Profile | true | Pre-Implementation | Both | true |
| 5 | LOI (Letter of Intent) | true | Pre-Implementation | Both | true |
| 6 | Project Proposal | false | Pre-Implementation | Both | false |
| 7 | GAD Score Sheet | true | Pre-Implementation | Both | true |
| 8 | Endorsement Letter | true | Pre-Implementation | Both | true |
| 9 | MOA | true | Pre-Implementation | Both | true |
| 10 | Certificate | false | Pre-Implementation | In-house | false |
| 11 | Resolution | false | Pre-Implementation | In-house | false |
| 12 | Form 5 - Project Workplan | true | Pre-Implementation | Fund Transfer | true |
| 13 | Form 6 - Line-Item Budget | true | Pre-Implementation | Fund Transfer | true |
| 14 | 1st Progress Report | true | Semi-Annual | Both | true |
| 15 | Monitoring Form | false | Semi-Annual | Both | false |
| 16 | Post Activity Report | true | Semi-Annual | In-house | true |
| 17 | Form 10 - Executive Summary of Technical Progress Report | true | Semi-Annual | Fund Transfer | true |
| 18 | Form 11 - Financial Report | true | Semi-Annual | Fund Transfer | true |
| 19 | 2nd Progress Report | true | Annual | Both | true |
| 20 | Monitoring Form | false | Annual | Both | false |
| 21 | Form 10 - Executive Summary of Technical Progress Report | true | Annual | Fund Transfer | true |
| 22 | Form 11 - Financial Report | true | Annual | Fund Transfer | true |
| 23 | Form 8 - List of Personnel Involved | true | Annual | Fund Transfer | true |
| 24 | Form 9 - List of Equipment Purchased | true | Annual | Fund Transfer | true |
| 25 | Form 12 - Fund Utilization Report | true | Annual | Fund Transfer | true |
| 26 | Form 13 - Schedule of Accounts Payable | true | Annual | Fund Transfer | true |
| 27 | Completion Report | true | Transfer | Both | true |
| 28 | JEV (Journal Entry Voucher) | true | Transfer | Both | true |
| 29 | PAR (Property Acknowledgement Receipt) | true | Transfer | Both | true |
| 30 | LOI for Transfer | true | Transfer | In-house | true |
| 31 | Feature Article | true | Transfer | In-house | true |
| 32 | F1 - Endorsement of PSTO | true | Transfer | In-house | true |
| 33 | F2 - Evaluation and Endorsement of RPMO | true | Transfer | In-house | true |
| 34 | Approval of Request of Ownership | true | Transfer | In-house | true |
| 35 | Property Transfer Report | true | Transfer | In-house | true |
| 36 | List of Equipment Purchased (LEP) | true | Transfer | In-house | true |
| 37 | Deed of Donation and Certificate of Acceptance (DOD&CA) | true | Transfer | In-house | true |
| 38 | Reports of Checks Issued (RCI) | true | Transfer | Fund Transfer | true |
| 39 | Report of Cash Disbursements (RCD) | true | Transfer | Fund Transfer | true |
| 40 | Form 15 - Project Monitoring and Field Evaluation Report | true | Transfer | Fund Transfer | true |
| 41 | Form 6 - Line-Item Budget | true | Transfer | Fund Transfer | true |
| 42 | Form 18 - Terminal Financial Report | true | Transfer | Fund Transfer | true |
| 43 | Form 17 - Executive Summary for the Terminal Accomplishment Report | true | Transfer | Fund Transfer | true |

Notes on this list:
- `"Monitoring Form"` appears **twice** (ids 15 and 20) — once per Semi-Annual and once per Annual phase, both optional. This matches the `UNIQUE(name, phase)` constraint (same name allowed across different phases) and is the specific example `decisions.md` cited for "optional docs default to N/A."
- `"Form 6 - Line-Item Budget"` and `"Form 10/11 - ..."` also appear twice across different phases (13/41, 17/21, 18/22) — same pattern, not a duplicate-data bug.
- Only `id=6` (Project Proposal) and `ids 10–11` (Certificate, Resolution) are `is_default=false` among the "Both"/"In-house" Pre-Implementation set — everything else defaults true, though `is_default` itself is still not read by any frontend code (**UNKNOWN purpose**, unchanged from before).
- If `document_types` ever needs re-seeding again, the SQL to do it is a straightforward `INSERT` built directly from this table — ask if that's needed.

---

## 6. Key Files Guide

### Central / high-blast-radius (understand before editing)

| File | Why |
|---|---|
| `src/pages/projects/editPanel.jsx` | Shared "view/edit project" slide-over, reused by Projects/Documents/Overview. **Slated for replacement — see §10.** |
| `src/lib/documentStatus.js` | Defines complete/overdue/upcoming. **Must sync with `documentProgress.js`.** |
| `src/lib/documentProgress.js` | Computes every progress % in the app. |
| `src/lib/supabase.js` | The one client every hook depends on. |
| `src/hooks/useDocuments.js` | `generateDocuments()` — the document-gen rule engine. **Verified working correctly** — the earlier "Generate Checklist" failure was 100% a data problem (empty `document_types`), not a code bug. |
| `src/pages/projects/columns.jsx` | `ALL_COLUMNS`, `DEFAULT_VISIBLE`, `FILTERABLE_COLUMN_IDS`, `STATIC_OPTIONS` — the live one, not `documents/columns.jsx`. |

### Duplicate / orphaned files (unchanged, verify on-disk before editing)
- `components/common/PaginationBar.jsx` vs `projects/paginationBar.jsx`
- `components/common/VisibilityPanel.jsx` vs `projects/visibilityPanel.jsx`
- `projects/columns.jsx` (live) vs `documents/columns.jsx` (likely dead code)
- `projects/filterBar.jsx` vs `documents/filterBar.jsx` — **not duplicates**, genuinely different components sharing a filename

---

## 7. Known Warnings / Issues

1. ~~`useProjectContacts.js` queries a non-existent table~~ **✅ CORRECTED —
   the table exists live with the exact expected schema (§4). This is NOT
   currently broken.** Before assuming it works perfectly end-to-end though:
   it has 0 rows in production, meaning **the Contacts section of EditPanel
   has apparently never actually been used successfully** — worth a quick
   manual smoke test (add a contact link to a project via the UI) before
   fully trusting it, since "the table exists and the query shape matches"
   is necessary but not sufficient proof of a working feature.
2. **RLS is effectively disabled** on every table, including the newer ones. Documented as a finding, not fixed.
3. **No authentication UI anywhere.**
4. **Document generation is additive-only.** Category change never removes stale `documents` rows.
5. **Duplicate/orphaned files** — see §6.
6. **Router import inconsistency** — `'react-router'` vs `'react-router-dom'`.
7. **`documentStatus.js`/`documentProgress.js` duplicate "complete" logic** — keep in sync.
8. **Never commit real Supabase credentials.** *(A placeholder password was pasted into this chat during debugging — confirmed by the user to be a fake/example value, not the real one, but worth being generally careful about this going forward.)*
9. **`useItineraries.saveStops()` not transactional** — delete-then-insert, two calls.
10. **One itinerary = one saved "day"** — no day-grouping column, by design.
11. **`CATEGORY_COLORS` declared but unused in `Map.jsx`** — default markers only.
12. **NEW: Only 1 of 5 live projects has a generated document checklist.** Projects 2, 3, 5, 6 all have `project_category = 'In-house'` set but zero `documents` rows — this is exactly the Dashboard's "category set but no documents generated" attention flag. Now that `document_types` is restored, someone needs to open each and click Generate Checklist.
13. **NEW: `documents.document_type_id` FK has no cascade rule** (default `NO ACTION`) — this means you cannot delete a `document_types` row while any `documents` row still references it; the delete will fail with a constraint violation. Relevant if `document_types` is ever edited/cleaned up again — do it by editing/deactivating rows, not deleting them, unless you first handle the referencing `documents` rows.

---

## 8. Design Decisions & Rationale

(Unchanged from original docs except where noted.)

- **No global state library** — INFERENCE, deliberate simplicity.
- **Manual sticky columns in `Documents.jsx`** — CONFIRMED by code comment.
- **Dynamic pivot columns in `Documents.jsx` vs static in `Projects.jsx`** — INFERENCE.
- **Duplicated color maps across files** — INFERENCE, real maintenance risk.
- **Document generation additive-only** — CONFIRMED, deliberate safety choice.
- **Optional document types default to N/A** — CONFIRMED; concrete example is `document_types` id 15/20, "Monitoring Form" (§5a).
- **Beneficiary immutable after project creation** — CONFIRMED by UI copy. **Being superseded — see §10, Pending Issue #7.**
- **Deep-link `?edit=<id>`** — INFERENCE. **Partially being superseded for projects specifically — see §10.**
- **RLS "allow all" alongside narrower policies** — INFERENCE, likely leftover dev setup.
- **No schema-validation library** — INFERENCE, reasonable for current form complexity.
- **Coordinates on `beneficiaries`, not `project_instances`** — one physical place, shared by every project under it.
- **Itinerary nearest-neighbor, not true TSP** — deliberate, agreed unnecessary at this scale.

---

## 9. Feature: Map + Itinerary — Current State

Unchanged from the prior version of this handoff — see original detail. Key
point reconfirmed by the live dump: `itineraries`/`itinerary_stops` both
have 0 rows, so either the feature has genuinely never been used to save a
real itinerary yet, or any saved itineraries were lost in the same incident
that emptied `document_types`. Worth asking the user directly whether they
ever successfully saved one, to know whether this is expected-empty or also
needs recovery.

Still open, per the original handoff:
1. Whether to load previously-saved itineraries via something more than the current top dropdown.
2. Whether to wire `CATEGORY_COLORS` into custom map markers.
3. Confirm `/map` and `/itinerary` are reachable (needs `App.jsx`, still not supplied).

---

## 10. Pending Work — What To Build Next, In Order

### Immediate (do first, low effort)
Regenerate document checklists for the 4 projects that don't have one yet
(ids 2, 3, 5, 6) — now that `document_types` is restored, this should work
correctly. Good opportunity to also manually verify the Generate Checklist
button end-to-end, since that's exactly what was broken.

### Then: verify state before building new features
- **Get `src/App.jsx`** — still the one file never supplied; needed to confirm `/map`/`/itinerary` routing and to build the new `/projects/:id` route below.
- Quick smoke-test `ProjectContacts.jsx` (add a contact to a project) now that §7 item 1 says the table exists but has never been used successfully.

### Then: the major remaining feature — dedicated project page (`/projects/:id`)
All design decisions already made, don't re-ask:
1. Beneficiary section becomes genuinely editable in place (overturns the "immutable beneficiary" decision, §8).
2. New route `/projects/:id` replaces the `EditPanel` overlay. Migrate all sections in: Project Info, Beneficiary (now editable), Contacts, Status, Impact, Links, Document Checklist, Danger Zone. Drop the resizable-panel/localStorage-width mechanics.
3. `Projects.jsx`, `Documents.jsx`, `Overview.jsx` all switch from opening `EditPanel` to `navigate('/projects/:id')`.
4. `?edit=<id>` deep-link fate — suggested default (confirm with user first): redirect to `/projects/:id` for backward compatibility with Dashboard's links, rather than retiring the pattern outright.
5. Once shipped: add a superseded-note to the "beneficiary is immutable" decision in §8.

### Lower priority / opportunistic
- Decide on saved-itinerary browsing beyond the current dropdown.
- Decide on `CATEGORY_COLORS` wiring for map markers.
- Housekeeping: dedupe `PaginationBar`/`VisibilityPanel`, remove dead `documents/columns.jsx`, normalize router imports.
- Confirm whether any itineraries were lost (§9) and whether they need reconstruction like `document_types` did.

---

## 11. Files Present in Code But Not Covered by Any Original Doc

- **`src/hooks/useColumnSizing.js`** — persists TanStack `columnSizing` to localStorage; used by Projects/Beneficiaries/Contacts tables.
- **`src/components/common/ResizableTh.jsx`** — resizable/sortable `<th>` with drag handle; used across all three tables.

Both are real, working, actively-imported code from a build session that
happened after the original doc set was last refreshed. Worth a note in the
live docs folder next time it's touched.

---

## 12. Source Doc Inventory

| File | Status |
|---|---|
| `claude.md`, `architecture.md`, `decisions.md` | Authoritative for what they cover; database specifics superseded by §4 above where they conflict |
| `database.md` | **Superseded by §4 of this document** — the live dump is more current, most notably on `project_contacts` |
| `business-rules.md` / `business rules.md` (space) | Authoritative, unchanged |
| `important-files.md` (hyphenated) | Referenced by other docs as canonical but never supplied in any upload — only the legacy `importantFiles.md` was available; reconcile if the hyphenated version turns up |
| `pending-issues.md` | Phase 1&2 done and now DB-verified done (title column, entry point); Phase 3 is the remaining work, §10 |
| `itinerary.md`, `map-itinerary.md` | Superseded on the `OFFICE_LOCATION` and empty-itineraries-table points by §3/§9 above |

---

*End of master handoff. Load this single file into a new session instead of
the original doc set — it incorporates everything from them plus direct
verification against a live database dump.*
