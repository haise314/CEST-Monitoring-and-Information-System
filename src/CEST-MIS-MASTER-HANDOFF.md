# CEST-MIS — Master Project Handoff

**Purpose**: paste this whole file into a new Claude conversation and it
will be fully caught up on the CEST-MIS codebase — no other docs required.
Built from the project's original `docs/` set, then verified and corrected
against a real `pg_dump` of the live database, then updated across several
build sessions. **This version is a consolidation pass**: earlier revisions
of this file grew a long numbered changelog (things like "§0 item 16") as
features shipped; those facts have now been folded directly into the
relevant sections below so the doc reads as current-state truth rather than
a session-by-session diff log. A short dated history lives in the Appendix
at the end for anyone who wants the "how we got here" narrative — nothing
load-bearing lives there, it's context only.

Confidence labels:
- **CONFIRMED** — verified in code, the live DB, or direct testing
- **INFERENCE** — reasonable but not explicitly stated
- **UNKNOWN** — genuinely undetermined
- **OPEN** — a real, current, unresolved question — see §10

---

## 1. Project Overview

**CEST-MIS** (`cest-monitoring-and-information-system`) is a **DOST-Region
III CEST program** monitoring/document-compliance tracker for
technology-transfer projects deployed to community beneficiaries (LGUs,
cooperatives, schools, NGOs). It tracks **Projects** (`project_instances`),
**Beneficiaries**, **Documents** (a per-project compliance checklist across
4 phases), **Contacts**, and **Remarks** (a lightweight per-project comment
feed). CONFIRMED by live `document_types` data: form names like "F1 -
Endorsement of PSTO" and "F2 - Evaluation and Endorsement of RPMO" (PSTO =
Provincial Science and Technology Office, RPMO = Regional Project
Monitoring Office) place this in DOST's regional structure beyond
inference. Deployed technologies seen in live data: Portasol solar dryers,
Solar-Powered Pump w/ Drip Irrigation, Sambong Processing Facility, Solar
IMTA.

Built for a small trusted team (2–3 people) — several design choices
throughout (auth scope, RLS model, remarks vs. full audit trail) are
deliberately sized for that, not a larger org.

## 2. Tech Stack

- React 19.2, Vite 8, React Router 7 (`createBrowserRouter`)
- Tailwind CSS 4 (`@tailwindcss/vite`)
- `@tanstack/react-table` v8
- Supabase (Postgres + PostgREST + real Auth now in use — see §3/§4)
- Leaflet + react-leaflet (Map feature; no API key, OSM tiles)
- Vercel deployment (`vercel.json` SPA rewrite) — **confirmed working in production**, not just localhost
- No test suite exists in any uploaded batch.

## 3. Architecture

```
Browser (React SPA)
   │  supabase-js client (anon key, from .env)
   ▼
Supabase Postgres (public schema)
```

No backend/API layer — every hook in `src/hooks/` calls
`supabase.from('table').select/insert/update/delete(...)` directly.

No global state store — **INFERENCE**: deliberate simplicity for app scale.
Each page fetches its own data via a dedicated hook, re-fetching the whole
list after mutations, **except** `useDocuments.updateDocument` /
`useAllDocuments.updateDocument`, which patch local state directly
(optimistic, preserves nested joins). Every mutation returns
`{ error: string | null }`, never throws.

### Routing table

| Path | Component | Purpose |
|---|---|---|
| `/login` | `auth/Login.jsx` | Email/password sign-in; outside `Layout`/`RequireAuth`. No self-serve signup — accounts are created directly in Supabase's dashboard. |
| `/` | `dashboard/Dashboard.jsx` | Quick actions, KPIs, overdue/upcoming docs, recent remarks, recently-updated projects, compliance, flags, charts, budget, overdue hotspots. See §3a. |
| `/overview` | `overview/Overview.jsx` | Projects grouped by year, cards w/ per-phase progress; clicking a card navigates to `/projects/:id` |
| `/projects` | `projects/Projects.jsx` | Full project CRUD table; row click opens `EditPanel` (quick edit), a small `↗` action column opens the full `/projects/:id` page |
| `/projects/:id` | `projects/ProjectDetail.jsx` | Dedicated full-page project view/edit — see §6/§8 for scope and why `EditPanel` still exists alongside it |
| `/documents` | `documents/Documents.jsx` | Project × document-type pivot table |
| `/beneficiaries` | `beneficiaries/Beneficiaries.jsx` | Beneficiary CRUD, including delete (Danger Zone in `BeneficiaryModal.jsx`, guarded by linked-project count) |
| `/contacts` | `contacts/Contacts.jsx` | Contact CRUD; supports `?edit=<id>` deep-linking |
| `/map` | `map/Map.jsx` | Two tabs: **Overview** (default) — beneficiary pins colored by category/status, filter/placement UI; **Plan Visit** — visit-itinerary planner (candidate pool + ordered stop list) |
| `/itinerary` | *(redirect only)* | `App.jsx` renders `<Navigate to="/map?mode=plan" replace />`. The old standalone page (`Itinerary.jsx`) still exists on disk, unrouted — deliberately left rather than deleted, pending a housekeeping pass. |

Every route except `/login` sits inside a `RequireAuth` wrapper around the
existing `Layout` — no session means an immediate redirect to `/login`
(original destination preserved and returned to after sign-in).

**Deep-linking**: `?edit=<id>` on `/projects` and `/beneficiaries` opens the
record's edit UI (`EditPanel` for projects) on load, then clears the param.
Used by Dashboard's overdue/upcoming rows (now pointed at `/projects/:id`
directly) and by internal cross-links. **OPEN**: whether `/projects?edit=<id>`
should eventually redirect to `/projects/:id` instead of opening
`EditPanel` — not urgent, current behavior isn't broken, just never
explicitly decided either way.

Dashboard's old municipality/submitted-status hotspot links into
`/documents` were removed — `Documents.jsx` never actually read those URL
params, so the links silently did nothing. If a real filtered drill-down
into Documents is wanted later, `Documents.jsx` would need to read
`useSearchParams` into its filter state first.

**Import inconsistency**: most files use `'react-router'`; the now-orphaned
`Navbar.jsx` used `'react-router-dom'`. `ProjectDetail.jsx` and other newer
files follow the majority `'react-router'` convention.

### 3a. Dashboard (`src/pages/dashboard/Dashboard.jsx`)

Single file, no props. Data: `useAllDocuments`, `useProjects`,
`useBeneficiaries` (count only), `useAllRemarks(10)`. Loading gates on
docs/projects/beneficiaries; remarks load independently. Centered
`max-w-6xl mx-auto space-y-5` column, top to bottom:

