# Root — CEST-MIS Project Handoff

**Project**: CEST-Monitoring-and-Information-System
**Type**: React 19 + Vite 8 SPA, deployed on Vercel
**Backend**: Supabase (Postgres 17 + PostgREST + Auth infra, though Auth UI is absent)
**Pinned**: no

---

## What this project does

Internal monitoring and document-compliance tracker for technology-transfer projects deployed to community beneficiaries (LGUs, cooperatives, schools, NGOs, etc.). Tracks:

- **Projects** — a specific technology (Portasol, Water Pump, Solar Dryer, Vermi Composting, etc.) deployed to a beneficiary in a given year
- **Beneficiaries** — the organizations receiving projects
- **Documents** — per-project compliance checklist (MOAs, progress reports, transfer paperwork) tracked through four phases
- **Contacts** — people at each beneficiary
- **Map** — geographic overview of beneficiaries with filters
- **Itinerary** — visit-stop planning for field staff (nearest-neighbor ordering)

Likely DOST-affiliated CEST (Community Empowerment through Science and Technology) program — treat as background context, not confirmed. Evidence: `LOGO-DOST.svg` favicon, `remark_level` enum has `pcest`/`rcest`, deployed technologies match DOST community-transfer projects in the Philippines.

---

## Key root-level files

| File | Purpose | Safe to touch? |
|---|---|---|
| `package.json` | Dependencies, scripts (`dev`/`build`/`lint`/`preview`) | Yes, with care |
| `vite.config.js` | Vite + React plugin + Tailwind plugin | Yes |
| `eslint.config.js` | ESLint flat config | Yes |
| `vercel.json` | SPA rewrite rule for deployment | Only if changing routing/hosting |
| `index.html` | App shell — title + favicon are project-specific | Yes |
| `schema.sql` | **Empty file** — the authoritative schema is `supabase_backup.sql` | Safe, but don't rely on it for schema truth |
| `.env` | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — never commit real values | N/A (local only) |
| `supabase_backup.sql` | Full pg_dump, PostgreSQL 17 — the ground-truth schema source | Read-only reference |

---

## Scripts

```
npm run dev       # vite dev server (localhost:5173)
npm run build     # vite production build
npm run lint      # eslint .
npm run preview   # preview production build
```

No test suite exists.

---

## Environment / setup

- `.env` must contain `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Supabase local config lives in `supabase/config.toml` (project ID: `CEST-Monitoring-and-Information-System`)
- Local Supabase ports: API 54321, DB 54322, Studio 54323, Realtime enabled, Auth enabled, Storage enabled
- Auth site URL: `http://127.0.0.1:3000` (note: dev server runs on 5173, so this mismatch exists — check if relevant)

---

## Known warnings (read before touching anything)

1. **RLS is effectively disabled.** All 7 public tables have an `"allow all"` policy (`USING (true) WITH CHECK (true)`, no role restriction) layered on top of anon-read / authenticated-write policies. Net effect: anonymous users have full read/write. Combined with no auth UI in the app, the current real-world access control is **none**. Documented as a finding, not fixed.
2. **No authentication UI exists anywhere.** Supabase Auth tables exist in the DB but nothing in the app calls `supabase.auth.*`. Treat the app as open/unauthenticated as currently built.
3. **`useProjectContacts.js` queries a table (`project_contacts`) that does NOT exist in the schema dump.** Only 7 tables exist in `public`: `beneficiaries`, `beneficiary_contacts`, `document_types`, `documents`, `project_instances`, `project_types`, `remarks`. The Contacts section inside `EditPanel` will fail at runtime. Before touching project-contact linking, verify against the live database — don't silently "fix" by guessing the schema.
4. **`schema.sql` is empty.** The authoritative schema is `supabase_backup.sql` (or the live database).
5. **`remarks` table exists but appears unused.** No uploaded frontend reads or writes it. Confirm before assuming it's dead.
6. **`document_types.is_default`** is in the schema + seed data but not referenced by any frontend logic. UNKNOWN purpose.
7. **`project_instances.updated_at`** — no trigger found in schema, no app code sets it. UNKNOWN whether it's auto-maintained.

---

## Further reading

- `docs/claude.md` — full project memory, entry point for any session
- `docs/architecture.md` — frontend architecture, routing, data flow, patterns
- `docs/database.md` — full schema, RLS findings, seed-data context
- `docs/business-rules.md` — validation, status logic, document-generation rules
- `docs/important-files.md` — file-by-file guide, what's safe to touch
- `docs/decisions.md` — inferred rationale for notable patterns with confidence levels
- `docs/itinerary.md` — itinerary feature status
- `docs/map-itinerary.md` — map + itinerary feature docs
- `docs/importantFiles.md` — legacy important-files doc (superseded by important-files.md)
- `src/HANDOFF.md` — source tree handoff
- `supabase/HANDOFF.md` — Supabase config + schema handoff
