Handoff — Map / Itinerary Feature (In Progress)

Written mid-build, at a clean checkpoint, to avoid losing context if this
thread runs out of room. Read alongside the existing docs/ set
(claude.md, architecture.md, database.md, business-rules.md,
decisions.md, important-files.md) — this file only covers what's new
since those were written and does not repeat anything already documented
there. Labeled CONFIRMED (implemented/verified in the current files) vs PLANNED
(agreed but not yet built).

What This Feature Is

A /map page: pin every beneficiary's physical location on a Leaflet map,
then build a saved, ordered visit itinerary from a filtered subset of
beneficiaries (e.g. "missing hard copies, Iba + Botolan"). Requested to solve
a real field-work problem — planning which beneficiaries to physically visit,
grouped by geographic closeness and document compliance gaps.

Schema — CONFIRMED, live in the database

Verified via direct SQL query this session (not assumed):

-- New columns on the existing beneficiaries table
ALTER TABLE beneficiaries
ADD COLUMN latitude numeric(9,6),
ADD COLUMN longitude numeric(9,6);

Confirmed present via information_schema.columns query. Nullable — a
beneficiary with no pin yet has latitude/longitude both NULL.

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

Both confirmed present via information_schema.tables query. RLS enabled
with an "allow all" policy on both, matching every other table's current
(unauthenticated) access pattern per database.md.

Design decision: coordinates live on beneficiaries, not
project_instances. A beneficiary is one physical place; every project under
it shares that location. This mirrors the existing pattern where
beneficiary_id is fixed/immutable on a project (see decisions.md).

Not yet decided/built: itinerary_stops.stop_order is an integer but
nothing writes to it yet (see "Not Yet Built" below) — the itinerary builder
is what will populate and reorder it.

Dependencies — CONFIRMED installed

npm install leaflet react-leaflet

Ran clean, no version conflicts with React 19 (user confirmed: "no errors,
just vulnerabilities" — standard npm audit noise, not blocking).

Files Built This Session — CURRENT STATE

File

Status

Purpose

src/lib/leafletIcon.js

Built

One-time fix for Leaflet's default marker icon breaking under Vite's asset bundling. Imported by Map.jsx.

src/hooks/useBeneficiaryLocations.js

Built

Fetches beneficiary locations plus project count; exposes setLocation(id, lat, lng) and clearLocation(id). Deliberately remains independent of useProjects.js/useBeneficiaries.js.

src/pages/map/filterBar.jsx

Current / implemented

Filter UI for municipality, barangay, project category, overall status, and document-compliance condition. Uses DOC_CONDITIONS; municipality changes reset barangay.

src/pages/map/Map.jsx

Current / implemented

Map page, location pinning, filtering, document/project merging, marker display, and unpinned-beneficiary search/queue. See "What It Does" below.

The current uploaded filterBar.jsx and Map.jsx are the source of truth for the
implemented map/filter behavior. This handoff has been updated to reflect them.

What Map.jsx Does (CONFIRMED, current file)

Leaflet map uses OpenStreetMap tiles, with no API key, centered on Zambales by
default ([15.5, 119.95], zoom 10).

useBeneficiaryLocations(), useProjects(), and useAllDocuments() are all
loaded. Beneficiaries are merged in-memory with their related projects and
documents using beneficiary_id; document types are collected from the
already-fetched documents and grouped in PHASE_ORDER.

Standard filters are implemented through filterBar.jsx: Municipality,
Barangay, Project Category, and Overall Status. Municipality changes
clear the barangay selection. Project-category options are In-house and
Fund Transfer; overall-status options are the current eight statuses defined
in the filter bar.

A document-compliance query builder is implemented: choose a document type
grouped by phase, then choose a DOC_CONDITIONS condition. The filter becomes
active only when both a document type and condition are selected. For the
selected document type, a beneficiary matches when no matching document exists
and the condition passes against undefined, or when at least one matching
document satisfies the condition.

The map renders every filtered beneficiary with non-null latitude/longitude
as a marker. Popup shows name, barangay/municipality, category, project count,
and Reposition / Remove pin actions.

The sidebar contains filtered beneficiaries without coordinates ("Needs Pinning")
and can search them by name, municipality, or barangay.

"Place pin" makes the cursor a crosshair; clicking the map saves the selected
beneficiary's latitude/longitude through setLocation() and removes it from
the unpinned queue without a page reload.

Existing pins can be repositioned or removed.

CATEGORY_COLORS is still declared but not used by the current marker
rendering; all markers still use Leaflet's default marker icon.

Not Yet Built (PLANNED, in this order)

Itinerary builder — agreed approach (not yet built):

User selects a filtered subset of beneficiaries as candidate stops.

Auto-order via a nearest-neighbor heuristic computed client-side
(no routing API — deliberately, to stay free-tier/no-API-key,
consistent with the Leaflet/OSM choice) — NOT true TSP optimization,
explicitly agreed to be unnecessary at this scale (dozens of stops, not
thousands).

Starting point for the heuristic: not yet decided — could be a
fixed office location, the user's current position, or just "first
selected stop." Needs a decision next session.

Manual drag-to-reorder after the auto-order proposes a sequence — user
explicitly wants the algorithm to propose, not dictate, matching the
same "computer proposes, human decides" philosophy from the original
document-compliance itinerary conversation earlier in this project's
history.

Save to itineraries + itinerary_stops (schema exists, confirmed
above) — needs a useItineraries.js hook (CRUD for itineraries, add/
remove/reorder stops) — not yet written.

A way to view/load a previously saved itinerary — not yet designed
(list view? dropdown on the Map page? separate section?).

Wiring /map into the app — the user was given manual instructions
(add import + route line to App.jsx, add a Navbar link) rather than a
direct file edit, because the App.jsx uploaded earlier in this session
was confirmed stale — it still imported the old broken
ProjectContacts-as-a-page pattern that was fixed in a prior session, and
its Beneficiaries import path didn't match architecture.md. Editing it
blind risked reintroducing an already-fixed bug. Unconfirmed whether the
user has actually added the /map route yet — verify this first thing
next session before assuming the page is reachable at all.

Immediate Next Steps (in order)

Confirm the current /map page is reachable and that pinning persists after
refresh.

Confirm the current filters behave as intended against live data, especially
the document-condition semantics for beneficiaries with no matching document.

Decide the remaining itinerary-builder questions: nearest-neighbor starting
point and where saved itineraries are listed/loaded.

Build useItineraries.js for itinerary CRUD plus stop add/remove/reorder.

Build the itinerary UI: select filtered beneficiaries, generate a proposed
order, manually drag/reorder, then save to itineraries + itinerary_stops.

Decide whether to wire CATEGORY_COLORS into custom marker icons or leave the
default markers.

Reminder for Whoever Picks This Up

Per this project's established pattern (see important-files.md,
decisions.md): verify against the live database/filesystem before
assuming state, especially anything schema-related — this exact session
already had one false alarm (a stale supabase_backup.sql implying
project_contacts didn't exist, when a live query showed it did). Don't
repeat that mistake with the itineraries/itinerary_stops tables or the
new beneficiaries columns — they're confirmed here, but confirm again if
significant time has passed or the database might have changed hands.