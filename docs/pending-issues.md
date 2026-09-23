# Pending Issues — Triage (UPDATED — Phase 1 & 2 done, Phase 3 not started)

Originally written before starting a batch of 6 requests. This update
reflects what actually happened: Phase 1 and Phase 2 are complete and
verified against real uploaded files. **Only Phase 3 (item #7) remains**,
and every open decision it needed has now been answered — the next session
can start building immediately, no more triage needed.

Stopped here deliberately, before starting #7, because it's the largest
single item in this batch (new page + migrating EditPanel's full contents +
5 files to read + 5+ files to edit) and this conversation is already long.
Starting it without headroom risked a partial migration leaving
Projects.jsx/Documents.jsx/Overview.jsx simultaneously broken — worse than
not starting. Recommend continuing Phase 3 in a fresh conversation with this
file (plus the rest of `docs/`) pasted in, same reasoning as the earlier
map/itinerary handoff in this project's history.

---

## ✅ RESOLVED — #1 Amount not saving

Fixed (confirmed via `columns.jsx`'s `parseAmount()`, already present with
an explicit comment identifying the root cause: `<input type="number">`
silently rejects comma-formatted input like "285,000"). No longer an issue.

## ✅ RESOLVED — #2 Entry Point should be a dropdown

**Decision:** existing distinct values + "+ Add new" (same pattern as
Project Type's inline creation).

**Built and delivered this session** in `addModal.jsx`, `editPanel.jsx`,
`useFormData.js` (now fetches distinct `entry_point` values from
`project_instances`, deduped client-side — no lookup table exists for this
field, so "+ Add new" just types directly into the form rather than
inserting anywhere). Both forms guarantee the current value is always a
selectable option even if just-typed, via a locally-derived
`entryPointOptions` list.

## ✅ RESOLVED — #3 Project Title

**Decision:** both — keep Project Type as-is, add a separate `title` field.

**Schema migration given to user:**
```sql
ALTER TABLE project_instances ADD COLUMN title varchar(255);
```
**Built and delivered this session**: `title` added to `addModal.jsx`
(optional field), `editPanel.jsx` (editable), `columns.jsx` (new column,
visible by default, right after Year). **Not yet confirmed**: whether the
user actually ran the migration — verify before assuming the column exists
live.

## ✅ RESOLVED — #4 Inline beneficiary creation in Add Project

**Decision:** nested "+ New" mini-form inside the existing dropdown
(smaller change, not a fully merged modal).

**Built and delivered this session**: `addModal.jsx`'s beneficiary select
has a "+ Add new beneficiary..." option that expands an inline form (Name +
Category required, District/Municipality/Barangay optional) using a new
`addBeneficiary()` mutation added to `useFormData.js`. Mirrors
`addProjectType`'s exact shape (insert, append to local state, return the
new row for immediate selection).

## ✅ RESOLVED — #5 Row click → modal, not an Actions column

**Turned out to already be done** — verified against actual uploaded
`Beneficiaries.jsx` and `Contacts.jsx`. Both tables already have `<tr
onClick={...}>` opening the edit modal, no Actions column, delete moved
inside each modal's Danger Zone. Built by a session prior to this one; no
changes needed. Worth noting: `Contacts.jsx`'s Messenger link correctly
calls `e.stopPropagation()` so it doesn't also trigger the row click.

## ✅ RESOLVED — #6 Modals should be centered, not slide from the side

**Also already done** — verified `BeneficiaryModal.jsx` and
`ContactModal.jsx` both use `fixed inset-0 flex items-center justify-center`
(genuinely centered), distinct from `EditPanel`'s intentional slide-over
pattern. No changes needed.

---

## 🔴 REMAINING — #7 Dedicated comprehensive page per project (MAJOR)

**All previously-open decisions are now answered — do not re-ask:**

1. **Beneficiary editability**: user explicitly confirmed the new page
   should let the beneficiary's **own fields** become genuinely editable in
   place (name, category, district, municipality, barangay) — not just its
   contacts (which `ProjectContacts.jsx` already handles today). This
   **overturns** the documented "beneficiary is immutable after project
   creation" decision in `decisions.md` — that file will need a note added
   once this ships, flagging the decision as superseded.
2. **What replaces `EditPanel`**: a new nested route `/projects/:id`, a real
   page, not an overlay. Migrate `EditPanel`'s sections in as-is where
   possible: Project Info (now including `title` and the Entry Point
   dropdown — see #2/#3 above, already built), Beneficiary (make editable —
   see #1 above), Contacts (`ProjectContacts.jsx`, unchanged), Status,
   Impact, Links, Document Checklist, Danger Zone. Drop the resizable-panel/
   `localStorage['editPanelWidth']` mechanics entirely — a page doesn't need
   drag-to-resize width.
3. **Callers to update**: `Projects.jsx`, `Documents.jsx`, `Overview.jsx`
   currently open `EditPanel` as an overlay — all three need to `navigate()`
   to `/projects/:id` instead.
4. **`?edit=<id>` deep-link fate** — not explicitly decided by the user yet.
   Suggested default (not yet confirmed): redirect `/projects?edit=<id>` to
   `/projects/:id` for backward compatibility with the Dashboard's existing
   overdue/upcoming document links, rather than retiring the pattern
   outright. **Flag this suggested default to the user before committing to
   it** — it's a reasonable inference, not something they explicitly asked
   for.

**Files needed before starting** (none uploaded yet — do not guess at
current content, this project's history has real scar tissue from exactly
that mistake twice already):
```
src/App.jsx
src/components/Navbar.jsx
src/pages/documents/Documents.jsx
src/pages/overview/Overview.jsx
src/hooks/useBeneficiaries.js
```

Also useful but already current as of this session (re-upload only if
they've changed since): `editPanel.jsx`, `addModal.jsx`, `columns.jsx`,
`useFormData.js` — all four already include the Phase 1 work (title, entry
point dropdown, inline beneficiary creation) and are the correct starting
point for migrating `EditPanel`'s content into the new page.

**Suggested build order once files are in hand:**
1. Read all 5 requested files first, in full, before writing anything.
2. Build the new `/projects/:id` page — start from `editPanel.jsx`'s
   existing section structure (`Section`/`Field` components are reusable
   as-is), converting the Beneficiary section from a read-only summary +
   link into real editable fields (mirroring `BeneficiaryModal.jsx`'s
   fields/validation), backed by `useBeneficiaries.js`'s `updateBeneficiary`.
3. Update `App.jsx` to add the `/projects/:id` route.
4. Update `Navbar.jsx` only if it needs a new link (likely not — this is a
   route reached by navigation from existing rows, not a top-level nav item).
5. Update `Projects.jsx`, `Documents.jsx`, `Overview.jsx` to `navigate()`
   instead of opening `EditPanel`.
6. Decide + confirm the `?edit=<id>` redirect question (point 4 above) with
   the user before finalizing.
7. Once shipped, add a note to `decisions.md` that "beneficiary is immutable"
   is superseded, pointing to this change.

---

## Reminder for whoever picks this up

Verify against the live database/filesystem before assuming state — this
project's documented history has already been burned twice by exactly the
opposite (stale `App.jsx`, a stale schema dump implying `project_contacts`
didn't exist). Confirm the `title` column migration was actually run before
building anything that assumes it exists.