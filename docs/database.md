# Database — CEST-MIS (Supabase / Postgres)

Source: a full `pg_dump` (`supabase_backup.sql`, PostgreSQL 17) uploaded to
this conversation. The project's own `schema.sql` file was **empty** — this
dump is the only and authoritative schema source used for this documentation.

Only the `public` schema is application-relevant; `auth`, `storage`, and
`realtime` schemas are standard Supabase infrastructure and are not detailed
here beyond noting they exist.

## Tables (`public` schema)

### `project_types`
Lookup table for the kind of technology deployed.
| Column | Type | Notes |
|---|---|---|
| `id` | integer, PK | |
| `name` | varchar(100), **UNIQUE** | |

Seed data observed: `Portasol`, `Water Pump`, `Solar Dryer`, `Vermi Composting`.

### `beneficiaries`
| Column | Type | Notes |
|---|---|---|
| `id` | integer, PK | |
| `name` | varchar(255), NOT NULL | |
| `category` | enum `beneficiary_category`, NOT NULL | LGU, Academe, SDO, NGO, Cooperative, Others, BLGU |
| `district` | varchar(100), nullable | |
| `municipality` | varchar(100), nullable | |
| `barangay` | varchar(100), nullable | |

### `beneficiary_contacts`
| Column | Type | Notes |
|---|---|---|
| `id` | integer, PK | |
| `beneficiary_id` | integer, **FK → beneficiaries(id) ON DELETE CASCADE** | |
| `name` | varchar(255), NOT NULL | |
| `role` | varchar(100), nullable | |
| `contact_number` | varchar(50), nullable | |
| `messenger_link` | text, nullable | |

### `project_instances`
The central table — one row per deployed project.
| Column | Type | Notes |
|---|---|---|
| `id` | integer, PK | |
| `year` | smallint, NOT NULL | |
| `project_type_id` | integer, **FK → project_types(id)**, NOT NULL, no cascade rule | |
| `beneficiary_id` | integer, **FK → beneficiaries(id)**, NOT NULL, **NO ACTION (no cascade)** — deleting a beneficiary with projects fails at the DB; app blocks this client-side | |
| `property_number` | varchar(100), nullable | |
| `amount` | numeric(12,2), nullable | |
| `date_deployed` | date, nullable | |
| `entry_point` | varchar(255), nullable | free text; seed data shows both beneficiary-category-like values ("LGU", "NGO") and garbage test values — not a controlled vocabulary in the DB, though the UI treats it as one via distinct-value dropdowns |
| `intervention` | text, nullable | |
| `members_male`, `members_female`, `senior_citizen`, `pwds`, `fourps`, `ips` | integer, default 0 | demographic counts of people served |
| `operational_status` | enum `operational_status`, nullable | Operational, Non-operational, For Repair & Maintenance |
| `interventions_count` | integer, default 0 | |
| `people_trained` | integer, default 0 | |
| `impact_notes` | text, nullable | |
| `overall_status` | enum `overall_status`, NOT NULL, default `'For Deployment'` | For Deployment, For Implementation, For Monitoring, For Transfer, Transfer Ongoing, Fully Transferred, For Pull Out, Done |
| `gdrive_folder_link` | text, nullable | |
| `created_at`, `updated_at` | timestamptz, default now() | **no trigger observed to auto-update `updated_at`** — treat as set-once unless proven otherwise (UNKNOWN) |
| `project_category` | enum `project_category`, nullable | In-house, Fund Transfer — **nullable**, and its absence is treated as meaningful by the app (Dashboard flags "projects missing a category") |

### `document_types`
Lookup/template table — defines what documents *should* exist.
| Column | Type | Notes |
|---|---|---|
| `id` | integer, PK | |
| `name` | varchar(255), NOT NULL | |
| `is_default` | boolean, NOT NULL, default true | present in seed data but not read by any uploaded frontend code — UNKNOWN purpose |
| `phase` | enum `document_phase`, nullable | Pre-Implementation, Semi-Annual, Annual, Transfer |
| `applies_to` | enum `document_applies_to`, NOT NULL, default `'Both'` | Both, In-house, Fund Transfer |
| `is_required` | boolean, NOT NULL, default true | drives auto-N/A on generation, see business-rules.md |

**UNIQUE (name, phase)**

