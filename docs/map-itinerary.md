# Handoff — Map / Itinerary Feature (In Progress)

Written mid-build, at a clean checkpoint, to avoid losing context if this
thread runs out of room. Read alongside the existing `docs/` set
(`claude.md`, `architecture.md`, `database.md`, `business-rules.md`,
`decisions.md`, `important-files.md`) — this file only covers what's new
since those were written and does not repeat anything already documented
there. Labeled CONFIRMED (I wrote/verified it this session) vs PLANNED (agreed
but not yet built).

## What This Feature Is

A `/map` page: pin every beneficiary's physical location on a Leaflet map,
then build a saved, ordered visit itinerary from a filtered subset of
beneficiaries (e.g. "missing hard copies, Iba + Botolan"). Requested to solve
a real field-work problem — planning which beneficiaries to physically visit,
grouped by geographic closeness and document compliance gaps.

## Schema — CONFIRMED, live in the database

Verified via direct SQL query this session (not assumed):

```sql
-- New columns on the existing beneficiaries table
ALTER TABLE beneficiaries
ADD COLUMN latitude numeric(9,6),
ADD COLUMN longitude numeric(9,6);
```
Confirmed present via `information_schema.columns` query. Nullable — a
beneficiary with no pin yet has `latitude`/`longitude` both `NULL`.

```sql
CREATE TABLE itineraries (
  id serial PRIMARY KEY,
  name varchar(255) NOT NULL,
  visit_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE itinerary_stops (
  id serial PRIMARY KEY,
  itinerary_id integer NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  beneficiary_id integer NOT NULL REFERENCES beneficiaries(id) ON DELETE CASCADE,
  stop_order integer NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(itinerary_id, beneficiary_id)
);
```
Both confirmed present via `information_schema.tables` query. RLS enabled
with an `"allow all"` policy on both, matching every other table's current
(unauthenticated) access pattern per `database.md`.

**Design decision**: coordinates live on `beneficiaries`, not
`project_instances`. A beneficiary is one physical place; every project under
it shares that location. This mirrors the existing pattern where
`beneficiary_id` is fixed/immutable on a project (see `decisions.md`).

**Not yet decided/built**: `itinerary_stops.stop_order` is an integer but
nothing writes to it yet (see "Not Yet Built" below) — the itinerary builder
is what will populate and reorder it.

## Dependencies — CONFIRMED installed

```
npm install leaflet react-leaflet
```
Ran clean, no version conflicts with React 19 (user confirmed: "no errors,
just vulnerabilities" — standard npm audit noise, not blocking).

## Files Built This Session — CONFIRMED written, given to user as downloads

| File | Status | Purpose |
|---|---|---|
| `src/lib/leafletIcon.js` | Built, **not yet confirmed placed by user** | One-time fix for Leaflet's default marker icon breaking under Vite's asset bundling. Must be imported once wherever the map renders (`Map.jsx` imports it). |
| `src/hooks/useBeneficiaryLocations.js` | Built, **not yet confirmed placed** | Fetches all beneficiaries with `latitude`/`longitude` + a `project_instances(count)` join for a lightweight project count. Exposes `setLocation(id, lat, lng)` (optimistic) and `clearLocation(id)`. **Deliberately independent** of whatever `useProjects.js`/`useBeneficiaries.js` currently select — avoided touching those stale-risk files per `important-files.md`'s caution, at the cost of this hook re-fetching beneficiary rows that other hooks also fetch elsewhere (acceptable duplication for now, same tradeoff already accepted elsewhere per `decisions.md`'s "no global store" note). |
| `src/pages/map/Map.jsx` | Built, **not yet confirmed placed** | The page itself. See "What It Does" below. |

**User has not yet confirmed these three files are placed on disk and
working** — the last message before this handoff was the user asking whether
to continue or pause, not a confirmation that pinning works end to end.
**First thing next session: confirm these are placed and pinning a
beneficiary actually saves**, before building anything on top of them.

## What `Map.jsx` Does (CONFIRMED, as built)

- Leaflet map (OpenStreetMap tiles, free, no API key), centered on Zambales
  province by default (`[15.5, 119.95]`, zoom 10 — an arbitrary reasonable
  starting view, not tied to any specific beneficiary).
- Every beneficiary with non-null `latitude`/`longitude` renders as a marker.
  Marker popup shows name, barangay/municipality, category, project count,
  and **Reposition** / **Remove pin** actions.
