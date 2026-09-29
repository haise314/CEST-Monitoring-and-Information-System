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

**Reconciled a second time (2026-09-23, later that afternoon/evening)**
against two more finished pieces of work from the same day: the
`/projects/:id` width question was resolved (two-column layout shipped),
and the Map feature was fully overhauled from an itinerary-focused tool
into a portfolio-wide status/category visualization, with the old
`/itinerary` page folded into `/map` as a second tab rather than kept
separate. See §0 items 15–16 for the summary and §3/§6/§8/§9/§10 for
full detail.

**Reconciled a third time (2026-09-23, evening)** — real Supabase Auth
was built and the RLS "allow all" hole (previously documented as
"effectively disabled, deprioritized") was actually closed, not just
flagged. See §0 item 17 for the full account, including a same-day
incident where the RLS migration was run before accounts/frontend were
in place, causing brief lockout — resolved, not data loss. **Confirmed
working on localhost only** as of this pass; production (Vercel) not yet
verified — see §10.

**Fifth update (2026-09-29, later):** app shell rebuilt with a sidebar,
top bar, and light/dark theme — see §0 item 20.

**Reconciled a fourth time (2026-09-29)** — the Dashboard was already
substantially rebuilt (Recent Activity, Recently Updated, charts, budget
rollup, KPIs, quick actions) but none of that was in this doc; this pass
documents it and covers the centering fix + visual polish. See §0 items
18–19 and §3a.

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
14. ~~**New, unresolved as of the end of the transcript:** user asked
    whether `/projects/:id` (`ProjectDetail.jsx`) should use a
    wider/larger layout~~ — **✅ RESOLVED, see item 15.**
15. **✅ `/projects/:id` widened and restructured into two columns.**
    Container went from `max-w-3xl` (768px) to `max-w-6xl` (1152px).
    Above `lg`, the page splits into a left column (2/3 width: Project
    Info + Beneficiary — the two field-heaviest sections) and a right
    rail (1/3 width: Status, Impact, Links, Contacts — lighter sections
    that read fine narrower). Document Checklist and Remarks stay
    full-width below the grid rather than sitting in a column, since
    both are list-heavy (up to 43 document rows; a growing remarks
    feed). Danger Zone, the save bar, and both banner types are
    unchanged, full-width, at the bottom. Below `lg` it collapses back
    to a single column, so mobile/narrow is unaffected. Form state,
    save logic, and `Field`/`Section` internals were not touched — this
    was purely an outer-layout change. One known follow-up, not yet
    acted on: the Impact section's two number inputs (`grid-cols-2`)
    are now in the narrower right rail, so they may read as tight on
    medium screens — flagged for the user to eyeball, not yet changed.
16. **✅ Map feature overhauled — from itinerary-focused to
    portfolio-status-focused.** Previously `/map` was a manual
    pin-placement + compliance-filter tool with no color-coding, and
    `/itinerary` was a fully separate page (candidate pool + ordered
    stop list, no map at all) for planning visit routes. Both are now
    one page: `/map` gained an **Overview / Plan Visit** tab toggle.
    **Overview** (new default) is the old pin/filter/placement UI plus
    a new **"Color by: Category / Status"** control — `CATEGORY_COLORS`
    (previously dead code, §7 item 11) is finally used, alongside a new
    parallel status→color map; the existing category/status filters now
    dim non-matching pins rather than hiding them, instead of running as
    a separate system from color-coding. Pins were also switched from
    `Map.jsx`'s own inline beneficiary-merge logic to the already-built
    `useMergedBeneficiaries` hook (previously unused by `Map.jsx`
    itself, per §3). **Plan Visit** is the old `Itinerary.jsx` UI
    (`CandidatePool`, `StopList`, name/date, save/delete, `useItineraries`)
    moved in as a tab, behavior unchanged — a deliberate "cheap fold"
    (lists stay lists) rather than rendering planned stops as pins on
    the map, which was considered and explicitly deferred. `App.jsx`'s
    `/itinerary` route now redirects to `/map?mode=plan` so old links
    don't 404; `Navbar.jsx`'s separate "Itinerary" link was removed
    (repointing it at `/map` would've meant two nav items to the same
    place). `Itinerary.jsx` itself is left in the codebase, unrouted and
    unedited — **orphaning is deliberate, not yet cleaned up**, per the
    user's explicit instruction. See §3, §6, §8, §9, §10 for full detail.
