# CEST-MIS — Master Project Handoff

**Purpose of this file**: paste this whole file into a new Claude conversation
and it will be fully caught up on the CEST-MIS codebase — no other docs
required. Originally synthesized from the project's full `docs/` set, then
**verified and corrected against a real `pg_dump` of the live database**
(uploaded 2026-09-23, after a `document_types` data-loss incident and
recovery). Then further updated the same day after `App.jsx` was supplied
and the dedicated `/projects/:id` page was built. Where the live dump or
live testing contradicted the older docs, this file reflects reality —
those points are called out under **✅ VERIFIED / CORRECTED**.

**Reconciled later the same day (2026-09-23, afternoon)** against the full
source chat transcript this handoff was generated from. That transcript
continued past this doc's own creation: a Remarks feature and `updated_at`
tracking were designed and built (§0 items 12–13), an earlier-agreed
feature roadmap turned out to be missing from §10 entirely (now restored),
and a still-open, unanswered request about `/projects/:id` layout width
was in flight when the transcript was exported. See the new §0 items and
§10 for what changed.

Confidence labels:
- **CONFIRMED** — verified in code, the live DB dump, or direct testing
- **INFERENCE** — reasonable but not explicitly stated
- **UNKNOWN** — genuinely undetermined
- **⚠️ DRIFT** — older docs said one thing, uploaded code/DB shows another
- **✅ CORRECTED** — a specific claim in the earlier docs has now been disproven

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
   docs speculated it would need. See §4/§7 for the full correction.
3. **`project_instances.title` column confirmed live** — the migration from
   `pending-issues.md` Resolved Item #3 was in fact run.
4. **`beneficiaries.latitude`/`longitude` confirmed live**, matching `map-itinerary.md`.
5. **All enum values confirmed to match the code exactly** — including
   `'In-house'` spelled identically in both the `project_category` and
   `document_applies_to` enums.
6. **Only 1 of 5 live projects had a generated document checklist as of the
   dump** (id=4). Projects 2, 3, 5, 6 had `project_category` set but zero
   `documents` rows. **Status: still the standing action item** — see §10.
7. **No evidence of cascading data loss** beyond `document_types` itself —
   the FK from `documents.document_type_id → document_types.id` has no
   cascade rule (default `NO ACTION`).
8. **✅ `App.jsx` supplied and read directly.** This resolves the prior
   routing "⚠️ DRIFT (unresolved)" note: `/map` and `/itinerary` **are**
   both registered and reachable — the app just didn't have any uploaded
   copy of `App.jsx` to confirm this before now. See §3.
9. **✅ `project_contacts`/`ProjectContacts.jsx` smoke-tested successfully
   by Rat** — Contacts page works fine, and contacts can be added to
   projects. §7 item 1's "never proven to actually work" caveat is now
   resolved: this feature is confirmed working end-to-end, not just
   schema-matching.
10. **Dedicated `/projects/:id` page shipped** — see §10 for what changed
    from the originally-planned full `EditPanel` replacement to the hybrid
    approach actually built, and §8 for the superseded "beneficiary
    immutable" decision.
11. **New known gap identified (not yet fixed):** the Beneficiaries page has
    no delete UI at all — `useBeneficiaries.deleteBeneficiary()` exists and
    already has the FK delete-guard built in, but nothing in
    `Beneficiaries.jsx` calls it. Contacts has a working delete; Beneficiaries
    does not. Queued as the next minor fix — see §10.
