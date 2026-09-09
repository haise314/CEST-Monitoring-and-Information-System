# `src/lib/` — Utilities + Supabase Client Handoff

Pure functions and the one Supabase client instance. No I/O in the pure-function files.

---

## Files

### `supabase.js` — the one Supabase client

- Creates a single Supabase client from `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
- Every hook imports this same client
- Creates the client with only the anon key — no `supabase.auth.*` calls anywhere in the app
- **No authentication flow exists.** Treat the app as effectively open/unauthenticated as currently built

### `documentStatus.js` — document status logic (pure functions, no I/O)

**Central file — must be kept in sync with `documentProgress.js`.** An explicit code comment in `documentProgress.js` states these must stay in sync if changed.

- `getDocStatus(doc)` → `'na' | 'none' | 'claimable' | 'soft' | 'hard' | 'submitted'` (strict priority order)
- `statusRank(doc)` → numeric rank for sorting (used by `Documents.jsx`'s custom `sortingFn`)
- `isOverdue(doc)` — has `expected_date` in past, not N/A, not accomplished
- `isUpcoming(doc, days = 14)` — due within next 14 days, not overdue, not accomplished, not N/A
- `DOC_CONDITIONS` — array of `{ id, label, test(doc) }`, powers the "Find documents: [type] that are [condition]" query builder in `documents/filterBar.jsx`

Document status priority (high → low): `submitted` → `hard` (has_hard_copy) → `soft` (gdrive_link) → `claimable` (hard_copy_claimable) → `none` → `na` (is_not_applicable).

A document counts as **"accomplished"/"complete"** if **any** of `submitted`, `has_hard_copy`, `gdrive_link`, or `hard_copy_claimable` is truthy — intentionally independent of the status-priority ranking above. This exact check is duplicated in two places (`isAccomplished()` in `documentStatus.js` and `isComplete()` in `documentProgress.js`) — keep them in sync.

### `documentProgress.js` — progress calculation (pure functions)

- `computeProgress(documents)` → `{ byPhase, overallPct, totalApplicable, totalComplete }`
- Computed once per phase (`Pre-Implementation`, `Semi-Annual`, `Annual`, `Transfer`) and once overall
- `pct = round(completeCount / applicableCount * 100)`, or `0` if `applicableCount === 0`
- `progressBarColor(pct)` → Tailwind class, shared by every progress bar in the app (Dashboard, Overview, DocumentChecklist) so color meaning stays consistent: green at 100%, blue at ≥50%, yellow below 50%
- `PHASE_ORDER = ['Pre-Implementation', 'Semi-Annual', 'Annual', 'Transfer']`

**Must be kept in sync with `documentStatus.js`'s duplicate `isAccomplished` check** (explicit code comment).

### `geo.js` — geographic utilities (new, for itinerary/map)

- Part of the itinerary feature drop-in
- See `docs/itinerary.md`

### `officeLocation.js` — office location config (new, placeholder)

- `OFFICE_LOCATION` is `null` — set to actual office lat/lng for auto-order to start from there; otherwise starts from first stop added
- See `docs/itinerary.md`

### `beneficiaryFilters.js` — optional future reuse (new)

- Duplicates logic already inline in Map.jsx — optional later swap to de-duplicate
- See `docs/itinerary.md`

### `Leafleticon.js` — custom Leaflet icon helper

- Used by Map page for custom markers

---

## See also

- `HANDOFF.md` — source tree overview
- `HANDOFF_HOOKS.md` — data-fetching hooks
- `docs/business-rules.md` — document status/completion rules, generation algorithm
- `docs/important-files.md` — file criticality ratings