17. **✅ Real Supabase Auth built; the RLS "allow all" hole actually
    closed (not just documented as deprioritized).** Prompted by the plan
    to start manually entering real beneficiary/project data — the prior
    "RLS effectively disabled, explicitly deprioritized" note (§7 item 2,
    old) stopped being an acceptable risk once real data was about to go
    in on a publicly reachable Vercel URL with the anon key exposed
    client-side.
    - **What the audit found:** `pg_policies` showed most tables carrying
      three overlapping permissive policies — `"Allow anon read"`,
      `"Allow authenticated users"`, and `"allow all"` (role: `public`).
      Because Postgres's `public` role means *anon + authenticated
      combined* and permissive policies OR together, `"allow all"` alone
      already granted full read/write to anyone with the anon key,
      logged in or not — the other two policies were dead weight, and a
      login screen alone would **not** have fixed this without also
      touching RLS. `itineraries`, `itinerary_stops`, and
      `project_contacts` had *only* the `"allow all"` policy — no
      anon-read or authenticated-only policy existed for them at all.
    - **What was built:** `src/lib/AuthContext.jsx` (session state +
      `signIn`/`signOut` via `supabase.auth`), `src/pages/auth/Login.jsx`
      (email/password form, no self-serve signup — accounts are created
      directly in the Supabase dashboard for the 2-3 known users, not a
      public flow), a `RequireAuth` guard wrapping the existing `Layout`
      in `App.jsx` (redirects to `/login`, preserves the intended
      destination), and a sign-out control + signed-in email display in
      `Navbar.jsx`. A SQL migration dropped every `"allow all"` and
      `"Allow anon read"` policy across all ten tables, and added
      `"Allow authenticated users"` to the three tables that lacked it —
      leaving exactly one policy per table (`authenticated`, `ALL`,
      `true`/`true`) as the sole gate.
    - **Incident, same day:** the SQL migration was run **before** any
      Supabase Auth accounts existed and before the new frontend was
      deployed — briefly locking everyone out, since the live app had no
      login flow to obtain an `authenticated` session with. **No data
      was lost or altered** — RLS only blocks access, it doesn't touch
      rows. Resolved by creating accounts and deploying the frontend
      files. Worth noting as a sequencing lesson for future RLS changes:
      accounts/frontend before the policy migration, not after.
    - **✅ Confirmed working on localhost.** Production (Vercel) not yet
      verified as of this update — see §10.
    - **Known follow-up, not yet done:** Remarks' `added_by` attribution
      still uses the `localStorage`-backed free-text "posted as" name
      (§0 item 12) rather than the now-available real logged-in user
      identity. Redundant now that real auth exists, but intentionally
      not bundled into this change — flagged as a separate, optional
      follow-up in §8/§10.

18. **✅ Dashboard documented (was missing from this handoff).** The code
    already had far more than the old routing-table row described: quick
    actions, KPI row, Overdue/Upcoming lists, **Recent Activity** (the
    "recent remarks across all projects" feed from the Sep 7 plan — see
    §10, now done, backed by new `useAllRemarks.js`), **Recently Updated**
    projects (reads `project_instances.updated_at`), compliance-by-phase
    bars, attention flags, status/year bar charts, budget rollup, and
    overdue-by-municipality hotspots. Full inventory in §3a.
19. **✅ Dashboard centered and polished (2026-09-29).** Root cause of "not
    centered": the page root was `max-w-5xl` with no `mx-auto`, so it hugged
    the left edge of the `<main className="p-6">` wrapper. Fix: root is now
    `max-w-6xl mx-auto w-full` (matches `ProjectDetail.jsx`), with the
    loading/error states wrapped the same way. Polish pass, presentation
    only — no hooks, data logic, or props changed: one shared `Card` surface
    (white, `rounded-xl`, `shadow-sm`) plus `CardBar`/`EmptyNote`
    primitives replacing ~10 hand-copied bordered divs; section headings
    switched from tracked all-caps gray to sentence-case semibold; page
    spacing via one `space-y-5` instead of per-block `mb-5`; `tabular-nums`
    on figures so bars/counts line up; today's date in the header; clearer
    empty-state and flag copy; emoji marked `aria-hidden`. **One behavior
    change:** the hotspot counts were links to
    `/documents?municipality=…&submitted=No`, and the card said "click to
    filter" — but `Documents.jsx` never read those params, so it promised
    something that never happened. Counts are now plain text and the false
    hint was removed (§8). **Not yet eyeballed in a browser** — delivered
    from a code read only.