### `documents`
Per-project checklist rows, one per applicable `document_type` (or custom).
| Column | Type | Notes |
|---|---|---|
| `id` | integer, PK | |
| `project_id` | integer, **FK → project_instances(id) ON DELETE CASCADE**, NOT NULL | |
| `document_type_id` | integer, **FK → document_types(id)**, nullable | |
| `custom_label` | varchar(255), nullable | |
| `expected_date` | date, nullable | |
| `submitted` | boolean, NOT NULL, default false | |
| `submitted_date` | date, nullable | |
| `notes` | text, nullable | |
| `has_hard_copy` | boolean, NOT NULL, default false | |
| `hard_copy_claimable` | boolean, NOT NULL, default false | |
| `gdrive_link` | text, nullable | |
| `is_not_applicable` | boolean, NOT NULL, default false | |

**CHECK constraint** `document_label_check`: `document_type_id IS NOT NULL OR custom_label IS NOT NULL` — every document must be either a typed document or a custom one.

### `remarks`
| Column | Type | Notes |
|---|---|---|
| `id` | integer, PK | |
| `project_id` | integer, **FK → project_instances(id) ON DELETE CASCADE**, NOT NULL | |
| `level` | enum `remark_level`, NOT NULL | provincial, regional, pcest, rcest |
| `content` | text, NOT NULL | |
| `added_by` | varchar(255), nullable | free text, not a user FK (no auth linkage) |
| `created_at` | timestamptz, default now() | |

No `remarks` seed data was present, and **no uploaded frontend file reads or writes this table** — it exists in the schema but appears entirely unused by the current UI. Confirm before assuming it's dead, since no page for it may simply not have been uploaded.

## ⚠️ Schema/Code Conflict: missing `project_contacts` table

`src/hooks/useProjectContacts.js` performs `supabase.from('project_contacts')`
reads/writes (`id`, `project_id`, `contact_id`, joined to
`beneficiary_contacts`), used by `ProjectContacts.jsx` inside `EditPanel`'s
Contacts section. **No `project_contacts` table exists anywhere in the
`supabase_backup.sql` dump.** This was verified by grepping the entire dump
for `project_contacts` and `contact_id` — zero matches outside the hook file
itself.

Possible explanations (none confirmed — do not assume one over the others):
- The table was added to the live database after this backup was taken.
- The table exists but wasn't included in this particular dump for some reason.
- This is a genuine bug — the feature was coded against a schema that was
  never actually migrated.

**Action for any future session**: verify against the live database before
assuming which case applies. If the table truly doesn't exist, this is a
straightforward migration to write (a join table: `id serial pk, project_id
fk → project_instances, contact_id fk → beneficiary_contacts`), but don't
create it speculatively without confirming with the project owner.

## Row Level Security

RLS is **enabled** on all 7 public tables. Each has **three overlapping
policies**:
1. `"Allow anon read"` — `SELECT` only, role `anon`, `USING (true)`
2. `"Allow authenticated users"` — all operations, role `authenticated`, `USING (true) WITH CHECK (true)`
3. `"allow all"` — all operations, **no role restriction**, `USING (true) WITH CHECK (true)`

Because policy #3 applies to every role including `anon`, **the net effect is
that anonymous users have full read/write access to every table**, making
policies #1 and #2 redundant in practice. Combined with there being no
authentication UI in the app (see `architecture.md`), the current real-world
access control is: **none**. This is documented as a finding, not fixed here.

## Authentication-Related Data

Standard Supabase `auth.*` tables exist (`auth.users`, `auth.sessions`,
`auth.identities`, `auth.mfa_factors`, `auth.oauth_*`, etc.) but are not
referenced by any uploaded application code. `remarks.added_by` and
`documents`/`project_instances` have no user-attribution columns — there is
no way in the current schema to know *who* made a given edit.

## Storage Usage

`storage.buckets`/`storage.objects` tables exist (standard Supabase Storage
infrastructure) but no uploaded frontend code calls `supabase.storage.*`.
File "attachments" in this app are all just plain URL text fields pointing to
external Google Drive links, not Supabase Storage objects.

## Important Database Assumptions Made by the App

- A project's `beneficiary_id` is fixed at creation — the UI (`EditPanel`)
  never offers to change it, though nothing in the schema itself prevents an
  `UPDATE ... SET beneficiary_id = ...`.
- `document_types.applies_to = 'Both'` means the type applies regardless of
  `project_category`; app logic filters `document_types` by
  `applies_to IN ('Both', <project's category>)`.
- `documents.document_type_id IS NULL` implies a custom document
  (`custom_label` is used instead) — the CHECK constraint enforces this at
  the DB level, but no uploaded UI code currently creates custom documents
  (only `document_type_id`-based ones are generated by `generateDocuments`).