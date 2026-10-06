# CEST-MIS — Handoff Addendum (current work)

Supplements `AI_HANDOFF.md` (do not rewrite that file). Where the two conflict, **this file wins** for the items below. Labels: `CONFIRMED` · `INFERENCE` · `UNKNOWN` · `OPEN`.

## 1. Status

| Item | Status |
|---|---|
| Dark-mode select/dropdown fix | **DONE (pending user check in Brave/Firefox, Windows)**. Global rule appended to `theme.css` (`.dark select, option, optgroup` get `--surface` bg + `--color-gray-800` text). Covers raw `<select>`s; the `Select` wrapper stays valid. |
| Paging fix for `useAllDocuments` (1000-row cap) | NEXT (small) |
| Project types: add / rename / delete from project page | PLANNED |
| Searchable combobox for beneficiary + contact pickers | PLANNED |
| Contacts overhaul (standalone, many-to-many) | PLANNED (needs SQL migration) |
| Contact picker on project creation; reassign beneficiary on project page | OPTIONAL, only if easy |

## 2. User decisions

1. **Contacts are many-to-many with beneficiaries**, and may belong to **no** beneficiary or project. Reason: some important people don't belong to any beneficiary but must still be displayed.
2. Contact picker on project creation: do it only if quick; otherwise skip.
3. Reassigning a project's beneficiary (and creating one inline) on the project page: only if easy. This would reverse the current "beneficiary fixed at creation" rule.
4. **Project types: add, rename and delete.** The user is the admin and almost the only user. `project_types` RLS already allows admin UPDATE and DELETE (`CONFIRMED`), so no policy change is needed. Buttons should be admin-only. Deleting a type still used by projects fails (FK `NO ACTION`), so block it in the UI the way beneficiary delete is blocked. Renaming affects every project using that type.
5. Environment: Brave/Firefox on Windows. Global CSS fix preferred over per-select fixes.

## 3. Data scale (user-reported)

- About 80–100 projects; each has 2–5 contacts, so roughly 200–500 contacts plus standalone ones.
- **OPEN:** the user said ~94% "have one beneficiary", the rest up to 8. The schema allows exactly **one** beneficiary per project (`project_instances.beneficiary_id NOT NULL`). Probably this meant projects *per beneficiary*, but confirm; if projects really can have several beneficiaries, that is a larger schema change.
- 100 projects is fine for fetch-all pages. The real scale risk is the Supabase **1000-row response cap**: documents ≈ projects × checklist size will likely exceed it, silently skewing Dashboard, Documents and Map. Fix by looping `.range()` in `useAllDocuments` (or raising max rows). Check `select count(*) from documents;`.
- Beneficiary/contact dropdowns with this many options need a **searchable combobox** (themed with CSS variables); keep native `Select` for short enums.

## 4. Planned design

**Project types:** a small manage UI (add, rename, delete) plus "+ Add new project type" in `ProjectDetail`; `useFormData.addProjectType` already exists. Extract the repeated inline-create widgets (currently in `addModal`, `editPanel`, `ProjectDetail`) into one shared component.

**Contacts:**
- Keep table name `beneficiary_contacts` (backup functions, RLS and hooks reference it).
- New table `beneficiary_contact_links(id, beneficiary_id → beneficiaries CASCADE, contact_id → beneficiary_contacts CASCADE, created_at, UNIQUE(beneficiary_id, contact_id))`, mirroring `project_contacts`; RLS: members read, editors insert/update/delete.
- Migration: create links, copy from existing `beneficiary_contacts.beneficiary_id`, make that column **nullable** (do not drop yet).
- Update `backup_export` / `backup_restore` table lists (links table after both parents).
- Frontend: `useContacts`, `useBeneficiaryContacts`, `useProjectContacts`, `ContactModal` (beneficiary optional, multi-select), `Contacts.jsx` + columns (beneficiary/municipality become lists), `BeneficiaryModal` (contacts section), `ProjectContacts` (pick from **all** contacts, Edit button opening `ContactModal`, "+ New contact" that creates and links), `CommandPalette` haystack.
- Optional: `addProject` returns the new id so contacts can be linked on creation.

## 5. Concerns

- **Backup first:** download a backup from `/backup` before running the contacts migration.
- **Old backup compatibility:** restoring a pre-migration backup would not recreate links (`jsonb_populate_recordset` ignores unknown keys). Keep `beneficiary_id` nullable until a fresh post-migration backup exists, or add a conversion step in `backup_restore`.
- **Shared edits:** editing a contact from a project page changes it everywhere it is linked; the UI should say so (same as beneficiary editing).
- **Deleting a beneficiary** will now only remove links; contacts survive (previously cascade-deleted).
- **New selects:** the global CSS rule covers them, but prefer the `Select` wrapper for consistency.
- All other hazards in `AI_HANDOFF.md` §9 still apply (enum duplication, `editPanel` ↔ `ProjectDetail` duplicated logic, dead files).
