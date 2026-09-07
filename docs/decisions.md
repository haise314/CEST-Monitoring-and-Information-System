# Decisions — CEST-MIS

Notable architectural/implementation patterns observed in the code, with the
evidence for each and a confidence label. **CONFIRMED** = code comment or
unambiguous code structure states the reason directly. **INFERENCE** =
reasonable interpretation not explicitly stated. Nothing here is invented
without supporting evidence.

## No global state library (Redux/Zustand/React Query)

**INFERENCE.** Every page re-fetches its own data via a local hook; no
provider wraps `App.jsx` beyond `RouterProvider`. Given the app's scale (a
handful of tables, small internal tool), this is a reasonable and likely
deliberate simplicity choice rather than an oversight — but it does mean data
isn't shared/cached across pages (e.g., navigating between `/projects` and
`/documents` triggers two independent fetches of overlapping project data).

## Manual sticky-column implementation in `Documents.jsx`

**CONFIRMED** by code comment: TanStack's built-in column pinning derives
sticky offsets from configured column *sizes*, but this table's other columns
are auto-sized by content, making the built-in mechanism a poor fit. The
`PINNED_COLUMNS` map with hardcoded `width`/`left` values is a deliberate
workaround, not an oversight.

## Dynamic per-phase pivot columns in `Documents.jsx`, but static columns in `Projects.jsx`

**INFERENCE.** These are genuinely different data shapes: `Projects.jsx`
shows one row per project with a fixed, known set of project attributes —
static columns are the natural fit. `Documents.jsx` shows one row per project
but needs one column per `document_type` *within the currently selected
phase* — a set that varies by phase and could grow as document types are
added — so building columns dynamically from `documentTypesByPhase` avoids
hardcoding them. This likely explains why `documents/columns.jsx` (a leftover
static attempt) was abandoned in favor of the inline dynamic approach.

## Duplicated status/category color maps across files

**INFERENCE.** `STATUS_COLORS`, `CATEGORY_COLORS`, `PHASE_COLORS` are
redefined independently in `Dashboard.jsx`, `Documents.jsx`,
`projects/columns.jsx`, and `projects/statusCell.jsx`, rather than imported
from one shared constants file. No comment explains this. Most likely
explanation: the app grew feature-by-feature (page by page) without a
refactor pass to centralize shared constants — a common and low-risk form of
duplication, but a real one. If the color scheme for a status ever changes,
**all four locations need updating**; this is a maintenance risk worth
flagging, not a deliberate design choice as far as the evidence shows.

## Document generation is additive-only, never destructive

**CONFIRMED** by code comment in `useDocuments.js` ("Add-only — never deletes
existing documents") and by `EditPanel`'s explicit user-facing warning on
category change. This is a clear, deliberate safety decision: the system
would rather leave a stale, now-inapplicable document row for a human to
mark N/A than risk silently deleting a document that might have real
submitted/hard-copy data attached to it. Preserve this behavior in any future
changes to the generation logic.

## Optional document types default to N/A on generation

**CONFIRMED** by code comment: "Optional docs (Monitoring Form) default to
N/A — user enables if needed." This means the completion percentage isn't
artificially dragged down by optional paperwork that usually isn't produced
— a deliberate choice to keep compliance percentages meaningful by default,
at the cost of requiring a manual step for the (presumably rare) cases where
an optional document IS produced.

## Beneficiary is immutable after project creation

**CONFIRMED** by `EditPanel`'s explicit UI copy: "A project's beneficiary is
fixed at creation and isn't reassigned here." No code comment explains *why*,
but a reasonable **INFERENCE**: since `documents`, contacts-linking, and
compliance tracking are all conceptually tied to "this deployment at this
beneficiary," allowing reassignment after the fact could orphan or
misattribute historical compliance data. Not stated outright — flagged as
inference.

## Deep-link query params (`?edit=<id>`) instead of nested routes

**INFERENCE.** Both `Projects.jsx` and `Beneficiaries.jsx` use a
`?edit=<id>` search param (consumed once, then cleared) rather than a nested
route like `/projects/:id`. This keeps the edit UI as an overlay (modal/slide-
over) rather than a separate page/URL, consistent with how these components
are otherwise opened (button clicks, not navigation). The tradeoff: a
directly-shared or bookmarked `/projects?edit=5` URL only works transiently —
the moment the panel opens, the param is cleared, so refreshing the page
afterward loses the "which record is open" state. This appears to be an
accepted tradeoff of the current design, not a bug, but worth knowing if
persistent deep-linking is ever requested as a feature.

## RLS "allow all" policies alongside anon/authenticated policies

**INFERENCE — likely a development-time RLS setup that was never removed
before this backup was taken**, rather than an intentional security posture.
Evidence: all three policy types (`anon read`, `authenticated write`, `allow
all`) coexist on every table, which is a common Supabase pattern when a
developer starts with `allow all` for early development/testing and later
adds narrower policies without removing the original — but never got around
to tightening it. Combined with there being no auth UI in the app at all
(see `architecture.md`), it's plausible the whole app is intentionally being
run without access control for now (e.g., an internal tool on a private
network). **Either way, this is a finding to raise with the project owner,
not something to silently "fix" by deleting policies** — doing so could break
the app if `anon` access is currently relied upon by design.

## No schema-validation library (Zod/Yup) for forms

**INFERENCE.** All form validation is manual truthiness checks
(`if (!form.name || !form.category) setError(...)`). Given the app's modest
form complexity (a handful of required-field checks, no complex cross-field
validation), this is a reasonable scope-appropriate choice rather than a gap
— but would be worth reconsidering if forms grow more complex.