1. Header — title + today's date.
2. `QuickActions` — nav shortcuts to `/projects`, `/beneficiaries` (do not open the Add modal directly — out of scope).
3. `KpiRow` — projects, beneficiaries, overall compliance, total deployed (₱).
4. Overdue + Upcoming (14 days) lists — rows link to `/projects/:id`.
5. Recent Activity (latest 10 remarks, links to `/projects/:id`) + Recently Updated (8 most recently `updated_at`-stamped projects).
6. Compliance by phase + Needs-attention flags (no category / category but no checklist / stale "For Deployment" status).
7. Projects by status + Projects per year (plain-CSS bars, no chart lib).
8. Budget rollup (total, by year, by category).
9. Overdue documents by municipality (top 8, informational — no longer a broken link into Documents).

Shared primitives at the top of the file: `Card`, `CardBar`, `EmptyNote`,
`SectionHeader`, `KpiCard`, `BarChart`. New sections should use `Card`
rather than hand-rolling a bordered div. Status color map here duplicates
the ones in `Documents.jsx`/`columns.jsx`/`Map.jsx` (known duplication,
§8).

### Key lib/utility files

- **`src/lib/supabase.js`** — the one Supabase client.
- **`src/lib/AuthContext.jsx`** — `AuthProvider` + `useAuth()`: wraps `supabase.auth.getSession()`/`onAuthStateChange`, exposes `{ session, user, loading, signIn, signOut }`. Wraps the whole `RouterProvider` in `App.jsx`.
- **`src/lib/documentStatus.js`** — `getDocStatus(doc)`, `statusRank(doc)`, `isOverdue(doc)`, `isUpcoming(doc, days=14)`, `DOC_CONDITIONS`. **Must stay in sync with `documentProgress.js`'s duplicate completeness check.**
- **`src/lib/documentProgress.js`** — `computeProgress(documents)`, `progressBarColor(pct)`, `PHASE_ORDER`.
- **`src/lib/geo.js`** — `haversineDistanceKm`, `estimateMinutes` (crude, ~30km/h assumption), `nearestNeighborOrder` (greedy, not true TSP), `totalRouteDistanceKm`, `legDistances`.
- **`src/lib/officeLocation.js`** — `OFFICE_LOCATION = { latitude: 15.179, longitude: 119.980 }`, a real coordinate.
- **`src/lib/beneficiaryFilters.js`** — shared filter predicate for Map, actually wired into `Map.jsx` (`filterBeneficiaries` imported and used directly).
- **`src/lib/localAuthor.js`** — `getSavedAuthor()`/`saveAuthor(name)`, a `localStorage`-backed (key `cest_remark_author`) per-browser name for Remarks attribution, try/catch-wrapped so posting still works if storage is unavailable.
- **`src/lib/Leafleticon.js`** — fixes Leaflet's default marker icon under Vite's asset bundling. *(Filename casing note: referred to as `leafletIcon.js` in one older doc — verify actual on-disk casing if it matters.)*

### Hooks (`src/hooks/`)

All follow `{ data, loading, error, refetch, mutations... }`.