20. **✅ App shell restructured: sidebar + top bar + light/dark mode
    (2026-09-29).** Replaces the single horizontal `Navbar.jsx`.
    - **Shell** (`src/components/layout/`): `AppLayout.jsx` (rendered by
      `App.jsx`'s `Layout` inside `RequireAuth`; owns sidebar-collapsed state,
      persisted in `localStorage['cest_sidebar_collapsed']`, and mobile-drawer
      state), `Sidebar.jsx` (fixed rail, 240px / 68px collapsed, off-canvas
      drawer below `lg`), `Topbar.jsx` (sticky; breadcrumb, theme toggle,
      avatar menu with email + sign out), `navConfig.jsx` (single source of
      truth for nav groups **Monitor**: Dashboard/Overview/Map and
      **Records**: Projects/Documents/Beneficiaries/Contacts, plus
      `getBreadcrumb()`), `icons.jsx` (inline SVGs, no icon library). To add
      a page to the nav, edit `navConfig.jsx` only.
    - **Theme**: `src/lib/ThemeContext.jsx` (`ThemeProvider`, `useTheme()`;
      `localStorage['cest_theme']` = `light`/`dark`, absent = follow OS)
      wraps everything in `App.jsx`. `src/theme.css` is imported once after
      Tailwind in the main stylesheet. **Dark mode is done by remapping
      Tailwind's CSS color variables under `.dark`, not by `dark:` variants**
      — so all existing pages flip with zero per-file edits. Gray scale and
      the 50–300 / 700–900 shades of every accent color are remapped; the
      400–600 range (buttons, bars, pins) is deliberately untouched. Because
      `text-white` must stay white on buttons, `--color-white` is not
      remapped; `.dark .bg-white` is overridden directly instead. **When
      writing new UI: use the normal gray/color utilities and it themes
      itself; don't hardcode hex colors or use `bg-white/NN` (opacity
      variants bypass the override).**
    - **Leaflet**: `.leaflet-container { isolation: isolate }` keeps map
      panes below the sticky top bar and modals; tiles are inverted in dark
      mode; popups get the dark surface.
    - **`Navbar.jsx` is now orphaned** (no longer imported) — safe to delete.
    - **Not yet eyeballed in a browser.** Likely first-pass tuning: dark
      palette values in `theme.css`; `text-blue-600` (active tabs) is
      unremapped so contrast on dark is modest.

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
| `/login` | `auth/Login.jsx` | **NEW (§0 item 17).** Email/password sign-in; not under `Layout`/`RequireAuth` for obvious reasons. No self-serve signup — accounts are created directly in Supabase's dashboard. |
| `/` | `dashboard/Dashboard.jsx` | Centered `max-w-6xl` page — quick actions, KPIs, overdue/upcoming docs, recent remarks, recently updated projects, compliance, flags, charts, budget, overdue hotspots. See §3a |
| `/overview` | `overview/Overview.jsx` | Projects grouped by year, cards w/ per-phase progress — clicking a card now navigates straight to `/projects/:id` |
| `/projects` | `projects/Projects.jsx` | Full project CRUD table |
| `/projects/:id` | `projects/ProjectDetail.jsx` | **NEW.** Dedicated full-page project view/edit — see §10 for what it covers and why `EditPanel` still exists alongside it |
| `/documents` | `documents/Documents.jsx` | Project × document-type pivot table |
| `/beneficiaries` | `beneficiaries/Beneficiaries.jsx` | Beneficiary CRUD — **has no delete UI yet**, see §7/§10 |
| `/contacts` | `contacts/Contacts.jsx` | Contact CRUD |
| `/map` | `map/Map.jsx` | **Overhauled (§0 item 16).** Two tabs: **Overview** (default) — pin/filter/placement UI, now with a "Color by: Category / Status" toggle that also drives which pins are dimmed vs. highlighted; and **Plan Visit** — the former `Itinerary.jsx` UI (candidate pool + ordered stop list, `useItineraries`), moved in unchanged |
| `/itinerary` | *(redirect only)* | **No longer its own page.** `App.jsx` now renders `<Navigate to="/map?mode=plan" replace />` here, landing on `/map` with Plan Visit pre-selected. `Itinerary.jsx` still exists on disk (imported, unrouted) but nothing renders it directly anymore |

**✅ CORRECTED — routing drift resolved.** `App.jsx` has now been supplied
and read directly: `/map` and `/itinerary` are both registered
(`createBrowserRouter`, both under the same `Layout` element as everything
else) and reachable. The earlier "unresolved DRIFT" note about `Navbar.jsx`
linking to routes that might not exist is no longer applicable.

**Nav update (§0 item 16):** `Navbar.jsx`'s separate "Itinerary" link was
removed rather than repointed at `/map` (which would've meant two links to
the same destination) — Plan Visit is now reachable only via the tab
inside `/map`, not from the top nav directly.

**Auth gate (§0 item 17):** every route except `/login` now sits inside a
`RequireAuth` wrapper around the existing `Layout` in `App.jsx` — no
session means an immediate redirect to `/login` (with the originally
requested path preserved and returned to after sign-in). `Navbar.jsx`
gained a sign-out control and shows the signed-in user's email.

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