- Sidebar lists every beneficiary **without** coordinates yet ("Needs
  Pinning" queue), search-filterable by name/municipality/barangay.
- Click "Place pin" on a sidebar item → map cursor becomes crosshair → click
  anywhere on the map → saves that lat/lng to the beneficiary immediately
  (optimistic update, no page reload) → beneficiary moves from the sidebar
  queue onto the map as a marker.
- `CATEGORY_COLORS` constant exists in the file (blue/indigo/violet/etc. per
  beneficiary category) but **is not yet wired into actual marker
  rendering** — markers currently all render as Leaflet's default blue pin.
  Left as-is deliberately: color-coding only becomes useful once there's a
  filter panel to explain what the colors mean, so it was deferred to that
  step rather than half-implemented now.

## Not Yet Built (PLANNED, in this order)

1. **Filter panel** — user's explicit requirement: "filterable by their
   documents or geographical closeness (things that would actually aid in
   making the itinerary)." Not yet designed in detail. Needs:
   - A document-compliance filter, almost certainly reusing
     `lib/documentStatus.js`'s `DOC_CONDITIONS` and/or
     `lib/documentProgress.js`'s `computeProgress()` — the same functions
     `Documents.jsx` and `DocumentChecklist.jsx` already use, per
     `important-files.md`'s note that both files must stay in sync with any
     changes to that completion logic.
   - A geographic filter — likely municipality/barangay dropdowns (pattern
     already established in `projects/filterBar.jsx` and
     `documents/filterBar.jsx`), possibly also a "within N km of this pin"
     radius filter — not yet discussed with the user in detail.
   - This filter will need each beneficiary's *project* data (category,
     status) and *document* compliance data, neither of which
     `useBeneficiaryLocations.js` currently fetches (it only pulls a raw
     project count). **Open question for next session**: reuse
     `useProjects()` + `useAllDocuments()` (both already exist, already
     power `Documents.jsx`) and merge by `beneficiary_id` in-memory on the
     Map page, rather than duplicating that fetch logic into a new hook.
     This was the plan discussed in principle but not yet implemented.
2. **Itinerary builder** — agreed approach (not yet built):
   - User selects a filtered subset of beneficiaries as candidate stops.
   - Auto-order via a **nearest-neighbor heuristic** computed client-side
     (no routing API — deliberately, to stay free-tier/no-API-key,
     consistent with the Leaflet/OSM choice) — NOT true TSP optimization,
     explicitly agreed to be unnecessary at this scale (dozens of stops, not
     thousands).
   - Starting point for the heuristic: **not yet decided** — could be a
     fixed office location, the user's current position, or just "first
     selected stop." Needs a decision next session.
   - Manual drag-to-reorder after the auto-order proposes a sequence — user
     explicitly wants the algorithm to propose, not dictate, matching the
     same "computer proposes, human decides" philosophy from the original
     document-compliance itinerary conversation earlier in this project's
     history.
   - Save to `itineraries` + `itinerary_stops` (schema exists, confirmed
     above) — needs a `useItineraries.js` hook (CRUD for itineraries, add/
     remove/reorder stops) — **not yet written**.
   - A way to view/load a previously saved itinerary — not yet designed
     (list view? dropdown on the Map page? separate section?).
3. **Wiring `/map` into the app** — the user was given manual instructions
   (add import + route line to `App.jsx`, add a Navbar link) rather than a
   direct file edit, because **the `App.jsx` uploaded earlier in this session
   was confirmed stale** — it still imported the old broken
   `ProjectContacts`-as-a-page pattern that was fixed in a prior session, and
   its `Beneficiaries` import path didn't match `architecture.md`. Editing it
   blind risked reintroducing an already-fixed bug. **Unconfirmed whether the
   user has actually added the `/map` route yet** — verify this first thing
   next session before assuming the page is reachable at all.

## Immediate Next Steps (in order)

1. Confirm the three files from this session are placed on disk.
2. Confirm the `/map` route + Navbar link were added, and the page loads.
3. Confirm pinning a beneficiary actually persists (click Place pin → click
   map → marker appears, survives a page refresh).
4. Decide the open questions under "Filter panel" and "Itinerary builder"
   above (data-fetching approach, nearest-neighbor starting point, saved-
   itinerary view location).
5. Build the filter panel.
6. Build `useItineraries.js` + the itinerary builder UI.

## Reminder for Whoever Picks This Up

Per this project's established pattern (see `important-files.md`,
`decisions.md`): **verify against the live database/filesystem before
assuming state**, especially anything schema-related — this exact session
already had one false alarm (a stale `supabase_backup.sql` implying
`project_contacts` didn't exist, when a live query showed it did). Don't
repeat that mistake with the `itineraries`/`itinerary_stops` tables or the
new `beneficiaries` columns — they're confirmed here, but confirm again if
significant time has passed or the database might have changed hands.