12. **✅ Remarks feature built (this same day, after this doc was first
    drafted).** Brainstormed as "remarks vs. full audit trail" — user chose
    **Option A+B**: manual remarks (the existing, previously-unused
    `remarks` table) plus lightweight `updated_at` timestamps on
    `documents`/`beneficiaries`, explicitly **not** a full audit-log
    (Option C was considered and rejected as overkill for a 2–3 person
    internal tool with no real compliance "weight"). Landed on **append-only
    remarks with a 15-minute post-only delete window** (typo/mis-click
    insurance only) instead of editing; corrections after that window are
    posted as a new remark, not a silent rewrite. Attribution (`added_by`)
    uses a `localStorage`-remembered free-text name per browser ("posted as
    X · not you?"), not real auth — auth was reaffirmed as intentionally
    deferred, not an oversight, given the small trusted user base. See §4,
    §6, §8, §10 for full detail. **Not yet confirmed run/tested against the
    live database** — the SQL migration and files were handed to the user
    to apply; no confirmation of execution appears in the transcript.
13. **⚠️ DRIFT — §10 Pending Work was missing an entire agreed roadmap.**
    A Sep 7 planning session (embedded verbatim in the source transcript)
    had already sequenced: **Excel import (top priority) → Remarks UI →
    raw Excel export → heatmap → responsiveness/mobile pass → report
    template filling.** None of this appeared in this doc's §10 before now.
    Heatmap is done (lat/lng columns, confirmed live in §4). Remarks is
    done (item 12 above, pending live confirmation). **Excel import — the
    stated top priority — has no evidence of ever being started**: no
    upload, no generated transformation, no mention of it resuming since
    Sep 7. Excel export, responsiveness pass, and report template filling
    are all still unstarted. Restored to §10 below; worth asking the user
    directly whether Excel import is still wanted or was deprioritized in
    favor of the `/projects/:id` and Remarks work that happened instead.
14. **New, unresolved as of the end of the transcript:** user asked whether
    `/projects/:id` (`ProjectDetail.jsx`) should use a wider/larger layout
    — current version "wastes a lot of space on the sides" for what's
    supposed to be a close-up single-project view. Claude had started
    investigating (`bash_tool` call) but the transcript ends before any
    proposal or change was made. **Genuinely open — pick this up first.**

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
Technology Office, RPMO = Regional Project Monitoring Office (names specific
to DOST's regional structure). Deployed technologies seen in live data:
Portasol solar dryers, Solar-Powered Pump w/ Drip Irrigation, Sambong
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
| `/overview` | `overview/Overview.jsx` | Projects grouped by year, cards w/ per-phase progress — clicking a card now navigates straight to `/projects/:id` |
| `/projects` | `projects/Projects.jsx` | Full project CRUD table |
| `/projects/:id` | `projects/ProjectDetail.jsx` | **NEW.** Dedicated full-page project view/edit — see §10 for what it covers and why `EditPanel` still exists alongside it |
| `/documents` | `documents/Documents.jsx` | Project × document-type pivot table |
| `/beneficiaries` | `beneficiaries/Beneficiaries.jsx` | Beneficiary CRUD — **has no delete UI yet**, see §7/§10 |
| `/contacts` | `contacts/Contacts.jsx` | Contact CRUD |
| `/map` | `map/Map.jsx` | Leaflet map, pin beneficiaries, filter by doc compliance |
| `/itinerary` | `itinerary/Itinerary.jsx` | Build/save ordered visit itineraries |

**✅ CORRECTED — routing drift resolved.** `App.jsx` has now been supplied
and read directly: `/map` and `/itinerary` are both registered
(`createBrowserRouter`, both under the same `Layout` element as everything
else) and reachable. The earlier "unresolved DRIFT" note about `Navbar.jsx`
linking to routes that might not exist is no longer applicable.

**Deep-linking**: `?edit=<id>` on `/projects` and `/beneficiaries` — opens
the record's edit UI (`EditPanel`) on load, then clears the param. Used by
Dashboard's overdue/upcoming rows and (formerly) `EditPanel`'s beneficiary
link. **Still open, unresolved**: whether `?edit=<id>` should eventually
redirect to `/projects/:id` instead of opening `EditPanel` — see §10. As of
this update it is **unchanged**: still opens `EditPanel`, since `EditPanel`
was retained rather than retired (see §10). Dashboard's geographic-hotspot
links to `/documents?municipality=...&submitted=No` — `Documents.jsx` does
not read these params; unconfirmed if aspirational or broken.

**Import inconsistency**: most files use `'react-router'`, `Navbar.jsx` uses
`'react-router-dom'`. Both work under v7 but aren't consistent.
`ProjectDetail.jsx` was added using `'react-router'` for consistency with
the majority.

### Key lib/utility files

- **`src/lib/supabase.js`** — the one Supabase client. No `supabase.auth.*` calls anywhere.
- **`src/lib/documentStatus.js`** — `getDocStatus(doc)`, `statusRank(doc)`, `isOverdue(doc)`, `isUpcoming(doc, days=14)`, `DOC_CONDITIONS`. **Must stay in sync with `documentProgress.js`'s duplicate completeness check.**
- **`src/lib/documentProgress.js`** — `computeProgress(documents)`, `progressBarColor(pct)`, `PHASE_ORDER`.
- **`src/lib/geo.js`** — `haversineDistanceKm`, `estimateMinutes` (crude, ~30km/h assumption), `nearestNeighborOrder` (greedy, not true TSP), `totalRouteDistanceKm`, `legDistances`.
- **`src/lib/officeLocation.js`** — `OFFICE_LOCATION = { latitude: 15.179, longitude: 119.980 }` — a real coordinate, not the `null` placeholder the original `itinerary.md` described.
- **`src/lib/beneficiaryFilters.js`** — shared filter predicate for Map + Itinerary; not yet wired into `Map.jsx` (still has its own inline copy) — optional future de-dup.
- **`src/lib/Leafleticon.js`** — fixes Leaflet's default marker icon under Vite's asset bundling. *(Filename casing note: referred to as `leafletIcon.js` in `map-itinerary.md` — verify actual on-disk casing.)*

### Hooks (`src/hooks/`)

All follow `{ data, loading, error, refetch, mutations... }`.

| Hook | Table(s) | Notes |
|---|---|---|
| `useProjects` | `project_instances` (+joins) | Full CRUD; now also consumed directly by `ProjectDetail.jsx` |
| `useBeneficiaries` | `beneficiaries` (+project count) | Full CRUD; delete-guard (0 linked projects). `updateBeneficiary` now also used by `ProjectDetail.jsx`'s editable Beneficiary section. **`deleteBeneficiary` exists but has no UI caller anywhere** — see §7/§10 |
| `useContacts` | `beneficiary_contacts` (+beneficiary join) | Full CRUD |
| `useBeneficiaryContacts` | `beneficiary_contacts` | Read-only, scoped to one beneficiary (picker) |
| `useProjectContacts` | `project_contacts` | **✅ CONFIRMED working end-to-end** (not just schema-matching) — Rat smoke-tested adding contacts to a project successfully |
| `useDocuments` | `documents` (+document_types join) | Scoped to one project; `generateDocuments()`. Reused as-is by `ProjectDetail.jsx` via `DocumentChecklist.jsx` |
| `useAllDocuments` | `documents` (+joins) | Global; Dashboard + Documents page + Overview's progress bars |
| `useDocumentTypes` | `document_types` | Read-only |
| `useFormData` | `project_types`, `beneficiaries` | Dropdown lookups + inline creation; used by both `EditPanel.jsx` and `ProjectDetail.jsx` |
| `useBeneficiaryLocations` | `beneficiaries` (+lat/lng+count) | Map feature |
| `useItineraries` | `itineraries`, `itinerary_stops` | `saveStops()` **not transactional** (delete-then-insert, 2 calls) |
| `useMergedBeneficiaries` | (composed) | Factored out of Map.jsx's merge logic; Map.jsx itself still uses its own inline version |
| `useColumnSizing` | — | Persists TanStack `columnSizing` to localStorage. Still only used by the table pages (Projects/Beneficiaries/Contacts) — **not** by `ProjectDetail.jsx`, which is a plain page, not a resizable table |

### Components not in original docs
- `src/components/common/ResizableTh.jsx` — resizable/sortable `<th>` with
  drag handle, used by Projects/Beneficiaries/Contacts tables.
- `src/pages/projects/DocumentChecklist.jsx` and
  `src/pages/projects/ProjectContacts.jsx` — both pre-existed but weren't in
  the original doc set's Key Files table; both are pure `{ project }`-prop
  components with no dependency on `EditPanel`, which is exactly why they
  could be reused unchanged inside the new `ProjectDetail.jsx` (§10).

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
`latitude numeric(9,6)`, `longitude numeric(9,6)` — both nullable, CONFIRMED live.
Now also editable from within `ProjectDetail.jsx` (name/category/district/
municipality/barangay) via `useBeneficiaries.updateBeneficiary` — see §8/§10.
**⚠️ Not yet re-verified live:** a same-day migration (§0 item 12) adds
`updated_at timestamptz NOT NULL DEFAULT now()` plus a `BEFORE UPDATE`
trigger (`set_updated_at()`) that self-stamps it on every row change — this
was generated and handed to the user to run in the Supabase SQL editor;
no confirmation it was actually executed appears in the transcript.
Nothing in the UI displays this value yet (open question — see §10).

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
bool, `gdrive_link`, `is_not_applicable` bool. **⚠️ Not yet re-verified live:**
same same-day migration as `beneficiaries` above adds a self-stamping
`updated_at` column here too (§0 item 12) — generated, not confirmed run.

**`project_contacts`** — ✅ **EXISTS LIVE, and confirmed working via manual
smoke test (this update).** Schema:
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
Matches `useProjectContacts.js`'s queries field-for-field, and is now
confirmed actually used successfully (Rat added a contact to a project via
the UI without issue).

**`project_instances`** — `id` PK, `year` smallint NOT NULL, `project_type_id`
FK → project_types (no cascade), `beneficiary_id` FK → beneficiaries (no
cascade — app enforces delete-guard client-side), `property_number`,
`amount` numeric(12,2), `date_deployed`, `entry_point` varchar (free text),
`intervention` text, demographic counts (default 0), `operational_status`
enum nullable, `interventions_count`, `people_trained` (default 0),
`impact_notes` text, `overall_status` enum NOT NULL default `'For
Deployment'`, `gdrive_folder_link`, `created_at`/`updated_at` timestamptz
default now(), `project_category` enum nullable, `title varchar(255)` —
CONFIRMED live, the migration from `pending-issues.md` was run.

**`project_types`** — `id` PK, `name` varchar(100) UNIQUE. Live data: Solar
IMTA, Portasol, Samahang Ayta ng Pasambot, Sambong Processing Facility,
Solar-Powered Pump w/ Drip Irrigation.

**`remarks`** — `id` PK, `project_id` FK CASCADE, `level` enum NOT NULL,
`content` text NOT NULL, `added_by` free text, `created_at`. Schema
unchanged, but **⚠️ DRIFT from earlier in this same doc**: no longer
accurately described as "unused" — a full Remarks UI was built the same
day (§0 item 12) on `/projects/:id` (`RemarksSection.jsx` + `useRemarks.js`
hook): `level` (provincial/regional/pcest/rcest) is a dropdown for *which
office the remark concerns*, `added_by` is free text remembered via
`localStorage` per browser (no real auth). Reads/writes: `fetchRemarks`,
`addRemark`, and `deleteRemark` (delete only works client-side within a
15-minute post window enforced in the UI, not a DB constraint — after that
the row is permanent; corrections are posted as new remarks, never edits).
0 rows at the last live dump still stands as the last *verified* count —
the feature's actual first use in production is unconfirmed in the
transcript.

**`itineraries`** / **`itinerary_stops`** — schema as documented in
`map-itinerary.md`, 0 rows live — feature built but not yet used in
production, or was wiped along with `document_types` (can't distinguish
from the dump alone; worth asking whether any itineraries were ever
actually saved before the incident).

### Row Level Security
Unchanged from before: every table (including the newer ones) has an
"allow all" policy granting `anon` full read/write. Real-world access
control is currently none. **Explicitly deprioritized by Rat** — the app's
link is only known to him, so this isn't currently treated as a live risk;
not to be re-raised unprompted.

### ⚠️ Live data snapshot (as of the original dump — not re-verified this update)
- 5 `project_types`, 6 `beneficiaries` (ids 1–6, though only 2–6 appear in
  `project_instances`), 5 `project_instances` (ids 2–6, all `project_category
  = 'In-house'`), **43 `document_types`** (restored), **only 1 project
  (id=4) has any `documents` rows** (27 of them) — see §10 for the action
  this implies, `remarks` / `itineraries` / `itinerary_stops` all empty.
  `project_contacts` was empty at dump time but has since been used at
  least once per the smoke test.

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
original docs; core logic files (`documentStatus.js`, `documentProgress.js`,
`useDocuments.js`, `editPanel.jsx`, `useBeneficiaries.js`) are unchanged
except where noted above.

---

## 5a. `document_types` — Full Restored Dataset (43 rows)

This is the actual, complete, official CEST document-compliance checklist —
recovered from a real backup after an accidental deletion. Treat this table
as the canonical reference.

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
- Only `id=6` (Project Proposal) and `ids 10–11` (Certificate, Resolution) are `is_default=false` among the "Both"/"In-house" Pre-Implementation set — everything else defaults true, though `is_default` itself is still not read by any frontend code (UNKNOWN purpose, unchanged from before).
- If `document_types` ever needs re-seeding again, the SQL to do it is a straightforward `INSERT` built directly from this table — ask if that's needed.

---

## 6. Key Files Guide

### Central / high-blast-radius (understand before editing)

| File | Why |
|---|---|
| `src/pages/projects/editPanel.jsx` | Shared "view/edit project" slide-over. **Retained** — see §10 — now used only by `Projects.jsx` for quick single-field edits; `Overview.jsx` no longer opens it. Its resizable-panel/`editPanelWidth` localStorage mechanics are untouched and still functional. |
| `src/pages/projects/ProjectDetail.jsx` | Full-page `/projects/:id` view — Project Info, editable Beneficiary, Contacts, Status, Impact, Links, Document Checklist, **Remarks (new, §0 item 12)**, Danger Zone. Reuses `DocumentChecklist.jsx`, `ProjectContacts.jsx`, and now `RemarksSection.jsx` unchanged/as-imported; adds its own Beneficiary-edit form via `useBeneficiaries.updateBeneficiary`. No resizable-panel mechanics (plain page, not an overlay). **Open ask (§0 item 14, unresolved):** user wants this page's content wider/larger — current layout "wastes a lot of space on the sides" for what's meant to be the close-up single-project view. |
| `src/pages/projects/DocumentChecklist.jsx` | Pure `{ project, onChanged? }` component — phase-grouped document rows, generate/sync checklist button. Shared by `editPanel.jsx` and `ProjectDetail.jsx`. |
| `src/pages/projects/ProjectContacts.jsx` | Pure `{ project }` component — link/unlink contacts to a project from that beneficiary's existing contact list. Shared by `editPanel.jsx` and `ProjectDetail.jsx`. |
| `src/pages/projects/RemarksSection.jsx` | **NEW (§0 item 12).** `{ projectId }` component — compose box (level dropdown + free-text author + textarea) and an append-only, newest-first feed. Each row shows a level badge, author, timestamp, and (for 15 minutes post-creation only) a confirm-to-delete affordance; a 30-second re-render tick makes the delete option disappear on its own once the window closes, no page refresh needed. Must be named `.jsx`, not `.js` — an earlier `.js` filename broke Vite's JSX transform. Used only by `ProjectDetail.jsx`. |
| `src/hooks/useRemarks.js` | **NEW (§0 item 12).** `{ remarks, loading, error, addRemark, deleteRemark, refetch }` for one project's `remarks` rows. `deleteRemark` has no server-side time guard — the 15-minute window is enforced entirely in `RemarksSection.jsx`; calling it directly from elsewhere would bypass that. |
| `src/lib/localAuthor.js` | **NEW (§0 item 12).** Tiny `getSavedAuthor()`/`saveAuthor(name)` wrapper around `localStorage` (key `cest_remark_author`), wrapped in try/catch so posting still works (just doesn't persist the name) if storage is unavailable, e.g. private browsing. |
| `src/lib/documentStatus.js` | Defines complete/overdue/upcoming. **Must sync with `documentProgress.js`.** |
| `src/lib/documentProgress.js` | Computes every progress % in the app. |
| `src/lib/supabase.js` | The one client every hook depends on. |
| `src/hooks/useDocuments.js` | `generateDocuments()` — the document-gen rule engine. Verified working correctly — the earlier "Generate Checklist" failure was 100% a data problem (empty `document_types`), not a code bug. |
| `src/pages/projects/columns.jsx` | `ALL_COLUMNS`, `DEFAULT_VISIBLE`, `FILTERABLE_COLUMN_IDS`, `STATIC_OPTIONS` — the live one, not `documents/columns.jsx`. Now also has a `detail_link` action column (`↗`) linking each row to `/projects/:id`. |

### Duplicate / orphaned files (unchanged, verify on-disk before editing)
- `components/common/PaginationBar.jsx` vs `projects/paginationBar.jsx`
- `components/common/VisibilityPanel.jsx` vs `projects/visibilityPanel.jsx`
- `projects/columns.jsx` (live) vs `documents/columns.jsx` (likely dead code)
- `projects/filterBar.jsx` vs `documents/filterBar.jsx` — **not duplicates**, genuinely different components sharing a filename

---

## 7. Known Warnings / Issues

1. ~~`useProjectContacts.js` queries a non-existent table~~ **✅ FULLY
   RESOLVED.** The table exists live with the exact expected schema (§4)
   **and** has now been smoke-tested successfully by Rat — adding a
   contact to a project via the UI works. No longer a caveat of any kind.
2. **RLS is effectively disabled** on every table, including the newer ones. Documented as a finding, not fixed. Explicitly deprioritized by Rat.
3. **No authentication UI anywhere.**
4. **Document generation is additive-only.** Category change never removes stale `documents` rows.
5. **Duplicate/orphaned files** — see §6.
6. **Router import inconsistency** — `'react-router'` vs `'react-router-dom'`.
7. **`documentStatus.js`/`documentProgress.js` duplicate "complete" logic** — keep in sync.
8. **Never commit real Supabase credentials.** *(A placeholder password was pasted into this chat during debugging — confirmed by the user to be a fake/example value, not the real one, but worth being generally careful about this going forward.)*
9. **`useItineraries.saveStops()` not transactional** — delete-then-insert, two calls.
10. **One itinerary = one saved "day"** — no day-grouping column, by design.
11. **`CATEGORY_COLORS` declared but unused in `Map.jsx`** — default markers only.
12. **Only 1 of 5 live projects has a generated document checklist (as of the dump).** Projects 2, 3, 5, 6 all have `project_category = 'In-house'` set but zero `documents` rows. Still the standing action item — see §10.
13. **`documents.document_type_id` FK has no cascade rule** (default `NO ACTION`) — cannot delete a `document_types` row while any `documents` row still references it. Edit/deactivate rows instead of deleting them.
14. **NEW: Beneficiaries page has no delete function in the UI.** `useBeneficiaries.deleteBeneficiary()` already exists, already has the same FK-violation delete-guard reasoning as the rest of the hook (blocks deletion while linked projects exist) — the gap is purely that `Beneficiaries.jsx`/its columns never call it. Contacts already has a working delete for comparison. **Queued as the next minor fix** — see §10.

---

## 8. Design Decisions & Rationale

(Unchanged from original docs except where noted.)

- **No global state library** — INFERENCE, deliberate simplicity.
- **Manual sticky columns in `Documents.jsx`** — CONFIRMED by code comment.
- **Dynamic pivot columns in `Documents.jsx` vs static in `Projects.jsx`** — INFERENCE.
- **Duplicated color maps across files** — INFERENCE, real maintenance risk.
- **Document generation additive-only** — CONFIRMED, deliberate safety choice.
- **Optional document types default to N/A** — CONFIRMED; concrete example is `document_types` id 15/20, "Monitoring Form" (§5a).
- **~~Beneficiary immutable after project creation~~ — ✅ SUPERSEDED (this
  update).** Originally CONFIRMED by UI copy ("A project's beneficiary is
  fixed at creation and isn't reassigned here"). `ProjectDetail.jsx` now
  lets that beneficiary's own fields (name/category/district/municipality/
  barangay) be edited in place. **Scope note:** this only means the
  beneficiary *row's data* is editable from within a project — it does
  **not** mean a project can be reassigned to point at a *different*
  beneficiary; `beneficiary_id` reassignment was never built and wasn't
  part of what was decided. Editing here updates that beneficiary
  everywhere it's referenced (shared across every project under it, per
  the next bullet), which `ProjectDetail.jsx` surfaces as an inline note.
  `editPanel.jsx`'s Beneficiary section is unchanged (still the old
  read-only summary + link out) since `EditPanel` itself wasn't rebuilt.
- **Deep-link `?edit=<id>`** — INFERENCE. Still targets `EditPanel`,
  unaffected by this update since `EditPanel` was retained rather than
  retired. Whether it should eventually point at `/projects/:id` instead
  is still an open, undecided question — see §10.
- **RLS "allow all" alongside narrower policies** — INFERENCE, likely leftover dev setup.
- **No schema-validation library** — INFERENCE, reasonable for current form complexity.
- **Coordinates on `beneficiaries`, not `project_instances`** — one physical place, shared by every project under it. This is exactly why editing Beneficiary info from `ProjectDetail.jsx` is a shared-record edit, not a per-project one.
- **Itinerary nearest-neighbor, not true TSP** — deliberate, agreed unnecessary at this scale.
- **NEW — `/projects/:id` is additive, not a full `EditPanel` replacement.**
  The original plan (see prior version of this doc) was for `/projects/:id`
  to fully replace the `EditPanel` overlay everywhere. After discussion,
  Rat opted for a hybrid instead: `EditPanel` survives as the fast quick-edit
  tool for the `Projects.jsx` table (status flips, single-field corrections),
  while `Overview.jsx` — a browsing/status view by nature — always opens the
  full `/projects/:id` page. `Projects.jsx` gets a small `↗` action column
  (`columns.jsx`) as an explicit escape hatch into the full page when
  someone needs the deeper sections (editable Beneficiary, Contacts,
  Impact, Links, Danger Zone) that don't fit well in the sidebar's width.
  `Documents.jsx` was **not** changed — it keeps its own inline
  document-row editing and was not wired to either `EditPanel` or
  `/projects/:id` as part of this change.
- **NEW — Remarks over a full audit trail (§0 item 12).** Three options were
  laid out: (A) manual remarks only, (B) remarks + `updated_at` timestamps,
  (C) a generic field-level `audit_log` with triggers and a diff UI. User
  picked **A+B**, explicitly rejecting C as unnecessary infrastructure for
  a personal/2-3-person tool with "no real weight" — a considered no, not
  a deferral. Within that: **15-minute post-only delete window, no
  editing, correction-via-new-remark** was chosen over an always-editable
  "(edited)" tag, on the reasoning that "editable until someone else
  posts" is an arbitrary trigger unrelated to whether an edit is
  reasonable, and that silent rewrites undermine remarks' value as a
  history. `level` (provincial/regional/pcest/rcest) was clarified as
  *which office the remark concerns*, separate from *who wrote it*
  (`added_by`).
- **NEW — Auth still deferred, reaffirmed intentional (§0 item 12).** For
  attributing remarks without building real auth, a `localStorage`-backed
  free-text "posted as" name (per browser, not per account) was chosen
  over a hardcoded name dropdown, for flexibility if the team changes.
  Real Supabase Auth was confirmed mechanically easy to add later
  (`auth.users` + swap RLS from "allow all" to `auth.uid()`-keyed
  policies) but not worth it yet at this scale — deferring it originally
  was reaffirmed as the right call for a personal tool for 2-3 known,
  trusted people, not something done wrong that needs correcting now.

---

## 9. Feature: Map + Itinerary — Current State

Unchanged from the prior version of this handoff — see original detail. Key
point reconfirmed by the live dump: `itineraries`/`itinerary_stops` both
have 0 rows, so either the feature has genuinely never been used to save a
real itinerary yet, or any saved itineraries were lost in the same incident
that emptied `document_types`. Worth asking the user directly whether they
ever successfully saved one, to know whether this is expected-empty or also
needs recovery.

Still open:
1. Whether to load previously-saved itineraries via something more than the current top dropdown.
2. Whether to wire `CATEGORY_COLORS` into custom map markers.
3. ~~Confirm `/map` and `/itinerary` are reachable~~ — ✅ **RESOLVED.**
   `App.jsx` confirms both routes exist and are reachable.

---

## 10. Pending Work — What To Build Next, In Order

### ✅ Done since the last version of this doc
- Got `src/App.jsx` — routing for `/map`/`/itinerary` confirmed reachable (§3/§9).
- Smoke-tested `ProjectContacts.jsx` — confirmed working end-to-end (§4/§7).
- **Shipped the dedicated `/projects/:id` page** (`ProjectDetail.jsx`), as a
  hybrid alongside `EditPanel` rather than a full replacement — see §8 for
  the reasoning and exact scope, §6 for the file, §3 for the route.
- **Built the Remarks feature + `updated_at` tracking** (§0 item 12, §4,
  §6, §8) — `remarks` table now has a real UI on `/projects/:id`;
  `documents`/`beneficiaries` get a self-stamping `updated_at` column via
  a generated (not yet confirmed run) SQL migration. Full audit trail
  explicitly rejected as overkill.
- **Heatmap groundwork** — `beneficiaries.latitude`/`longitude` exist and
  are wired into the Map feature (this was item 4 of the Sep 7 roadmap
  below; confirmed done via the live dump in §4).

### ⚠️ Restored — the Sep 7 roadmap, missing from every version of this doc until now
A planning session on 2026-09-07 (found verbatim in the source transcript,
never previously folded into this handoff) sequenced a larger set of asks:

**Excel import → Remarks UI → raw Excel export → heatmap → responsiveness/
mobile pass → report template filling**

Reconciled against what's actually happened since:
1. **Excel import (originally the agreed TOP PRIORITY) — no evidence it
   was ever started.** Plan was: user uploads the real messy legacy
   multi-year Excel sheet, Claude reads it with the xlsx skill, maps old
   columns to the normalized schema, and generates a review-able CSV/SQL
   transformation (nothing auto-runs against live Supabase). Nothing in
   the transcript after Sep 7 shows this resuming — nor does the live dump
   look like a bulk import happened (only 5 projects, 6 beneficiaries).
   **Ask the user directly whether this is still wanted or was
   deprioritized** in favor of the `/projects/:id` and Remarks work that
   happened instead.
2. Remarks UI — ✅ done (see above), though "simple feed inside `EditPanel`"
   from the original Sep 7 plan became a `ProjectDetail.jsx` section
   instead once `/projects/:id` existed; the "recent remarks across all
   projects" Dashboard section from that plan was **not** built.
3. **Raw Excel export** (data as currently in the app) — not started.
4. Heatmap — ✅ done (lat/lng on `beneficiaries`, Map feature live).
5. **Responsiveness / mobile pass** — not started. Original plan: tables
   collapse to card lists below a breakpoint, `EditPanel` becomes a
   full-screen modal on small screens. Directly relevant to the open
   `/projects/:id` width question below — may be worth tackling together
   rather than as two separate passes.
6. **Report template filling** — not started; depends on the user's
   existing report templates (never uploaded) and real, stable data —
   sequenced last for a reason, doubly so with Excel import still undone.

### Immediate (do next)
1. **Open, unresolved as of the end of the transcript:** decide whether
   `/projects/:id` should be wider/use more of the screen — user flagged
   the current layout as wasting space on the sides for what's meant to be
   a close-up single-project view. Claude had only just started looking
   into this when the transcript cuts off. **Pick this up first** — it's
   a live, half-answered question, not a queued backlog item.
2. **Implement a delete function on the Beneficiaries page.** `useBeneficiaries.deleteBeneficiary()` already exists with its FK delete-guard reasoning built in — this is purely a UI wire-up, following the same pattern Contacts already uses for its working delete button. (§7 item 14)
3. Regenerate document checklists for the 4 projects that still don't have one (ids 2, 3, 5, 6) — `document_types` has been restored, this should now work correctly via the Generate Checklist button.
4. **Confirm the `updated_at` SQL migration was actually run** in Supabase (§0 item 12, §4) — it was handed to the user, not confirmed executed.
5. **Decide where `updated_at` should be surfaced in the UI** — it's tracked in the DB now but displayed nowhere (a tooltip per document row? a line under Beneficiary info? under Remarks?). Flagged as an open question when the migration was generated and never answered.

### Then: small unresolved decisions
- Decide the fate of `?edit=<id>` on `/projects`: leave it opening `EditPanel` permanently (now a real, intentional design decision rather than a stopgap, since `EditPanel` is staying), or redirect it to `/projects/:id` for Dashboard's overdue/upcoming links specifically. Not urgent — current behavior is not broken, just worth a deliberate answer rather than leaving it implicit.
- Re-confirm priority order given the restored Sep 7 roadmap above — Excel import in particular was the stated top priority and appears to have been quietly superseded; worth an explicit decision rather than leaving it implicit too.

### Lower priority / opportunistic
- Decide on saved-itinerary browsing beyond the current dropdown.
- Decide on `CATEGORY_COLORS` wiring for map markers.
- Housekeeping: dedupe `PaginationBar`/`VisibilityPanel`, remove dead `documents/columns.jsx`, normalize router imports (`ProjectDetail.jsx` already follows the majority `'react-router'` convention).
- Confirm whether any itineraries were lost (§9) and whether they need reconstruction like `document_types` did.
- Consider whether `Documents.jsx` should also get a link into `/projects/:id` for cases where someone needs more than the document pivot while triaging — not requested, purely opportunistic.
- A "recent remarks across all projects" Dashboard section (from the original Sep 7 Remarks plan) — not built when Remarks shipped; still opportunistic, not requested since.

---

## 11. Files Present in Code But Not Covered by Any Original Doc

- **`src/hooks/useColumnSizing.js`** — persists TanStack `columnSizing` to localStorage; used by Projects/Beneficiaries/Contacts tables (not `ProjectDetail.jsx`, which is a plain page).
- **`src/components/common/ResizableTh.jsx`** — resizable/sortable `<th>` with drag handle; used across all three tables.
- **`src/pages/projects/ProjectDetail.jsx`** — new this update, now covered in §6.

Both of the first two are real, working, actively-imported code from a build
session that happened after the original doc set was last refreshed.

---

## 12. Source Doc Inventory

| File | Status |
|---|---|
| `claude.md`, `architecture.md`, `decisions.md` | Authoritative for what they cover; database specifics superseded by §4 above where they conflict; the `/projects/:id` decision in §8 supersedes any earlier "full EditPanel replacement" framing in `decisions.md` |
| `database.md` | **Superseded by §4 of this document** — the live dump is more current, most notably on `project_contacts` |
| `business-rules.md` / `business rules.md` (space) | Authoritative, unchanged |
| `important-files.md` (hyphenated) | Referenced by other docs as canonical but never supplied in any upload — only the legacy `importantFiles.md` was available; reconcile if the hyphenated version turns up |
| `pending-issues.md` | Phase 1&2 done and DB-verified done (title column, entry point); Phase 3 (`/projects/:id`) is now also done, in hybrid form — see §8/§10 |
| `itinerary.md`, `map-itinerary.md` | Superseded on the `OFFICE_LOCATION`, empty-itineraries-table, and routing-reachability points by §3/§9 above |

---

*End of master handoff. Load this single file into a new session instead of
the original doc set — it incorporates everything from them, direct
verification against a live database dump, the changes made in the
session that produced this doc, and a same-day reconciliation pass against
the full source transcript (Remarks + `updated_at` built, the Sep 7
roadmap restored, and one still-open question about `/projects/:id`
layout width).*