### 3a. Dashboard (`src/pages/dashboard/Dashboard.jsx`) — current layout

Single file, no props. Data: `useAllDocuments`, `useProjects`,
`useBeneficiaries` (count only), `useAllRemarks(10)`. Loading gates on
docs/projects/beneficiaries; remarks load independently (its own inline
"Loading activity..." card). Top to bottom, inside one
`max-w-6xl mx-auto space-y-5` column:

1. Header — title + today's date.
2. `QuickActions` — two nav shortcuts (`/projects`, `/beneficiaries`);
   they do **not** open the Add modal (would need `?add=1` support in
   those pages — deliberately out of scope).
3. `KpiRow` — projects, beneficiaries, overall compliance, total deployed (₱).
4. Overdue + Upcoming (14 days) lists — rows link to
   `/projects?edit=<id>` (opens `EditPanel`, not `/projects/:id`; see §10).
5. Recent Activity (latest 10 remarks, links to `/projects/:id`) +
   Recently Updated (8 most recently `updated_at`-stamped projects).
6. Compliance by phase + Needs attention flags (no category / category but
   no checklist / "For Deployment" 30+ days after `date_deployed`).
7. Projects by status + Projects per year (plain-CSS bars, no chart lib).
8. Budget rollup (total, by year, by category).
9. Overdue documents by municipality (top 8; informational only).

Shared primitives at the top of the file: `Card`, `CardBar`, `EmptyNote`,
`SectionHeader`, `KpiCard`, `BarChart`. New sections should use `Card`
rather than hand-rolling a bordered div. Status color map here duplicates
the ones in `Documents.jsx`/`columns.jsx`/`Map.jsx` (known duplication, §8).

### Key lib/utility files

