# Business Rules — CEST-MIS

Rules below are labeled **CONFIRMED** (directly implemented in code, verified
against the actual files) or **INFERENCE** (implied but not explicitly
stated). None are invented beyond what the uploaded code supports.

## Document Status & Completion

**CONFIRMED** — `src/lib/documentStatus.js` and `src/lib/documentProgress.js`.

A document's status, from `getDocStatus(doc)`, in strict priority order:
1. `na` — `is_not_applicable = true` (or the document row doesn't exist at all for this project)
2. `submitted` — `submitted = true`
3. `hard` — `has_hard_copy = true`
4. `soft` — `gdrive_link` is set
5. `claimable` — `hard_copy_claimable = true`
6. `none` — nothing on file

A document counts as **"accomplished" / "complete"** if **any** of `submitted`,
`has_hard_copy`, `gdrive_link`, or `hard_copy_claimable` is truthy — this is
intentionally independent of the status-priority ranking above. This exact
check is duplicated in two places (`isAccomplished()` in `documentStatus.js`
and `isComplete()` in `documentProgress.js`) with **a code comment explicitly
requiring both be kept in sync** if changed.

**N/A documents are excluded from both the numerator and denominator** of any
completion percentage — they don't count against or toward compliance.

## Overdue / Upcoming

**CONFIRMED** — `documentStatus.js`.
- **Overdue**: has an `expected_date` in the past, is not N/A, and is not
  accomplished (per the definition above).
- **Upcoming**: due within the next `UPCOMING_WINDOW_DAYS` (= **14 days**),
  not already overdue, not accomplished, not N/A.
- A document with no `expected_date` is never overdue or upcoming.

## Progress Calculation

**CONFIRMED** — `documentProgress.js`'s `computeProgress(documents)`:
- Computed once per phase (`Pre-Implementation`, `Semi-Annual`, `Annual`,
  `Transfer`) and once overall.
- `pct = round(completeCount / applicableCount * 100)`, or `0` if
  `applicableCount === 0`.
- Progress bar color (shared across every progress bar in the app via
  `progressBarColor(pct)`): green at 100%, blue at ≥50%, yellow below 50%.

## Document Generation

**CONFIRMED** — `useDocuments.js`'s `generateDocuments(projectCategory)`,
triggered by the "Generate Checklist" / "Sync missing documents" button in
`DocumentChecklist.jsx`:

1. A project must have a `project_category` set (`In-house` or `Fund
   Transfer`) before any documents can be generated — enforced both in the
   UI (`DocumentChecklist` won't show the button without it) and by the
   function itself.
2. Fetch every `document_types` row where `phase IS NOT NULL` and
   `applies_to IN ('Both', projectCategory)`.
3. Skip any type the project already has a `documents` row for.
4. Insert one new `documents` row per remaining type:
   - `submitted = has_hard_copy = hard_copy_claimable = false`
   - **`is_not_applicable = !document_types.is_required`** — optional
     document types are auto-marked N/A on creation; the user must manually
     un-mark them if they turn out to be applicable.
5. **Never deletes existing `documents` rows.** Running it again ("Sync
   missing documents") only adds newly-applicable types; it does not remove
   ones that are no longer applicable.

## Project Category Change Warning

**CONFIRMED** — `editPanel.jsx`. If a user changes `project_category` on a
project that already had a category (i.e., not the first time it's set), the
UI shows a confirmation warning before saving:
> "New required documents will be added to the checklist. Existing documents
> will not be removed — please review and mark any that no longer apply as N/A."

This is a **manual cleanup responsibility placed on the user** — the system
does not automatically reconcile documents to a changed category.

## Beneficiary Deletion Guard

**CONFIRMED** — `Beneficiaries.jsx` + `useBeneficiaries.js`. A beneficiary can
only be deleted if it has zero linked `project_instances` (checked via an
embedded `project_instances(count)` in the fetch query). This mirrors the DB
constraint: `project_instances.beneficiary_id` is a `NO ACTION` (non-cascading)
foreign key, so an unguarded delete would otherwise surface a raw Postgres
FK-violation error to the user. The code includes a defensive re-check after
delete in case the count changes between load and click (e.g. another
browser tab adding a project mid-session).

By contrast, `beneficiary_contacts.beneficiary_id` **is** `ON DELETE CASCADE`
— deleting a beneficiary silently deletes its contacts too, no guard needed
or present.

## Required Fields (Validation)

**CONFIRMED**, client-side only (no DB-level `NOT NULL` beyond what's listed
in `database.md`):
- **Beneficiary**: `name`, `category` required (`BeneficiaryModal.jsx`).
- **Contact**: `beneficiary_id`, `name` required (`ContactModal.jsx`).
- **Project (Add)**: `year`, `project_type_id`, `beneficiary_id`,
  `project_category` required (`addModal.jsx`). Numeric fields (`amount`,
  `interventions_count`, `people_trained`) coerced to `Number` or `null` if
  blank.
- All validation is a simple truthiness check with an inline error message —
  no schema library (no Zod/Yup) is used anywhere in the uploaded code.

## Dashboard "Attention Flags" (derived business rules, UI-only)

**CONFIRMED as implemented, but these are UI heuristics, not database
constraints** — `Dashboard.jsx`'s `AttentionFlagsSection`:
1. Projects with no `project_category` set — flagged because documents can't
   be generated for them.
2. Projects that have a `project_category` but zero `documents` rows —
   flagged as "category set but checklist never generated."
3. Projects still at the default `overall_status` of `'For Deployment'` but
   whose `date_deployed` is more than 30 days in the past — flagged as
   "likely forgot to update status" (comment in the code states this
   reasoning explicitly).

## Status Vocabularies (Confirmed Enums, See database.md for Full Detail)

- `overall_status` (project lifecycle): For Deployment → For Implementation
  → For Monitoring → (For Transfer → Transfer Ongoing → Fully Transferred)
  or (For Pull Out) → Done. **INFERENCE**: the ordering implied by
  `OVERALL_STATUS_ORDER` in `Dashboard.jsx` and `columns.jsx` suggests this
  general progression, but no state-machine/transition-validation code
  exists anywhere — the DB and UI both allow setting `overall_status` to any
  enum value at any time via a plain `<select>`. Treat the "flow" as
  documentation of intent, not an enforced rule.
- `operational_status`: Operational / Non-operational / For Repair &
  Maintenance — independent of `overall_status`, describes the physical
  equipment's condition post-deployment. No transition rules found.
- `document_phase`: Pre-Implementation → Semi-Annual → Annual → Transfer —
  same caveat: ordering is implied by `PHASE_ORDER` constant, not enforced.

## Uncertain / Unconfirmed

- Whether `project_instances.updated_at` is auto-maintained by a DB trigger —
  no trigger was found in the schema dump, and no application code sets it
  explicitly either. **UNKNOWN.**
- The `remarks` table's intended business purpose — schema and enum
  (`provincial`/`regional`/`pcest`/`rcest`) suggest a leveled commenting/audit
  system, but no uploaded UI reads or writes it. **UNKNOWN** whether a
  Remarks feature exists elsewhere or was removed/never built.
- `document_types.is_default` — present in the schema and seed data but not
  referenced by any uploaded frontend logic. **UNKNOWN purpose.**