# `docs/` — Documentation Handoff

All documentation lives here. The docs are well-developed and grounded in actual code inspection (not assumptions). Use them as the primary reference for any session working on this project.

---

## File inventory

| File | Purpose | Status |
|---|---|---|
| `claude.md` | **Entry point for any session.** Full project memory built from a full source upload + Supabase pg_dump across a review conversation. Read this first. | Active, authoritative |
| `architecture.md` | Full frontend architecture: routing, state management, data flow, services/hooks, auth flow, external integrations, implementation patterns | Active, authoritative |
| `database.md` | Full schema (all 7 public tables + enums + FKs), RLS findings, seed-data context, storage usage, schema/code conflicts | Active, authoritative |
| `business-rules.md` | CONFIRMED vs INFERENCE rules: document status/completion, overdue/upcoming, progress calculation, document generation algorithm, validation, dashboard attention flags, status vocabularies | Active, authoritative |
| `decisions.md` | Notable architectural/implementation patterns with evidence + confidence labels (CONFIRMED / INFERENCE): no global state, manual sticky columns, dynamic pivot columns, duplicated color maps, additive-only doc generation, optional docs default N/A, immutable beneficiary, deep-link query params, RLS allow-all policies, no schema-validation library | Active, authoritative |
| `important-files.md` | File-by-file guide: central/high-blast-radius files, safe-to-modify files, duplicate/orphaned files with canonical vs dead copies, hook dependency table, import graph highlights | Active, authoritative |
| `itinerary.md` | Itinerary feature: files dropped in, wiring instructions, open questions (office location, non-transactional saveStops, one-day-per-itinerary), try-it instructions | Active |
| `map-itinerary.md` | Map + itinerary feature documentation (companion to itinerary.md) | Active |
| `importantFiles.md` | Legacy important-files doc — **superseded by `important-files.md`** (note the hyphen difference). May contain outdated info from an earlier upload batch. | Likely stale — prefer `important-files.md` |
| `business rules.md` | Legacy copy with a space in the filename — **superseded by `business-rules.md`** | Likely stale — prefer `business-rules.md` |

---

## Conventions used in these docs

- **CONFIRMED** = directly implemented in code, verified against actual files
- **INFERENCE** = implied but not explicitly stated; supported by evidence but not confirmed
- **UNKNOWN** = cannot determine from uploaded code / schema dump
- Nothing is invented beyond what the uploaded code supports

---

## Docs are the source of truth for...

- What's central vs safe to touch (see `important-files.md`)
- Which files are duplicates/orphaned and which copy is canonical
- The document generation algorithm (additive-only, optional docs default N/A)
- The RLS state (effectively disabled — documented as a finding, not fixed)
- The `project_contacts` table doesn't exist (verified against full schema dump)
- The `remarks` table exists but appears unused
- All enum definitions and their meanings
- The "accomplished"/"complete" check is duplicated across two files and must stay in sync

---

## See also

- `HANDOFF_ROOT.md` — project overview + all warnings
- `HANDOFF.md` (in `src/`) — source tree handoff