- **`src/lib/supabase.js`** — the one Supabase client. No `supabase.auth.*` calls anywhere.
- **`src/lib/documentStatus.js`** — `getDocStatus(doc)`, `statusRank(doc)`, `isOverdue(doc)`, `isUpcoming(doc, days=14)`, `DOC_CONDITIONS`. **Must stay in sync with `documentProgress.js`'s duplicate completeness check.**
- **`src/lib/documentProgress.js`** — `computeProgress(documents)`, `progressBarColor(pct)`, `PHASE_ORDER`.
- **`src/lib/geo.js`** — `haversineDistanceKm`, `estimateMinutes` (crude, ~30km/h assumption), `nearestNeighborOrder` (greedy, not true TSP), `totalRouteDistanceKm`, `legDistances`.
- **`src/lib/officeLocation.js`** — `OFFICE_LOCATION = { latitude: 15.179, longitude: 119.980 }` — a real coordinate, not the `null` placeholder the original `itinerary.md` described.
- **`src/lib/beneficiaryFilters.js`** — shared filter predicate for Map + Itinerary. **✅ Now actually wired into `Map.jsx`** as part of the §0 item 16 overhaul (`filterBeneficiaries` is imported and used directly) — the old "declared but Map.jsx has its own inline copy" gap is closed.
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
| `useItineraries` | `itineraries`, `itinerary_stops` | `saveStops()` **not transactional** (delete-then-insert, 2 calls). Still used, now by `Map.jsx`'s Plan Visit tab rather than a standalone `Itinerary.jsx` page (§0 item 16) |
| `useMergedBeneficiaries` | (composed) | **✅ Now actually used by `Map.jsx`** (§0 item 16) — the old inline merge logic in `Map.jsx` was replaced with this hook, so Overview and Plan Visit share one data source instead of two separate fetches |
| `useRemarks` | `remarks` | Per-project feed; add + 15-min-window delete. Used by `RemarksSection.jsx` |
| `useAllRemarks` | `remarks` (+project/beneficiary join) | **NEW to this doc.** Read-only, newest `limit` rows across all projects (Dashboard's Recent Activity). No mutations |
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
| `src/pages/projects/ProjectDetail.jsx` | Full-page `/projects/:id` view — Project Info, editable Beneficiary, Contacts, Status, Impact, Links, Document Checklist, **Remarks (§0 item 12)**, Danger Zone. Reuses `DocumentChecklist.jsx`, `ProjectContacts.jsx`, and `RemarksSection.jsx` unchanged/as-imported; adds its own Beneficiary-edit form via `useBeneficiaries.updateBeneficiary`. No resizable-panel mechanics (plain page, not an overlay). **✅ Widened (§0 item 15):** `max-w-3xl` → `max-w-6xl`, two-column above `lg` (Project Info + Beneficiary left/wide, Status/Impact/Links/Contacts right rail), Document Checklist + Remarks full-width below the grid, single column below `lg`. |
| `src/pages/map/Map.jsx` | **Overhauled (§0 item 16).** Single page, two tabs (Overview / Plan Visit) via in-page state, `?mode=plan` read once on mount for the `/itinerary` redirect. Overview: pin placement/filter UI, now with `CATEGORY_COLORS` + a new `STATUS_COLORS` map driving pin fill via a `getBeneficiaryColor(b, colorBy)` helper, dot markers via a Leaflet `divIcon` (`createDotIcon`) that renders a distinct dimmed state (smaller, gray, lower opacity) instead of hiding filtered-out pins, and a legend keyed off whichever dimension is active. Plan Visit: the former `Itinerary.jsx` internals (name/date fields, save/delete, `CandidatePool`, `StopList`) moved in as-is. Pulls beneficiary data from `useMergedBeneficiaries` (replacing the old inline merge) and itinerary data from `useItineraries`. Imports `CandidatePool.jsx`/`StopList.jsx` from `../itinerary/` (those files themselves are unchanged) and `MapFilterBar` from its existing `filterBar.jsx`. |
| `src/pages/itinerary/Itinerary.jsx` | **Orphaned (§0 item 16).** No longer routed — `App.jsx`'s `/itinerary` path redirects into `/map?mode=plan` instead of rendering this. File and its import in `App.jsx` were deliberately left in place rather than deleted; revisit if/when doing the housekeeping pass in §10. |
| `src/pages/itinerary/CandidatePool.jsx`, `src/pages/itinerary/StopList.jsx` | Unchanged by the Map overhaul — still pure components, just now imported by `Map.jsx`'s Plan Visit tab instead of (only) `Itinerary.jsx`. |
| `src/lib/AuthContext.jsx` | **NEW (§0 item 17).** `AuthProvider` + `useAuth()` — wraps `supabase.auth.getSession()`/`onAuthStateChange`, exposes `{ session, user, loading, signIn, signOut }`. Wraps the whole `RouterProvider` in `App.jsx`, so both `Login.jsx` and the `RequireAuth` gate can consume it. |
| `src/pages/auth/Login.jsx` | **NEW (§0 item 17).** Email/password form calling `useAuth().signIn`; redirects to whatever path triggered the `RequireAuth` bounce (via router `state.from`), or `/` by default. No signup UI — accounts are provisioned directly in Supabase. |
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
2. ~~**RLS is effectively disabled** on every table, including the newer ones. Documented as a finding, not fixed. Explicitly deprioritized by Rat.~~ — **✅ RESOLVED (§0 item 17).** Every table's redundant `"allow all"`/`"Allow anon read"` policies were dropped; only `"Allow authenticated users"` remains. No longer a live gap, though see item 16 below on production verification.
3. ~~**No authentication UI anywhere.**~~ — **✅ RESOLVED (§0 item 17).** Real Supabase Auth (email/password), `RequireAuth` route guard, sign-out control in `Navbar.jsx`.
4. **Document generation is additive-only.** Category change never removes stale `documents` rows.
5. **Duplicate/orphaned files** — see §6.
6. **Router import inconsistency** — `'react-router'` vs `'react-router-dom'`.
7. **`documentStatus.js`/`documentProgress.js` duplicate "complete" logic** — keep in sync.
8. **Never commit real Supabase credentials.** *(A placeholder password was pasted into this chat during debugging — confirmed by the user to be a fake/example value, not the real one, but worth being generally careful about this going forward.)*
9. **`useItineraries.saveStops()` not transactional** — delete-then-insert, two calls.
10. **One itinerary = one saved "day"** — no day-grouping column, by design.
11. ~~`CATEGORY_COLORS` declared but unused in `Map.jsx`~~ — **✅ RESOLVED
    (§0 item 16).** Now drives pin color in Overview mode's "Color by"
    toggle, alongside a new parallel `STATUS_COLORS` map.
15. **NEW: `Itinerary.jsx` is orphaned but still in the codebase.** Since
    the §0 item 16 Map overhaul, nothing routes to it — `App.jsx`
    redirects `/itinerary` straight to `/map?mode=plan` — but the file
    and its unused import in `App.jsx` were deliberately left as-is
    (user's explicit call, not an oversight). Anyone editing routing or
    doing cleanup should know it's dead code, not a second source of
    truth for Plan Visit behavior.
16. **NEW: Auth confirmed on localhost only, production not yet verified
    (§0 item 17).** The RLS lockdown and login flow work locally; nobody
    has confirmed yet that sign-in, session persistence, and RLS behave
    correctly against the deployed Vercel app. Treat as the standing
    action item until confirmed — see §10.
17. **NEW: Remarks attribution still uses `localStorage`, not real auth
    (§0 item 17).** Real Supabase Auth now exists, but `RemarksSection.jsx`
    was deliberately left untouched — `added_by` still comes from the
    per-browser "posted as" name, not the logged-in user's identity.
    Not a bug, just an unfinished follow-up — see §8/§10.
18. **NEW: Dashboard hotspot → Documents filter never worked.** The old
    links passed `?municipality=…&submitted=No` to `/documents`, which
    doesn't read URL params. Links removed from the Dashboard (§0 item 19).
    If a real drill-down is wanted, `Documents.jsx` needs to read
    `useSearchParams` into its `filters` state first.
19. **NEW: `Map.jsx` Plan Visit grid has a typo** — `lg:grid-ls-2` should
    be `lg:grid-cols-2`, so the two columns don't split side-by-side on
    large screens. There is also a stray no-op `useState //` line near the
    Plan Visit logic. Not fixed (out of scope of the Dashboard pass).
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
- **~~Auth still deferred, reaffirmed intentional~~ — ✅ SUPERSEDED (§0
  item 17).** Originally (§0 item 12 context): a `localStorage`-backed
  free-text "posted as" name was chosen over real auth for Remarks
  attribution, deferring real Supabase Auth as mechanically easy to add
  later and not worth it yet at 2-3 trusted users. **That deferral ended**
  once real beneficiary/project data entry was about to begin on a
  publicly reachable URL with RLS effectively open — the risk profile of
  "sparse placeholder data" vs. "real names and locations" was judged
  different enough to act on now rather than later. Real Supabase Auth
  (individual accounts per person, not one shared login) was built
  instead of a lighter stopgap (e.g. a single shared password) — reasoning:
  barely more setup, and it leaves the door open to eventually moving
  Remarks attribution off the `localStorage` guess-name system onto real
  identity, which a shared login wouldn't have enabled.
- **NEW — RLS policies rewritten to "authenticated only," not
  "authenticated + still-open-a-crack" (§0 item 17).** The audit found
  three overlapping policies per table where one (`"allow all"`, role
  `public`) already silently granted everyone full access regardless of
  the other two — meaning a login screen alone would not have closed the
  gap without also touching RLS. Rather than leaving `"Allow anon read"`
  in place for convenience, anon read access was dropped entirely: there
  is no use case in this app for public/unauthenticated visibility into
  any table, so the simplest correct policy set was one policy per table,
  scoped to `authenticated`, full `ALL` access — matching the existing
  "small trusted team, no per-role distinctions yet" posture rather than
  introducing granular per-role policies that nothing currently needs.
- **NEW — `/projects/:id` widened to `max-w-6xl` with a two-column split
  (§0 item 15).** Left/wide gets the two field-heaviest sections (Project
  Info, Beneficiary); the right rail gets lighter ones (Status, Impact,
  Links, Contacts). Document Checklist and Remarks were deliberately kept
  full-width below the grid rather than put in a column, since both are
  list-heavy and benefit more from width than from column placement.
  Destructive/save UI (Danger Zone, save bar, banners) was left exactly
  where it was, full-width at the bottom, rather than moved into a column.
- **NEW — Map overhaul: fold Itinerary into Map, don't keep it separate
  (§0 item 16).** User's framing: the map should be "a true project
  management app" view of portfolio state, not primarily a trip-planning
  tool. Three decisions shaped the result: **(1)** `/itinerary` becomes a
  tab inside `/map` rather than a standalone page, with a redirect so old
  links don't break; **(2)** one map pin per *beneficiary*, not per
  project instance — a beneficiary popup lists all of that beneficiary's
  projects rather than stacking overlapping pins at identical coordinates
  (deferred: per-project pins, which would need clustering from day one
  given shared coordinates); **(3)** when a category/status filter is
  active, non-matching pins stay visible but dimmed rather than
  disappearing — judged more useful for "at a glance across the whole
  portfolio" than a hide/show toggle, at the cost of a second visual
  state per pin.
- **NEW — Plan Visit stays a list UI, not a map overlay (§0 item 16).**
  Two options were weighed for folding the old itinerary planner in: (A)
  the "cheap fold" — reuse `CandidatePool`/`StopList` as plain lists under
  a tab, no map involved; (B) render planned stops as numbered pins with a
  route line on the actual Leaflet map. **(A) was chosen** — lower risk,
  mostly plumbing — over (B), which would have been real net-new map code
  (custom numbered icons, a polyline layer) despite being the more
  visually complete answer to "true PM app." (B) remains a plausible
  future enhancement, not rejected outright, just not built now.
- **NEW — Dashboard polish kept the app's existing visual language
  (§0 item 19).** Centering was a one-class fix (`mx-auto`); polish was
  limited to consolidating repeated card markup into shared primitives and
  tightening copy/typography, rather than a redesign — the rest of the app
  is plain Tailwind gray/blue and a divergent Dashboard would look out of
  place. Hotspot counts were demoted from links to text rather than
  keeping a control that silently did nothing (§7 item 18).
- **NEW — `Itinerary.jsx` orphaned deliberately, not deleted (§0 item
  16).** Once its UI moved into `Map.jsx`, the file and its now-unused
  import in `App.jsx` were left in place rather than cleaned up — an
  explicit choice, not an oversight, deferring cleanup to a later
  housekeeping pass (§10).

---

## 9. Feature: Map — Current State (formerly "Map + Itinerary")

**Overhauled this update (§0 item 16).** What was two separate
pages/routes is now one page, `/map`, with two tabs:

**Overview (default tab)** — the portfolio-status view the user actually
wanted: one pin per beneficiary (via `useMergedBeneficiaries`), popup
listing that beneficiary's individual projects (title/year/status) linking
into `/projects/:id`. A "Color by: Category / Status" control drives pin
fill (`CATEGORY_COLORS` + new `STATUS_COLORS`); the existing
category/status/municipality/barangay/doc-condition filters narrow the set
and now also dim non-matching pins rather than hiding them. Also retains
the original manual pin-placement flow (click-to-place from a "Needs
Pinning" queue) for beneficiaries with no coordinates yet, and a "search
unpinned beneficiaries" box — none of that changed, it's just now
alongside the color-coded view rather than being the whole page.

**Plan Visit** — the former `Itinerary.jsx` page's functionality
(candidate pool, ordered stop list, name/visit-date fields, save/create/
delete via `useItineraries`), moved in as a tab, behavior unchanged. Still
list-only — stops are not drawn on the map (see §8 for why that was
deferred rather than rejected).

`/itinerary` as a standalone route no longer exists; it now redirects into
`/map?mode=plan` (§3), and the top nav's separate "Itinerary" link was
removed (§0 item 16, §3).

**Still true from before this update, unresolved:** `itineraries`/
`itinerary_stops` both have 0 rows per the live dump, so either the
feature has genuinely never been used to save a real itinerary, or any
saved itineraries were lost in the same incident that emptied
`document_types`. Worth asking the user directly whether they ever
successfully saved one.

Still open:
1. Whether to load previously-saved itineraries via something more than the current top dropdown.
2. ~~Whether to wire `CATEGORY_COLORS` into custom map markers~~ — ✅ **RESOLVED** (§0 item 16) — done, plus a parallel status color map.
3. ~~Confirm `/map` and `/itinerary` are reachable~~ — ✅ **RESOLVED.**
   `App.jsx` confirms `/map` is reachable and `/itinerary` correctly redirects.
4. **NEW:** whether Plan Visit should eventually draw stops on the real
   map (route line + numbered pins) instead of staying list-only — the
   "actually visual fold" option that was considered and deferred, not
   rejected (§8).
5. **NEW:** whether/when to clean up the now-orphaned `Itinerary.jsx` file
   and its dangling import in `App.jsx` (§7 item 15) — deliberately left
   alone for now.

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
- **✅ Widened `/projects/:id` into a two-column layout** (§0 item 15) —
  resolves the open layout-width question that was previously flagged as
  "pick this up first."
- **✅ Overhauled `/map` from itinerary-focused to portfolio-status-focused**
  (§0 item 16) — Overview/Plan Visit tabs, category/status color-coding
  (`CATEGORY_COLORS` finally wired in, §7 item 11 resolved), dimmed
  non-matching pins, `useMergedBeneficiaries` replacing the old inline
  merge, `/itinerary` folded in as a tab with a redirect from its old
  route. See §9 for full detail.
- **✅ Real Supabase Auth built, RLS "allow all" hole closed** (§0 item
  17) — login/logout, `RequireAuth` route guard, and a rewritten RLS
  policy set (one `authenticated`-only policy per table, anon and public
  access dropped everywhere). **Confirmed working on localhost only** —
  production verification is the immediate next step below.

- **✅ Dashboard centered + polished** (§0 items 18–19, §3a).
- **✅ "Recent remarks across all projects" Dashboard section** — built
  (Recent Activity, `useAllRemarks.js`); previously listed as unbuilt.

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
   projects" Dashboard section is now **also built** (§0 item 18).
3. **Raw Excel export** (data as currently in the app) — not started.
4. Heatmap — ✅ done (lat/lng on `beneficiaries`, Map feature live).
5. **Responsiveness / mobile pass** — not started. Original plan: tables
   collapse to card lists below a breakpoint, `EditPanel` becomes a
   full-screen modal on small screens. The `/projects/:id` width question
   this was once bundled with is now resolved (§0 item 15, two-column
   above `lg`, single column below) — this pass is still worth doing on
   its own merits, just no longer blocked on or tied to that decision.
6. **Report template filling** — not started; depends on the user's
   existing report templates (never uploaded) and real, stable data —
   sequenced last for a reason, doubly so with Excel import still undone.

### Immediate (do next)
1. **NEW: Confirm auth + RLS work correctly in production (Vercel), not
   just localhost (§0 item 17, §7 item 16).** Deploy if not already done,
   sign in with each real account, and confirm data reads/writes work as
   expected under the new "authenticated only" policies before relying on
   the app for real data entry.
2. ~~Decide whether `/projects/:id` should be wider~~ — **✅ DONE** (§0
   item 15). No longer blocking anything.
3. **Implement a delete function on the Beneficiaries page.** `useBeneficiaries.deleteBeneficiary()` already exists with its FK delete-guard reasoning built in — this is purely a UI wire-up, following the same pattern Contacts already uses for its working delete button. (§7 item 14)
4. Regenerate document checklists for the 4 projects that still don't have one (ids 2, 3, 5, 6) — `document_types` has been restored, this should now work correctly via the Generate Checklist button.
5. **Confirm the `updated_at` SQL migration was actually run** in Supabase (§0 item 12, §4) — it was handed to the user, not confirmed executed.
6. **Decide where `updated_at` should be surfaced in the UI** — it's tracked in the DB now but displayed nowhere (a tooltip per document row? a line under Beneficiary info? under Remarks?). Flagged as an open question when the migration was generated and never answered.
7. **NEW:** confirm the widened `/projects/:id` reads well in practice — specifically the Impact section's two number inputs now sitting in the narrower right rail (§0 item 15) — and decide whether they should stack to one column instead of staying side-by-side.

### Then: small unresolved decisions
- Decide the fate of `?edit=<id>` on `/projects`: leave it opening `EditPanel` permanently (now a real, intentional design decision rather than a stopgap, since `EditPanel` is staying), or redirect it to `/projects/:id` for Dashboard's overdue/upcoming links specifically. Not urgent — current behavior is not broken, just worth a deliberate answer rather than leaving it implicit.
- Re-confirm priority order given the restored Sep 7 roadmap above — Excel import in particular was the stated top priority and appears to have been quietly superseded; worth an explicit decision rather than leaving it implicit too.

### Lower priority / opportunistic
- Decide on saved-itinerary browsing beyond the current dropdown.
- ~~Decide on `CATEGORY_COLORS` wiring for map markers~~ — **✅ DONE** (§0 item 16).
- Housekeeping: dedupe `PaginationBar`/`VisibilityPanel`, remove dead `documents/columns.jsx`, normalize router imports (`ProjectDetail.jsx` already follows the majority `'react-router'` convention; `Navbar.jsx` still uses `'react-router-dom'`, unchanged by the Map overhaul).
- **NEW:** remove the now-orphaned `Itinerary.jsx` file and its unused import in `App.jsx` (§0 item 16, §7 item 15) — left in place deliberately for now, not forgotten.
- **NEW:** swap Remarks' `added_by` attribution from the `localStorage`-backed free-text name over to the now-available real logged-in user identity (§0 item 17, §7 item 17) — not urgent, the current system still works, but redundant now that real accounts exist.
- **NEW:** consider rendering Plan Visit's stops on the actual Leaflet map (numbered pins + route line) instead of staying list-only — the "actually visual fold" option from §8, deferred rather than rejected.
- Confirm whether any itineraries were lost (§9) and whether they need reconstruction like `document_types` did.
- Consider whether `Documents.jsx` should also get a link into `/projects/:id` for cases where someone needs more than the document pivot while triaging — not requested, purely opportunistic.
- ~~A "recent remarks across all projects" Dashboard section~~ — **✅ DONE** (§0 item 18).
- **NEW:** eyeball the polished Dashboard in a browser (§0 item 19) and fix the `Map.jsx` `lg:grid-ls-2` typo (§7 item 19).
- **NEW:** optionally repoint Dashboard's overdue/upcoming rows to `/projects/:id` to match Recent Activity/Recently Updated (ties into the open `?edit=<id>` decision above).

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
session that produced this doc, a same-day reconciliation pass against
the full source transcript (Remarks + `updated_at` built, the Sep 7
roadmap restored, and one then-open question about `/projects/:id` layout
width), a second same-day reconciliation (§0 items 15–16) covering the
`/projects/:id` width question actually being resolved and the Map
feature's overhaul from an itinerary-focused tool into a portfolio-status
visualization with Plan Visit folded in as a tab, and a third same-day
reconciliation (§0 item 17) covering real Supabase Auth being built and
the RLS "allow all" hole actually closed — confirmed working on
localhost, production verification still pending (§10).*