| Hook | Table(s) | Notes |
|---|---|---|
| `useProjects` | `project_instances` (+joins) | Full CRUD; consumed by both `Projects.jsx` and `ProjectDetail.jsx` |
| `useBeneficiaries` | `beneficiaries` (+project count) | Full CRUD including delete (FK delete-guard: blocks deletion while linked projects exist). `updateBeneficiary` also used by `ProjectDetail.jsx`'s editable Beneficiary section |
| `useContacts` | `beneficiary_contacts` (+beneficiary join) | Full CRUD |
| `useBeneficiaryContacts` | `beneficiary_contacts` | Read-only, scoped to one beneficiary (picker) |
| `useProjectContacts` | `project_contacts` | Confirmed working end-to-end — linking a contact to a project via the UI works |
| `useDocuments` | `documents` (+document_types join) | Scoped to one project; `generateDocuments()`. Used by both `EditPanel` and `ProjectDetail.jsx` via `DocumentChecklist.jsx` |
| `useAllDocuments` | `documents` (+joins) | Global; Dashboard + Documents page + Overview's progress bars |
| `useDocumentTypes` | `document_types` | Read-only |
| `useFormData` | `project_types`, `beneficiaries` | Dropdown lookups + inline creation; used by `EditPanel` and `ProjectDetail.jsx` |
| `useBeneficiaryLocations` | `beneficiaries` (+lat/lng+count) | Map feature |
| `useItineraries` | `itineraries`, `itinerary_stops` | `saveStops()` **not transactional** (delete-then-insert, 2 calls). Used by `Map.jsx`'s Plan Visit tab |
| `useMergedBeneficiaries` | (composed) | Now actually used by `Map.jsx` (replaced its old inline merge) — Overview and Plan Visit share one data source |
| `useRemarks` | `remarks` | Per-project feed; add + 15-minute-window delete. Used by `RemarksSection.jsx` |
| `useAllRemarks` | `remarks` (+project/beneficiary join) | Read-only, newest `limit` rows across all projects (Dashboard's Recent Activity). No mutations |
| `useColumnSizing` | — | Persists TanStack `columnSizing` to localStorage. Used by Projects/Beneficiaries/Contacts tables — not `ProjectDetail.jsx`, which is a plain page |

---

## 4. Database Schema (Supabase / Postgres)

Verified via a real `pg_dump --schema=public` of the live database.

### Enums — CONFIRMED matching the code exactly

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
`'In-house'` is spelled identically in both `project_category` and
`document_applies_to` — no mismatch between them. All five enum types were
independently re-verified intact after the `document_types` data-loss
incident (§5a) — Postgres enums are schema, not row data, so they were
never actually at risk; what looked like "erased categories" was empty
*table* data producing empty dropdowns, not a damaged enum.

### Tables

**`beneficiaries`** — `id` PK, `name` varchar(255) NOT NULL, `category`
enum NOT NULL, `district`/`municipality`/`barangay` varchar(100) nullable,
`latitude numeric(9,6)`, `longitude numeric(9,6)` (both nullable, live).
Editable in place from `ProjectDetail.jsx` (name/category/district/
municipality/barangay) — since a beneficiary's coordinates/data are shared
across every project under it, this is a shared-record edit, not
per-project. `updated_at timestamptz NOT NULL DEFAULT now()` with a
self-stamping `BEFORE UPDATE` trigger was added via migration alongside the
same column on `documents`; **not yet independently displayed anywhere in
the UI** and not the primary place chosen to surface staleness (see below).

**`beneficiary_contacts`** — `id` PK, `beneficiary_id` FK → beneficiaries,
`name` NOT NULL, `role`, `contact_number`, `messenger_link` nullable. No
`created_at`. **`updated_at` migration written, not yet confirmed run:**
`migrations/beneficiary_contacts_updated_at.sql` adds a *nullable*
`updated_at` (default `now()` for new rows) plus
`trg_beneficiary_contacts_updated_at` using the existing
`set_updated_at()`. Deliberately **not backfilled** — with no `created_at`
there is no honest value for old rows, so they stay NULL (UI shows "—")
until first edited. The UI (Contacts table column "Updated", mobile card
line, `ContactModal` "Last updated") is already written and renders nothing
until the column exists. `useContacts` needs no change (`select *`).

**`document_types`** — `id` PK, `name` varchar(255) NOT NULL, `is_default`
boolean NOT NULL default true (unused by frontend — UNKNOWN purpose),
`phase` enum nullable, `applies_to` enum NOT NULL default `'Both'`,
`is_required` boolean NOT NULL default true. UNIQUE(name, phase). Full live
data in §5a — this table was accidentally emptied once and fully restored
from backup; treat §5a as canonical.

**`documents`** — `id` PK, `project_id` FK → project_instances **ON DELETE
CASCADE**, `document_type_id` FK → document_types **NO cascade (default
NO ACTION — cannot delete a document_type still referenced by a documents
row; edit/deactivate instead)**, `custom_label` nullable, `expected_date`,
`submitted` bool, `submitted_date`, `notes`, `has_hard_copy` bool,
`hard_copy_claimable` bool, `gdrive_link`, `is_not_applicable` bool,
`updated_at` (self-stamping trigger, same migration as `beneficiaries`).

**`project_contacts`** — exists live, confirmed working end-to-end (a
contact was successfully linked to a project via the UI):
```sql
CREATE TABLE public.project_contacts (
    id integer NOT NULL,
    project_id integer NOT NULL,
    contact_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
-- PK: id · UNIQUE(project_id, contact_id)
-- FK: contact_id -> beneficiary_contacts(id) ON DELETE CASCADE
-- FK: project_id -> project_instances(id) ON DELETE CASCADE
```

**`project_instances`** — `id` PK, `year` smallint NOT NULL,
`project_type_id` FK → project_types (no cascade), `beneficiary_id` FK →
beneficiaries (no cascade — app enforces delete-guard client-side),
`title varchar(255)`, `property_number`, `amount` numeric(12,2),
`date_deployed`, `entry_point` varchar (free text), `intervention` text,
demographic counts (default 0), `operational_status` enum nullable,
`interventions_count`, `people_trained` (default 0), `impact_notes` text,
`overall_status` enum NOT NULL default `'For Deployment'`,
`gdrive_folder_link`, `created_at` timestamptz default now(),
`project_category` enum nullable. **`updated_at`: CONFIRMED live with a
working self-stamping trigger** (`project_instances_set_updated_at`,
`EXECUTE FUNCTION set_updated_at()` on UPDATE) — re-verified directly
against `information_schema`, resolving the long-standing "does this
auto-update?" unknown from the original docs.

**`project_types`** — `id` PK, `name` varchar(100) UNIQUE. Live data: Solar
IMTA, Portasol, Samahang Ayta ng Pasambot, Sambong Processing Facility,
Solar-Powered Pump w/ Drip Irrigation.

**`remarks`** — `id` PK, `project_id` FK CASCADE, `level` enum NOT NULL
(provincial/regional/pcest/rcest — *which office the remark concerns*, not
who wrote it), `content` text NOT NULL, `added_by` free text (currently a
`localStorage`-remembered per-browser name, not tied to real auth yet —
see §8 for why), `created_at`. Has a real UI now (`RemarksSection.jsx` on
`/projects/:id`): append-only, newest-first, add + 15-minute-window delete
only (no editing — corrections are posted as new remarks).

**`itineraries`** / **`itinerary_stops`** — schema as originally
documented; last known to have 0 rows. Unconfirmed whether the Plan Visit
feature has ever actually been used to save a real itinerary in production.

### Row Level Security

**Locked down.** Every table now carries exactly one policy:
`"Allow authenticated users"`, `cmd = ALL`, `roles = {authenticated}`,
`qual = true`. Anonymous/public access has been fully removed (the
earlier "allow all" policies that granted anyone with the anon key full
read/write, regardless of login state, were audited and dropped). This
means: **any signed-in user can currently read, write, and delete
everything** — there are no per-role restrictions yet (see §10 for the
planned admin/editor/viewer work). **Confirmed working correctly in both
localhost and production (Vercel).** No `profiles` table exists yet — step 1
of the §10 user-management build (`migrations/01_profiles.sql`) creates it.

### Live data snapshot (last direct verification)
5 `project_types`, 6 `beneficiaries`, 5 `project_instances` (all
`project_category = 'In-house'`), 43 `document_types` (restored, §5a).
**All 5 projects now have generated document checklists** (the earlier gap
— projects missing a checklist despite having a category set — has been
resolved by clicking Generate Checklist on each). `remarks` /
`itineraries` / `itinerary_stops` were empty as of the last check;
`project_contacts` has at least one confirmed real row from smoke-testing.

---

## 5. Business Rules

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
`isAccomplished()`/`isComplete()` (`documentStatus.js`/`documentProgress.js`)
— **must stay in sync**, per explicit code comments in both.

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
5. **Never deletes existing rows** — additive-only, even on repeated "Sync missing documents."

Project category change warning, beneficiary deletion guard, required
fields, dashboard attention flags, and status vocabularies are unchanged
from the original docs and consistent with the live schema; core logic
lives in `documentStatus.js`, `documentProgress.js`, `useDocuments.js`,
`editPanel.jsx`, `useBeneficiaries.js`.

---

## 5a. `document_types` — Full Dataset (43 rows)

The official CEST document-compliance checklist, recovered from backup
after an accidental deletion. Canonical reference.

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

Notes: `"Monitoring Form"` appears twice (ids 15, 20) — once per Semi-Annual
and Annual phase, both optional (the concrete example of "optional docs
default to N/A" in §8). `"Form 6"` and `"Form 10/11"` also legitimately
appear twice across phases — not duplicate-data bugs, `UNIQUE(name, phase)`
allows it. `is_default` is populated but still read by no frontend code
(UNKNOWN purpose). If re-seeding is ever needed again, a straightforward
`INSERT` can be built directly from this table.

---

## 6. Key Files Guide

### Central / high-blast-radius (understand before editing)

| File | Why |
|---|---|
| `src/pages/projects/editPanel.jsx` | Shared "view/edit project" slide-over. **Retained**, not replaced — used by `Projects.jsx` for fast quick-edits (status flips, single-field corrections); `Overview.jsx` no longer opens it, always links to `/projects/:id` instead. Resizable-panel/`editPanelWidth` localStorage mechanics unchanged. |
| `src/pages/projects/ProjectDetail.jsx` | Full-page `/projects/:id` view. Sections: Project Info, editable Beneficiary, Contacts, Status, Impact, Links, Document Checklist, Remarks, Danger Zone. Reuses `DocumentChecklist.jsx`, `ProjectContacts.jsx`, `RemarksSection.jsx` unchanged; adds its own Beneficiary-edit form via `useBeneficiaries.updateBeneficiary`. Layout: `max-w-6xl`, two columns above `lg` (Project Info + Beneficiary left/wide; Status/Impact/Links/Contacts right rail), Document Checklist + Remarks full-width below the grid, single column below `lg`. The Impact section's two-number-input row (in the right rail) was checked against the actual breakpoint math and confirmed fine as-is: the two-column split only activates at `lg`, where the rail still gets ~360–380px — comfortable for two number inputs. No stacking change needed. |
| `src/pages/map/Map.jsx` | Single page, two tabs (Overview / Plan Visit) via in-page state; `?mode=plan` read once on mount for the `/itinerary` redirect. Overview: pin placement/filter UI with `CATEGORY_COLORS`/`STATUS_COLORS` driving pin fill via a `getBeneficiaryColor(b, colorBy)` helper, dot markers via a Leaflet `divIcon`, filtered-out pins dimmed rather than hidden, legend keyed to the active color dimension. Plan Visit: the former `Itinerary.jsx` internals moved in as-is (name/date, save/delete, `CandidatePool`, `StopList`). Pulls beneficiary data from `useMergedBeneficiaries`, itinerary data from `useItineraries`. |
| `src/lib/AuthContext.jsx`, `src/pages/auth/Login.jsx` | Real Supabase Auth — see §3/§4. |
| `src/pages/projects/DocumentChecklist.jsx` | Pure `{ project, onChanged? }` component — phase-grouped document rows, generate/sync button. Shared by `editPanel.jsx` and `ProjectDetail.jsx`. |
| `src/pages/projects/ProjectContacts.jsx` | Pure `{ project }` component — link/unlink contacts. Shared by `editPanel.jsx` and `ProjectDetail.jsx`. |
| `src/pages/projects/RemarksSection.jsx` | `{ projectId }` — compose box (level dropdown + free-text author + textarea) + append-only newest-first feed. Level badge, author, timestamp, and (for 15 minutes post-creation only) a confirm-to-delete affordance that self-expires via a 30-second re-render tick. Must be `.jsx` not `.js` — Vite's JSX transform requires it. Used only by `ProjectDetail.jsx`. |
| `src/hooks/useRemarks.js` | `deleteRemark` has **no server-side time guard** — the 15-minute window is enforced entirely client-side in `RemarksSection.jsx`; calling the hook directly elsewhere would bypass it. |
| `src/lib/documentStatus.js` / `documentProgress.js` | Complete/overdue/upcoming + every progress % in the app. Must stay in sync with each other. |
| `src/lib/supabase.js` | The one client every hook depends on. |
| `src/hooks/useDocuments.js` | `generateDocuments()` — confirmed working correctly; the earlier "Generate Checklist" failure was purely a data problem (empty `document_types`), never a code bug. |
| `src/pages/projects/columns.jsx` | `ALL_COLUMNS`, `DEFAULT_VISIBLE`, `FILTERABLE_COLUMN_IDS`, `STATIC_OPTIONS` — the live one, not `documents/columns.jsx`. Has a `detail_link` (`↗`) action column into `/projects/:id`. |
| `src/pages/beneficiaries/BeneficiaryModal.jsx` | Add/edit form **with a working Danger Zone delete** (confirm step + `linkedProjectCount` guard) wired via `Beneficiaries.jsx`'s `onDelete={editingBeneficiary ? handleDelete : undefined}`. |

### Duplicate / orphaned files (verify on-disk before editing)
- `components/common/PaginationBar.jsx` vs `projects/paginationBar.jsx`
- `components/common/VisibilityPanel.jsx` vs `projects/visibilityPanel.jsx`
- `projects/columns.jsx` (live) vs `documents/columns.jsx` (likely dead code)
- `projects/filterBar.jsx` vs `documents/filterBar.jsx` — **not duplicates**, genuinely different components sharing a filename
- `src/pages/itinerary/Itinerary.jsx` — orphaned since the Map overhaul (nothing routes to it, `/itinerary` redirects into `/map?mode=plan` instead); left in place deliberately, not yet cleaned up. `CandidatePool.jsx`/`StopList.jsx` in the same folder are **not** orphaned — `Map.jsx`'s Plan Visit tab imports them directly.
- `Navbar.jsx` — orphaned (replaced by the sidebar/topbar shell, §6 below), safe to delete.

### App shell
Replaces the old single horizontal `Navbar.jsx`. `src/components/layout/`:
`AppLayout.jsx` (owns sidebar-collapsed + mobile-drawer state), `Sidebar.jsx`
(fixed rail, collapsible, off-canvas drawer on mobile), `Topbar.jsx`
(sticky; breadcrumb, theme toggle, avatar menu with sign out), `navConfig.jsx`
(single source of truth for nav groups — edit this file to add a page to
the nav), `icons.jsx` (inline SVGs, no icon library).

**Theme**: `src/lib/ThemeContext.jsx` + `src/theme.css`. Dark mode works by
remapping Tailwind's CSS color variables under `.dark` rather than `dark:`
variants, so existing pages flip with zero per-file edits — gray scale and
the 50–300/700–900 shades of every accent are remapped, 400–600 (buttons,
bars, pins) is untouched, `text-white` stays white via a direct
`.dark .bg-white` override rather than remapping `--color-white`. **When
writing new UI**: use normal gray/color utilities (themes itself
automatically); don't hardcode hex colors or use `bg-white/NN` opacity
variants (they bypass the override). Leaflet panes use
`.leaflet-container { isolation: isolate }` to stay below the sticky top
bar/modals; tiles invert in dark mode.

### Mobile responsiveness
`src/components/common/MobileCards.jsx` (`MobileCardList`/`MobileCard`/
`Pill`) is the phone card-list pattern: each list page renders its
TanStack table in a `hidden md:block` wrapper **and** a card list built
from `table.getRowModel().rows` in a `md:hidden` wrapper — a pure-CSS
switch, so search/filter/sort/pagination all keep working. Applied to
Projects, Beneficiaries, Contacts. `DocumentChecklist.jsx` rows wrap onto a
second line below `sm`; `BeneficiaryModal`/`ContactModal`/`addModal` become
bottom sheets on phones with safe-area padding; `Documents.jsx`'s pivot
table drops to a single pinned column below `md` instead of two.
**Confirmed tested and working on a real phone** — no longer a caveat.
**Documents** now follows the same pattern: the pivot table is `hidden
md:block`, and phones get `ProjectDocCard` cards (in `Documents.jsx`) —
beneficiary/location/year/type, status pill, overall bar, then a
**summary of the active phase tab** (x/y complete, a dot+count per status,
overdue count, and the first 3 names that are missing or overdue). Tapping a
card opens the same `EditPanel` as a table row. The earlier
"single narrow pinned column on phones" workaround (`useIsNarrow`,
`PINNED_COLUMNS_NARROW`) was removed as dead code, and the Columns button is
hidden on phones (table-only). A small **Sort** select replaces the table
headers on phones (default / beneficiary A–Z / least complete first /
newest year), driving the same TanStack sorting state. *Not yet tested on a
real phone.*

---

## 7. Known Warnings / Issues

1. **RLS grants any signed-in user full access to everything** — no
   per-role restrictions yet. This is a known, accepted gap on the path to
   the planned admin/editor/viewer system (§10), not an oversight.
2. **Document generation is additive-only.** Category change never removes
   stale `documents` rows — this is deliberate (§8), not a bug.
3. **Duplicate/orphaned files** — see §6.
4. **Router import inconsistency** — `'react-router'` vs `'react-router-dom'`
   (only the orphaned `Navbar.jsx` still uses the latter).
5. **`documentStatus.js`/`documentProgress.js` duplicate "complete" logic**
   — keep in sync if either changes.
6. **Never commit real Supabase credentials.**
7. **`useItineraries.saveStops()` not transactional** — delete-then-insert,
   two separate calls; a failure between them could leave an itinerary
   with zero stops. Acceptable risk at this scale/traffic.
8. **One itinerary = one saved "day"** — no day-grouping column, by design.
9. **`documents.document_type_id` FK has no cascade rule** — cannot delete
   a `document_types` row while any `documents` row references it; edit or
   deactivate instead.
10. **Remarks attribution still uses a `localStorage` per-browser name, not
    real identity** — real Supabase Auth exists now, but `RemarksSection.jsx`
    was deliberately left on the old system for the time being. Decided
    (not yet built): new remarks will use `profiles.full_name` once the
    `profiles` table exists as part of the user-management work (§10);
    existing rows keep their typed `added_by` text as-is.
11. **`Itinerary.jsx` is orphaned but still in the codebase** — see §6.
    Anyone touching routing or doing cleanup should know it's dead code,
    not a second source of truth for Plan Visit behavior.
12. **Any signed-in user can currently delete anything**, with no record of
    who did it (only Remarks have any time-boxed accountability, via the
    15-minute delete window). Fix (decided 2026-09-30): role-aware RLS
    (§10) restricts deleting projects/beneficiaries to admin and contacts/
    itineraries to editors+; a `deletion_log` was considered and **dropped**
    (backups cover recovery).
14. **`updated_at` coverage (verified 2026-09-30 via `information_schema.triggers`):**
    self-stamping triggers exist on `beneficiaries`
    (`trg_beneficiaries_updated_at`), `documents`
    (`trg_documents_updated_at`) and `project_instances`
    (`project_instances_set_updated_at`), all `EXECUTE FUNCTION
    set_updated_at()`. `beneficiary_contacts` has none yet (see §4). The
    `project_instances.updated_at` *column* was not queried directly, but a
    trigger that assigns it would make every project save fail if it were
    missing, so it exists in practice. **Correction:** `ProjectDetail`'s
    "Last updated" line had been reading `project.created_at` (so it showed
    the creation time, mislabeled) — now `project.updated_at`, with the exact
    timestamp as a hover tooltip. Watch out: SQL-editor scripts run as one
    transaction, so a failing statement (e.g. `CREATE TRIGGER` for a trigger
    that already exists) rolls back the whole script — write migrations with
    `if not exists` / `drop trigger if exists`.
13. **`itineraries`/`itinerary_stops` may have never been used in
    production** — both were empty at last check; unconfirmed whether any
    real itinerary was ever saved and lost, or simply never attempted.

---

## 8. Design Decisions & Rationale

- **No global state library** — INFERENCE, deliberate simplicity for app scale.
- **Manual sticky columns in `Documents.jsx`** — CONFIRMED by code comment: TanStack's built-in pinning derives offsets from column sizes, a poor fit for this table's auto-sized columns.
- **Dynamic pivot columns in `Documents.jsx` vs static in `Projects.jsx`** — INFERENCE, genuinely different data shapes.
- **Duplicated color maps across files** — INFERENCE, real maintenance risk if a color scheme ever changes.
- **Document generation additive-only** — CONFIRMED, deliberate safety choice: a stale row for a human to mark N/A is safer than risking deletion of real data.
- **Optional document types default to N/A** — CONFIRMED; concrete example is `document_types` id 15/20, "Monitoring Form" (§5a).
- **Beneficiary is now editable in place from `ProjectDetail.jsx`** — supersedes the original "beneficiary immutable after creation" rule. Scope: this means the beneficiary *row's data* is editable from within a project view, **not** that a project can be reassigned to a *different* beneficiary (`beneficiary_id` reassignment was never built). Editing here updates that beneficiary everywhere it's referenced, since coordinates/data are shared across every project under it — `ProjectDetail.jsx` surfaces this as an inline note. `editPanel.jsx`'s Beneficiary section is unchanged (still read-only summary + link out), since `EditPanel` itself wasn't rebuilt.
- **`/projects/:id` is additive, not a full `EditPanel` replacement.** Hybrid: `EditPanel` stays as the fast quick-edit tool for `Projects.jsx`'s table (status flips, single-field corrections); `Overview.jsx` — a browsing/status view by nature — always opens the full `/projects/:id` page; `Projects.jsx` also gets a small `↗` escape hatch into the full page. `Documents.jsx` was left as-is, wired to neither.
- **`/projects/:id` widened to two columns** — left/wide gets the two field-heaviest sections (Project Info, Beneficiary); right rail gets lighter ones (Status, Impact, Links, Contacts). Document Checklist and Remarks stay full-width below the grid since both are list-heavy and benefit more from width than column placement.
- **Remarks chosen over a full audit trail.** Three options were weighed: (A) manual remarks only, (B) remarks + `updated_at` timestamps, (C) a generic field-level `audit_log` with triggers and a diff UI. **A+B** was chosen — C rejected as unnecessary infrastructure for a 2–3-person tool with "no real compliance weight." Within that: a **15-minute post-only delete window, no editing, correction-via-new-remark** was chosen over an always-editable "(edited)" tag, since silent rewrites would undermine remarks' value as a history.
- **Real Supabase Auth built (individual accounts, not a shared login).** Deferred originally as unnecessary at 2–3 trusted users; the deferral ended once real beneficiary/project data was about to go in on a publicly reachable URL with RLS effectively open. Individual accounts (not one shared password) were chosen because it was barely more setup and leaves the door open to moving Remarks attribution off the `localStorage` guess-name system onto real identity later.
- **RLS rewritten to "authenticated only," dropping anon access entirely** rather than keeping a redundant anon-read policy "for convenience" — there's no real use case in this app for unauthenticated visibility into any table, and the audit found the old "allow all" policy was silently granting full access regardless of the supposedly-narrower policies sitting alongside it.
- **Map overhaul: fold Plan Visit into Map rather than keep it separate.** Framing: the map should read as portfolio state ("a true project management view"), not primarily a trip-planning tool. One pin per *beneficiary* (not per project instance) — a popup lists that beneficiary's projects rather than stacking overlapping pins at identical coordinates. Filtered-out pins stay visible but dimmed rather than disappearing, judged more useful for "at a glance across the portfolio."
- **Plan Visit stays a list UI, not a map overlay.** The lower-risk "cheap fold" (reuse the existing list components as a tab) was chosen over rendering planned stops as numbered pins with a route line on the actual map — that remains a plausible future enhancement, not rejected outright.
- **Coordinates live on `beneficiaries`, not `project_instances`** — one physical place, shared by every project under it.
- **Itinerary auto-order is greedy nearest-neighbor, not true TSP** — deliberate, agreed unnecessary at dozens-of-stops scale.
- **Dashboard polish kept the app's existing visual language** rather than a redesign — plain Tailwind gray/blue throughout, so a divergent Dashboard would look out of place.

---

## 9. Feature: Map — Current State

One page, `/map`, two tabs:

**Overview (default)** — one pin per beneficiary (via
`useMergedBeneficiaries`), popup listing that beneficiary's individual
projects (title/year/status) linking into `/projects/:id`. A "Color by:
Category / Status" control drives pin fill; existing filters
(category/status/municipality/barangay/doc-condition) narrow the set and
dim (not hide) non-matching pins. Retains the original manual
pin-placement flow for beneficiaries with no coordinates yet, plus an
unpinned-beneficiary search box.

**Plan Visit** — the former `Itinerary.jsx` functionality (candidate pool,
ordered stop list, name/visit-date fields, save/create/delete via
`useItineraries`), moved in as a tab, behavior unchanged. Still list-only
— stops are not drawn on the map (deferred, not rejected — see §8).

`/itinerary` as a standalone route no longer exists; it redirects into
`/map?mode=plan`.

**OPEN**:
1. Whether to load previously-saved itineraries via something more than the current top dropdown.
2. Whether Plan Visit should eventually draw stops on the real map (route line + numbered pins) instead of staying list-only.
3. When to clean up the orphaned `Itinerary.jsx` file and its dangling import in `App.jsx`.
4. Whether any itinerary was ever actually saved and lost, vs. the feature simply never having been used yet — worth asking directly.

---

## 10. Pending Work — What To Build Next, In Order

### Immediate
1. **Run `migrations/beneficiary_contacts_updated_at.sql`** in the Supabase
   SQL editor (safe to re-run), then confirm a contact edit shows "Updated
   just now" in the Contacts table/modal. The "Last updated" line on
   `/projects/:id` is done and now reads `updated_at` (§7 item 14).
   Optionally add the same trigger pattern to any other table that should
   show staleness later (e.g. `remarks` doesn't need it — each remark is
   timestamped).
2. ~~Decide the fate of Excel import.~~ **Dropped (2026-09-30)** — the
   legacy spreadsheet is too messy to be worth importing. Not coming back
   unless the user raises it.

### Then: user-management, session policy, backup (design revised 2026-09-30 — supersedes the earlier Edge-Function / deletion-log design; nothing built yet)

**Dropped (do not re-propose unless the user does):** dashboard map, personal
to-do list, Excel import, extra map features, duplicate-project / bulk
quick-add (only 4–6 projects per year), full audit log, **deletion log**,
sign-out on tab close, idle timeout, "keep me signed in" checkbox,
**in-app admin Users page, Supabase Edge Function, forced password change,
temporary-password handover** (the earlier design).

**Users and roles.** Three roles: admin, editor, viewer. Expected: mostly
1–2 people, at most ~5 editors + ~5 viewers, all co-workers; never shown to
citizens or clients. **Accounts are created manually in the Supabase
dashboard.** A DB trigger creates a `profiles` row for each new account with
role **viewer** by default; the admin changes the role in the Supabase Table
Editor. Only one account exists today → it becomes the sole admin (the setup
script promotes all *existing* users to admin, once).
- **Viewers:** read only.
- **Editors:** create/edit everything, post remarks, delete contacts and
  itineraries, delete their own remarks within 15 minutes.
- **Admin:** everything, plus deleting projects and beneficiaries, managing
  project types and document types, and backup/restore.
- Projects are **not** deleted in normal use — they're transferred through the
  existing status values and count as completed. Deleting a project is only an
  admin fix for one entered by mistake.
- Existing protections stay: confirm dialogs, DB blocks deleting a beneficiary
  that has projects, DB blocks deleting a document type in use, 15-minute
  remark window.
- Rules are enforced in the **database (RLS)**; hiding buttons is a courtesy.
- Remarks use `profiles.full_name`; old remarks keep their typed `added_by`.

**Session policy.** Only rule: **max session length 12 hours**; otherwise
behavior is as now (login survives tab close/refresh). Sign-in time is saved
in the browser at login; checked on load, on tab focus and about once a
minute; user is signed out after 12 h. A **toast warns 10 minutes before**
sign-out so unsaved project edits aren't lost. Browser-only check — protects
against an unattended computer, not a technical attacker (server-side
enforcement needs a paid Supabase plan). Not doing: idle timeout, tab-close
logout, keep-me-signed-in, two-factor (**OPEN:** reconsider 2FA for the admin
account later — free in Supabase, protects the one all-powerful account).

**Backup and restore (admin only).** One button downloads a single JSON file
with every table (with IDs and a version number, **never passwords**), stored
manually in Google Drive. Restore **adds and repairs by ID, never deletes
rows**, runs as one DB function that fully applies or not at all, with a
preview step first. Show "last backup: N days ago" once older than a week.
Also keep a **separate schema dump** (JSON has no structure/triggers/access
rules) — the previously uploaded `database.sql` was empty, so generate it
properly once (**OPEN**). Per-table CSV exports remain for Excel reading only —
not backups.

**Reports (last, lowest priority).** Word report templates will **not** be
automated; reports are filled by hand. Wanted: a printable/copyable **"project
profile"** compiling project, beneficiary, contacts, document status and
remarks into one view. **OPEN:** which fields to include. Later options if
ever wanted: tagged Word templates filled in the browser, or Word mail merge
from a CSV.

**Build order (do not reorder — the RLS lockdown already caused one brief
lockout by running a policy migration before accounts existed):**
1. ✅ **DONE (2026-09-30)** — `migrations/01_profiles.sql` run; `profiles`
   table + new-user trigger exist; the existing account is admin with its
   full name set; sign-in confirmed working.
2. ✅ **DONE (ran successfully, 2026-09-30)** — `migrations/02_role_policies.sql`
   (+ `02_rollback.sql` to return to "any signed-in user can do everything").
   One transaction; aborts if no admin exists. Adds `is_member()` /
   `can_edit()` / `is_admin()`; replaces the blanket policy on all 10 tables:
   everyone with a profile reads; editors insert/update everything (and may
   add project types, which the Add Project modal does) and delete contacts,
   project-contact links, itineraries and stops; admin alone deletes
   projects/beneficiaries/documents and edits `project_types`/`document_types`;
   remarks are append-only (`remarks.created_by uuid default auth.uid()` added;
   editors delete only their own within 15 min, admin any; old remarks have
   NULL → admin only). Caveat: PostgREST silently affects 0 rows on a denied
   UPDATE/DELETE (no error) — step 3 must hide those buttons.
3. ⏳ **DELIVERED, not yet applied/tested (2026-09-30):**
   - `lib/AuthContext.jsx`: loads `profiles` (role + full name) per user id (not
     per session, so hourly token refreshes don't reload); exposes `profile`,
     `role`, `isAdmin`, `canEdit`; holds the app on its loading screen until
     the profile is read; re-reads the profile on tab focus (role changes in the
     dashboard take effect without re-login). **12-hour session limit:** sign-in
     time saved in localStorage key `cest_signed_in_at` by `signIn()` only
     (falls back to Supabase `last_sign_in_at` for pre-existing sessions);
     checked on load/focus/every minute; warning toast 10 min before; signs out
     at 12 h. Browser-only enforcement.
   - Hooks `useProjects`/`useBeneficiaries`/`useContacts`/`useItineraries`:
     mutations return `{ error }` immediately if the role is insufficient
     (editor for add/update, admin for deleting projects/beneficiaries), which
     closes the "denied UPDATE/DELETE silently affects 0 rows" gap for these.
     Hooks NOT yet guarded (not uploaded): `useDocuments`, `useAllDocuments`,
     `useProjectContacts`, `useRemarks`, `useFormData`, Map/itinerary page code.
   - UI: viewers get read-only forms (`Section locked` → `<fieldset disabled>` in
     `ProjectDetail`/`editPanel`; `readOnly` prop on Beneficiary/Contact modals),
     no Add buttons, no Save bar, read-only document checklist, no remark
     compose box, no contact add/remove; Danger Zone (delete project) shown to
     admin only; beneficiary delete admin only; remark Delete = admin any, editor
     own-within-15-min (needs `remark.created_by` from `useRemarks`' select).
     `Topbar` user menu shows full name, email and role. Also folded in the two
     earlier manual mobile edits (`editPanel` `h-dvh`/`px-4 sm:px-6`,
     `ProjectDetail` `grid-cols-1 sm:grid-cols-3`).
   - Still to gate: Map / Plan Visit itinerary buttons (`Map.jsx` not seen).
4. ⏳ **DELIVERED, not yet run/applied (2026-09-30):** backup + restore.
   - `migrations/03_backup_restore.sql`: `backup_status` (one row: last
     backup/restore time, admin-read-only), `backup_export()` (one JSON document
     of all 11 public tables incl. IDs, `app:'cest-mis'`, `version:1`; no
     passwords/emails; stamps last_backup_at) and `backup_restore(payload,
     apply, overwrite)` (adds rows missing by ID; `overwrite=true` also
     overwrites rows that differ; **never deletes**; `apply=false` = preview;
     one transaction = all-or-nothing; resets id sequences; `profiles` is
     exported but NOT restored; `remarks.created_by` pointing at a missing
     login is nulled). Both functions check `is_admin()` themselves.
     **Tested for real** (steps 1–3 + the new file run on a throwaway Postgres
     with a mock of the schema): export, preview changes nothing, add-missing
     leaves newer edits alone, overwrite reverts them, serial AND identity
     sequences stay ahead, rows absent from the file survive, viewer/anon
     denied, wrong file rejected, FK-violating file rolls back completely.
   - App: `pages/backup/Backup.jsx` (route `/backup`, admin only: download,
     choose file, preview table, optional overwrite checkbox, confirm,
     schema-dump reminder), `components/layout/BackupReminder.jsx` (admin banner
     when never/\>7 days), Topbar account menu gets an admin-only
     "Backup & restore" link. **Two small manual edits:** `App.jsx` add
     `import Backup from './pages/backup/Backup'` and route
     `{ path: '/backup', element: <Backup /> }` under the Layout children;
     `AppLayout.jsx` add `import BackupReminder from './BackupReminder'` and
     `<BackupReminder />` just above `<Outlet />` inside `<main>`.
   - **OPEN:** the schema dump (`pg_dump --schema=public --schema-only
     --no-owner --no-privileges`) still has to be generated by the user once;
     the sign-up trigger is in `migrations/01_profiles.sql`, not in that dump.
5. Remarks use the real name.
6. Report support (project profile view).

### UI work done outside the user-management order (2026-09-30)
- **Filter chips on Projects** (replaces the dropdown `FilterBar`): `components/common/FilterChips.jsx`
  (reusable), `lib/filterEngine.js` (pure logic), `hooks/useSessionState.js`, `pages/projects/filterFields.js`
  (26 fields = every Projects column), `Projects.jsx` patched. "+ Filter" → searchable field list → value editor
  (select with live faceted counts / text contains / number min–max / date range / has-link). Values in one chip are
  OR'd, chips are AND'd; filters persist per browser tab (sessionStorage `projectsFilters`); bottom sheets on phones.
  Tested with a simulated browser (31 checks). `pages/projects/filterBar.jsx` is now unused by Projects (delete when
  convenient; `documents/filterBar.jsx` is a different component). **Not yet applied elsewhere** — Beneficiaries,
  Contacts, Documents and Map can reuse `FilterChips` by defining their own `fields`.
- **Decided in another thread (not built here):** patch `bg-white text-gray-800` onto every unstyled `<select>`
  (~26 across ~15 files) rather than a shared `<Select>` wrapper; **custom small SVG map icon per project type**
  (e.g. a tray for Portasol) — still to do.

### Lower priority / opportunistic
- Housekeeping: dedupe `PaginationBar`/`VisibilityPanel`, remove dead `documents/columns.jsx`, delete orphaned `Navbar.jsx` and `Itinerary.jsx` (+ its `App.jsx` import) once nobody needs them as reference.
- Consider rendering Plan Visit's stops on the actual Leaflet map (numbered pins + route line) instead of staying list-only (§8/§9) — deferred, not rejected.
- Consider whether `Documents.jsx` should also link into `/projects/:id` for triage cases needing more than the document pivot — not requested, purely opportunistic.
- ~~Raw Excel export of current app data~~ — dropped with Excel import; per-table CSV export already exists.
- ~~Report template filling~~ — decided against automating; replaced by the printable "project profile" view (see the reports paragraph above).

---

## 11. Files Not Covered by the Original `docs/` Set

Real, working, actively-imported code from build sessions after the
original doc set was last refreshed — listed here so a fresh session
doesn't have to rediscover them from raw source:

- `src/hooks/useColumnSizing.js`, `src/components/common/ResizableTh.jsx` — table column-sizing/resize helpers (§6, §3 Hooks table).
- `src/pages/projects/ProjectDetail.jsx`, `RemarksSection.jsx`, `src/hooks/useRemarks.js`, `useAllRemarks.js`, `src/lib/localAuthor.js` — the `/projects/:id` page and Remarks feature (§6).
- `src/lib/AuthContext.jsx`, `src/pages/auth/Login.jsx` — real Auth (§6).
- `src/components/layout/*` (`AppLayout.jsx`, `Sidebar.jsx`, `Topbar.jsx`, `navConfig.jsx`, `icons.jsx`), `src/lib/ThemeContext.jsx`, `src/theme.css` — the sidebar/topbar shell + dark mode (§6).
- `src/components/common/MobileCards.jsx` — phone card-list pattern (§6).
- `src/lib/ToastContext.jsx`, `src/lib/exportCsv.js`, `components/layout/CommandPalette.jsx` — toast notifications, CSV export, and global search (Ctrl/Cmd+K) — built but not yet individually detailed above beyond this list; ask if full behavior needs documenting.

---

## 12. Source Doc Inventory

| File | Status |
|---|---|
| `claude.md`, `architecture.md`, `decisions.md` | Authoritative for what they cover; database specifics superseded by §4; the `/projects/:id` decision in §8 supersedes any earlier "full EditPanel replacement" framing |
| `database.md` | Superseded by §4 — the live dump/direct verification is more current |
| `business-rules.md` | Authoritative, unchanged |
| `important-files.md` (hyphenated) | Referenced elsewhere as canonical but never supplied in any upload; only a legacy no-hyphen copy was ever available |
| `pending-issues.md` | Fully superseded — everything in it has shipped (§10) |
| `itinerary.md`, `map-itinerary.md` | Superseded by §3/§9's description of the current merged Map feature |

---

## Appendix: Brief Update History

For context only — nothing here is load-bearing, the sections above are
the source of truth.

- **First pass**: synthesized from the original `docs/` set.
- **Data-loss + recovery**: `document_types` was accidentally emptied, then
  fully restored from backup (§5a) after tracing a "Generate Checklist"
  failure to this root cause. Along the way, a long-standing doc error was
  also caught and corrected: `project_contacts` was documented everywhere
  as a missing table, but a real DB dump showed it exists and works fine.
- **`/projects/:id` shipped**: a dedicated full project page, built as a
  hybrid alongside `EditPanel` rather than a full replacement; later
  widened to a two-column layout.
- **Remarks + `updated_at` shipped**: a lightweight per-project comment
  feed plus self-stamping "last changed" timestamps, chosen over a full
  audit-log system as overkill for this app's scale.
- **Map overhaul**: the separate Itinerary page was folded into Map as a
  second tab, and Map gained category/status color-coding.
- **Real Auth + RLS lockdown**: individual Supabase accounts replaced the
  fully-open database access the app started with; confirmed working in
  both localhost and production.
- **Dashboard rebuild**: quick actions, KPIs, recent activity, charts, and
  budget rollups added; later centered and visually polished.
- **App shell + dark mode**: replaced the old top nav with a sidebar/topbar
  layout and a full light/dark theme.
- **Mobile responsiveness pass**: card-list layouts, bottom-sheet modals,
  and a simplified Documents pivot for phones — delivered and since
  confirmed working on a real device.
- **Quality-of-life additions**: toast notifications, an unsaved-changes
  guard on `/projects/:id`, CSV export, and a global command-palette search
  (Ctrl/Cmd+K).
- **Timestamps + Documents cards** (2026-09-30): fixed the header "Last
  updated" line reading `created_at`; verified which tables have
  `updated_at` triggers; added `beneficiary_contacts.updated_at` (migration
  + UI); replaced the Documents phone table with per-project summary cards.
- **This consolidation pass**: folded a long session-by-session changelog
  into the current-state sections above; confirmed the last few pending
  items (checklist generation for all projects, the `updated_at` migration,
  Beneficiaries delete UI, and the `/projects/:id` Impact-section layout —
  checked against the real breakpoint math and confirmed fine as-is) are
  all resolved. Remaining open items are just §10's Immediate list.

- **Revised brainstorm (2026-09-30)**: user-management simplified to
  manual account creation in the Supabase dashboard with a `profiles` trigger
  (no Edge Function, no admin page, no deletion log), a 12-hour browser
  session cap, admin-only JSON backup/restore, and a printable project-profile
  view for reports; several earlier ideas dropped (§10). Step 1 script:
  `migrations/01_profiles.sql`.

---

*End of master handoff.*
