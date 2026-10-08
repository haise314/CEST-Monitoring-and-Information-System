#!/bin/sh
# Run from the repo root (the folder containing src/)
python3 - <<'PY'
import sys

def patch(path, old, new):
    s = open(path, encoding='utf-8').read()
    n = s.count(old)
    if n != 1:
        sys.exit(f"ABORT {path}: anchor found {n}x -> {old[:60]!r}")
    open(path, 'w', encoding='utf-8').write(s.replace(old, new))
    print("patched", path)

# ── App.jsx: route ──
p = 'src/App.jsx'
patch(p, "import Budget from './pages/budget/Budget'",
         "import Budget from './pages/budget/Budget'\nimport Agencies from './pages/agencies/Agencies'")
patch(p, "{ path: '/budget', element: <Budget /> },",
         "{ path: '/budget', element: <Budget /> },\n      { path: '/agencies', element: <Agencies /> },")

# ── navConfig.jsx: sidebar item + icon ──
p = 'src/components/layout/navConfig.jsx'
patch(p, "// Single source of truth for the sidebar",
"""const AgenciesIcon = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M3 21h18M5 21V8l7-4 7 4v13" />
    <path d="M9 21v-6h6v6M9 11h.01M15 11h.01" />
  </svg>
)

// Single source of truth for the sidebar""")
patch(p, "icon: ContactsIcon },",
         "icon: ContactsIcon },\n      { to: '/agencies', label: 'Agencies', icon: AgenciesIcon },")

# ── useProjects: embed agencies so Projects/search can show them ──
patch('src/hooks/useProjects.js',
      "beneficiaries (id, name, category, district, municipality, barangay)\n        `)",
      "beneficiaries (id, name, category, district, municipality, barangay),\n          project_agencies (role, agencies (id, name))\n        `)")

# ── Projects table: columns ──
p = 'src/pages/projects/columns.jsx'
patch(p, "import StatusCell, { OperationalCell } from './statusCell'",
         "import StatusCell, { OperationalCell } from './statusCell'\nimport { implementingAgency, cooperatingAgencies } from '../../lib/projectAgencies'")
patch(p, "{ accessorKey: 'intervention',",
"""{ accessorFn: r => implementingAgency(r), id: 'implementing_agency', header: 'Implementing Agency', group: 'Core', size: 200, minSize: 120, cell: ({ getValue }) => getValue() ?? '—' },
  { accessorFn: r => cooperatingAgencies(r).join('; '), id: 'cooperating_agencies', header: 'Cooperating Agencies', group: 'Core', size: 220, minSize: 120, cell: ({ getValue }) => getValue() || '—' },
  { accessorKey: 'intervention',""")
patch(p, "  project_scope: true,\n",
         "  project_scope: true,\n  implementing_agency: true,\n  cooperating_agencies: false,\n")

# ── Projects filter chip: Implementing agency ──
p = 'src/pages/projects/filterFields.js'
patch(p, "import { STATIC_OPTIONS } from './columns'",
         "import { STATIC_OPTIONS } from './columns'\nimport { implementingAgency } from '../../lib/projectAgencies'")
patch(p, "  // ── Beneficiary ──",
         "  { id: 'implementing_agency', label: 'Implementing agency', group: 'Core', type: 'select', blankLabel: '(none)', get: p => implementingAgency(p) },\n\n  // ── Beneficiary ──")

# ── Global search ──
p = 'src/components/layout/CommandPalette.jsx'
patch(p, "import { NAV_GROUPS } from './navConfig'",
         "import { NAV_GROUPS } from './navConfig'\nimport { implementingAgency, cooperatingAgencies } from '../../lib/projectAgencies'")
patch(p, "p.intervention, p.overall_status]",
         "p.intervention, p.overall_status, implementingAgency(p), ...cooperatingAgencies(p)]")

# ── ProjectDetail: parties panel at top of right rail ──
p = 'src/pages/projects/ProjectDetail.jsx'
patch(p, "import RemarksSection from './RemarksSection'",
         "import RemarksSection from './RemarksSection'\nimport ProjectParties from './ProjectParties'")
patch(p, '<div className="lg:col-span-1 space-y-6">',
         '<div className="lg:col-span-1 space-y-6">\n      <ProjectParties project={project} beneficiaries={beneficiaries} />')

# ── AddModal: optional Implementing Agency picker ──
p = 'src/pages/projects/addModal.jsx'
patch(p, "import ModalShell from '../../components/common/ModalShell'",
         "import ModalShell from '../../components/common/ModalShell'\nimport { useAgencies } from '../../hooks/useAgencies'\nimport { supabase } from '../../lib/supabase'")
patch(p, "  beneficiary_id:   '',",
         "  beneficiary_id:   '',\n  implementing_agency_id: '',")
patch(p, "const { projectTypes, beneficiaries, entryPoints, loading, addProjectType, addBeneficiary } = useFormData()",
         "const { projectTypes, beneficiaries, entryPoints, loading, addProjectType, addBeneficiary } = useFormData()\n  const { agencies } = useAgencies()")
patch(p, "    const { error, id } = await onAdd(payload)\n    setSaving(null)",
         "    const { error, id } = await onAdd(payload)\n    if (!error && id != null && form.implementing_agency_id) {\n      await supabase.from('project_agencies').insert({\n        project_id: id, agency_id: Number(form.implementing_agency_id), role: 'implementing',\n      })\n    }\n    setSaving(null)")
patch(p, '<Group title="Optional details">',
"""<Group title="Implementing agency">
            <Field label="Implementing Agency" className="sm:col-span-2" hint="Optional. Add cooperating agencies and more beneficiaries on the project's full page.">
              <SearchableSelect
                value={form.implementing_agency_id}
                onChange={v => handleChange('implementing_agency_id', v)}
                options={agencies.map(a => ({ value: a.id, label: a.type ? `${a.name} (${a.type})` : a.name }))}
                placeholder="Select implementing agency..."
                searchPlaceholder="Search agencies..."
                className={inputClass}
              />
            </Field>
          </Group>

          <Group title="Optional details">""")

# ── Backup page labels ──
patch('src/pages/backup/Backup.jsx', "'Annual budgets',",
      "'Annual budgets',\n  agencies:             'Agencies',\n  project_agencies:     'Project–agency links',\n  project_beneficiaries: 'Additional beneficiaries',")
PY