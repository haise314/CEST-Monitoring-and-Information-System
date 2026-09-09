# Pending Issues — Triage (written before starting work)

Written at the start of a new batch of requests, before touching any code,
because this batch is large and includes at least one real architecture
change. Purpose: if this thread ends before all of it is done, this survives
as the plan + open questions, rather than losing the triage. Read alongside
the rest of `docs/` — nothing here contradicts those files; where it extends
them, that's noted explicitly.

Status key: **QUICK FIX** (small, isolated, just needs the current file to
edit) / **NEEDS DECISION** (can't safely proceed without user input) /
**MAJOR** (real architecture change, own initiative, own file requests).

---

## 1. Amount is not saving — QUICK FIX (blocked on files)

Real bug, cause unknown without seeing current code. Need the current
`addModal.jsx` and `editPanel.jsx` (`pages/projects/`) to diagnose. Likely
candidates once seen: a numeric-coercion mismatch (`Number(form.amount)` vs
a string being sent), a field name typo, or something that changed in a
recent edit. **Not guessing at a fix without seeing the actual current
file** — this project's history (this exact conversation) has already hit
real bugs from editing/assuming stale files (the `ProjectContacts`-as-a-page
bug, the stale `App.jsx`).

## 2. Entry Point should be a dropdown, not free text — QUICK FIX (blocked on files + one decision)

`entry_point` on `project_instances` is free varchar text with **no lookup
table** (per `database.md`) — the *filter* dropdowns already show distinct
existing values, but the *add/edit forms* currently take raw text input.

**Decision needed**: should the Add/Edit dropdown be:
- (a) distinct existing values only, with a "+ Add new" fallback to free
  text (same spirit as the existing inline project-type creation in
  `useFormData.js`'s `addProjectType`), or
- (b) a fixed, hardcoded list of valid entry points (would require someone
  to define that canonical list — none currently exists in the schema)?

Leaning toward (a) since it requires no schema change and matches an
existing pattern in the codebase. **Needs confirmation before building.**

## 3. Include "Project Title" in Add Project — NEEDS DECISION (possible schema change)

**No `title` column exists anywhere in `project_instances`** — confirmed
against `database.md`'s full column list. What currently stands in for a
project's "name" in the UI is `project_types.name` (e.g. "Portasol") plus
the linked beneficiary's name.

**Genuinely ambiguous which of these is meant — do not assume**:
- (a) The user wants the existing **Project Type** dropdown surfaced more
  prominently / relabeled "Project Title" in the Add form (no schema
  change), or
- (b) The user wants a **new, separate free-text title field** distinct from
  project type — e.g. "Portasol Unit for Barangay X Farmers Association" as
  its own string, independent of the generic type name (this WOULD need a
  new `project_instances.title` column, migration required).

This matters because the very first Excel column list at the start of this
project's whole history (session zero) had "Project Title" as its own
column, separate from what became `project_types` — so (b) has real
precedent and shouldn't be dismissed. **Must ask the user before proceeding**
— do not silently pick one.

## 4. Beneficiary should be creatable inline when adding a project — NEEDS DECISION

Currently, per `business-rules.md`, Add Project already *requires* selecting
an existing `beneficiary_id` from a dropdown — but there's no way to create
a **new** beneficiary without leaving the Add Project flow first. User wants
this merged/inlined.

**Two reasonable shapes, need user's preference**:
- (a) A "+ New Beneficiary" option inside the existing beneficiary dropdown
  in `addModal.jsx` that expands a nested mini-form (name + category
  minimum, since those are the only required beneficiary fields per
  `business-rules.md`) right there, without opening a second modal.
- (b) A genuinely merged single modal/flow: Add Project modal always shows
  full beneficiary fields, either selecting-existing or filling-new inline
  in the same layout.

(a) is less disruptive to the existing modal; (b) is a bigger rebuild of
`addModal.jsx`. **Needs the user's preference before building.**

## 5. Beneficiaries/Contacts pages: row click → modal, not an Actions column — QUICK FIX (blocked on files)

Straightforward, same pattern already used on `/projects` (`Projects.jsx`
row `onClick` opens `EditPanel`) and already how `/contacts` was built
earlier in this project's history (**though**: per `important-files.md` and
`claude.md`, a `Beneficiaries.jsx` / `BeneficiaryModal.jsx` pair now exists
that **I did not build and have not seen** — someone/some session built it
after the Contacts page work in this thread). Need current
`Beneficiaries.jsx`, `BeneficiaryModal.jsx`, `Contacts.jsx`, and
`ContactModal.jsx` to confirm current row-rendering approach (Actions column
vs already-clickable) before editing either.

## 6. Modals should be centered, not slide from the side — CLARIFICATION NEEDED

`ContactModal.jsx` (built earlier this project) is **already centered**
(`fixed inset-0 ... flex items-center justify-center`) — not a slide-over.
The only genuinely side-sliding UI in the app is `EditPanel` (the
resizable project slide-over, per `architecture.md`). So this request likely
folds into #7 below (replace `EditPanel`'s slide-over with a full page)
rather than being about `ContactModal`/`BeneficiaryModal`, which should
already satisfy this. **Will confirm `BeneficiaryModal.jsx` is also centered
once that file is shared** rather than assume.

## 7. Dedicated comprehensive page per project (replacing `EditPanel`) — MAJOR, own initiative

This is a real architecture change, not a small edit. Current state per
`architecture.md`/`decisions.md`:
- `EditPanel` is a slide-over reused by `Projects.jsx`, `Documents.jsx`, and
  `Overview.jsx` (three routes depend on it).
- The app currently uses `?edit=<id>` query params + overlay panels
  deliberately, **not** nested routes like `/projects/:id`
  (`decisions.md` explicitly names this as an accepted tradeoff, while also
  flagging "worth knowing if persistent deep-linking is ever requested as a
  feature" — this request is exactly that).

**Proposed shape** (not yet started, needs confirmation before building):
- New nested route `/projects/:id` — a real page, not an overlay.
- Migrate `EditPanel`'s content (Project Info, Beneficiary section,
  Contacts, Status, Impact, Links, Document Checklist, Danger Zone) into
  this page essentially as-is, dropping the resizable-panel/
  `localStorage['editPanelWidth']` mechanics (a page doesn't need a
  drag-to-resize width).
- Update `Projects.jsx`, `Documents.jsx`, `Overview.jsx` to `navigate()` to
  `/projects/:id` instead of opening `EditPanel`.
- Beneficiary section on this page should let the user **actually edit** the
  linked beneficiary (and its contacts) in place — a bigger ask than
  today's read-only "go to the Beneficiaries page" link
  (per `decisions.md`'s "Beneficiary is immutable after project creation" —
  **this request may be asking to relax or change that**, not just move it
  to a page. Needs explicit confirmation: does "including the updating of
  anything else connected to it" mean the beneficiary's *own fields* become
  editable from here, or just that its *contacts* are manageable from here
  (which `ProjectContacts.jsx` already does)?).
- Old `?edit=` deep-link behavior on `/projects` would presumably become a
  redirect to `/projects/:id` instead, or be retired — needs a decision.

**This should be its own focused build pass**, done after the smaller fixes
above, once: (a) the beneficiary-editability question is answered, and
(b) I've seen the current `editPanel.jsx`, `Projects.jsx`, `Documents.jsx`,
`Overview.jsx`, and `App.jsx` (all needed to do this without guessing at
stale content — this project's history has already shown that guessing at
unseen files causes real bugs).

---

## Files needed before any of the above can start (quick fixes first)

```
src/pages/projects/addModal.jsx
src/pages/projects/editPanel.jsx      (current — mine from earlier this thread predates Map/itinerary work and may be stale)
src/pages/projects/columns.jsx
src/pages/beneficiaries/Beneficiaries.jsx
src/pages/beneficiaries/BeneficiaryModal.jsx
src/pages/contacts/Contacts.jsx
src/pages/contacts/ContactModal.jsx
src/hooks/useFormData.js              (has addProjectType — relevant pattern for #2/#4)
src/hooks/useBeneficiaries.js
```

For the MAJOR item (#7) specifically, additionally need:
```
src/App.jsx
src/components/Navbar.jsx
src/pages/documents/Documents.jsx
src/pages/overview/Overview.jsx
```

## Open questions requiring the user's answer (blocking, not assumed)

1. Entry Point dropdown: distinct-existing-values-with-add-new, or a fixed
   canonical list?
2. "Project Title": relabel the existing Project Type field, or a genuinely
   new separate free-text column (schema migration)?
3. Inline beneficiary creation in Add Project: dropdown "+ New" expansion,
   or a fully merged form?
4. Dedicated project page: should the Beneficiary section become genuinely
   editable (fields, not just contacts), overturning the current documented
   "immutable beneficiary" decision, or does "updating anything connected to
   it" mean only contacts (already possible) plus documents (already
   possible)?
5. What happens to the `?edit=<id>` deep-link pattern once a real
   `/projects/:id` page exists — redirect, retire, or keep both?

## Suggested order of work

1. Quick fixes first (once files are shared): #1 amount bug, #5 row-click
   modals, #6 (confirm already satisfied or fix if not).
2. #2 and #4 once their decisions are answered.
3. #3 once its decision is answered (may involve a migration).
4. #7 last, as its own focused pass, once its open questions are answered
   and its file list is shared.