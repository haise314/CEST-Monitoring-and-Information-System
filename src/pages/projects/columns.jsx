import { Link } from 'react-router'
import StatusCell, { OperationalCell } from './statusCell'
import { implementingAgency, cooperatingAgencies } from '../../lib/projectAgencies'

// Strips currency symbols, commas, and stray spaces before parsing —
// so typing "285,000" or "₱285,000" works the same as "285000". Returns
// null for empty/invalid input rather than NaN, so it's safe to send
// straight to Supabase's numeric(12,2) column. This is almost certainly
// the fix for "Amount is not saving": a plain <input type="number">
// silently rejects commas, so typing an amount the natural way (with
// thousands separators — the same way the table displays it back) could
// leave the field empty with no error shown, saving as null.
export function parseAmount(raw) {
  if (raw == null || raw === '') return null
  const cleaned = String(raw).replace(/[₱$,\s]/g, '')
  if (cleaned === '') return null
  const num = Number(cleaned)
  return Number.isNaN(num) ? null : num
}

// Provincial projects count against the yearly budget; Regional ones don't
// (see lib/budget.js). Labels are what people see; the values are what's stored.
export const SCOPE_OPTIONS = [
  { value: 'Provincial', label: 'Provincial Project' },
  { value: 'Regional',   label: 'Regional Project' },
]

function ProjectScopeCell({ getValue }) {
  const value = getValue()
  const colors = {
    Provincial: 'bg-blue-100 text-blue-800',
    Regional:   'bg-purple-100 text-purple-800',
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${colors[value] ?? 'bg-gray-100 text-gray-800'}`}>
      {value ?? '—'}
    </span>
  )
}

// ─── Project Category Cell ────────────────────────────────────────────────────

function ProjectCategoryCell({ getValue }) {
  const value = getValue()
  const colors = {
    'In-house':      'bg-indigo-100 text-indigo-800',
    'Fund Transfer': 'bg-teal-100 text-teal-800',
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${colors[value] ?? 'bg-gray-100 text-gray-800'}`}>
      {value ?? '—'}
    </span>
  )
}

// ─── Detail Link Cell ─────────────────────────────────────────────────────────
// Opens the full /projects/:id page. stopPropagation so it doesn't also
// trigger the row's onClick (which opens the EditPanel quick-edit overlay).

function DetailLinkCell({ row }) {
  return (
    <Link
      to={`/projects/${row.original.id}`}
      onClick={e => e.stopPropagation()}
      title="Open full page"
      className="text-blue-400 hover:text-blue-600"
    >
      ↗
    </Link>
  )
}

// ─── Column Definitions ───────────────────────────────────────────────────────

export const ALL_COLUMNS = [
  // ACTIONS
  { id: 'detail_link', header: '', group: 'Core', size: 36, minSize: 36, enableSorting: false, cell: DetailLinkCell },

  // CORE
  { accessorKey: 'year',             header: 'Year',             group: 'Core', size: 80,  minSize: 60,  cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'title',            header: 'Title',            group: 'Core', size: 280, minSize: 120, cell: ({ getValue }) => getValue() ?? '—' },
  { accessorFn: r => r.project_types?.name, id: 'project_type', header: 'Project Type', group: 'Core', size: 150, minSize: 100, cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'project_category', header: 'Category',         group: 'Core', size: 130, minSize: 100, cell: ProjectCategoryCell },
  { accessorKey: 'project_scope',    header: 'Scope',            group: 'Core', size: 110, minSize: 90,  cell: ProjectScopeCell },
  { accessorFn: r => implementingAgency(r), id: 'implementing_agency', header: 'Implementing Agency', group: 'Core', size: 200, minSize: 120, cell: ({ getValue }) => getValue() ?? '—' },
  { accessorFn: r => cooperatingAgencies(r).join('; '), id: 'cooperating_agencies', header: 'Cooperating Agencies', group: 'Core', size: 220, minSize: 120, cell: ({ getValue }) => getValue() || '—' },
  { accessorKey: 'intervention',     header: 'Intervention',     group: 'Core', size: 220, minSize: 120, cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'property_number',  header: 'Property No.',     group: 'Core', size: 140, minSize: 100, cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'amount',           header: 'Amount',           group: 'Core', size: 130, minSize: 100, cell: ({ getValue }) => getValue() != null ? `₱${Number(getValue()).toLocaleString()}` : '—' },
  { accessorKey: 'date_deployed',    header: 'Date Deployed',    group: 'Core', size: 130, minSize: 100, cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'entry_point',      header: 'Entry Point',      group: 'Core', size: 150, minSize: 100, cell: ({ getValue }) => getValue() ?? '—' },

  // BENEFICIARY
  { accessorFn: r => r.beneficiaries?.name,         id: 'beneficiary',  header: 'Beneficiary',  group: 'Beneficiary', size: 200, minSize: 120, cell: ({ getValue }) => getValue() ?? '—' },
  { accessorFn: r => r.beneficiaries?.category,     id: 'category',     header: 'Category',     group: 'Beneficiary', size: 120, minSize: 90,  cell: ({ getValue }) => getValue() ?? '—' },
  { accessorFn: r => r.beneficiaries?.district,     id: 'district',     header: 'District',     group: 'Beneficiary', size: 130, minSize: 90,  cell: ({ getValue }) => getValue() ?? '—' },
  { accessorFn: r => r.beneficiaries?.municipality, id: 'municipality', header: 'Municipality', group: 'Beneficiary', size: 150, minSize: 100, cell: ({ getValue }) => getValue() ?? '—' },
  { accessorFn: r => r.beneficiaries?.barangay,     id: 'barangay',     header: 'Barangay',     group: 'Beneficiary', size: 150, minSize: 100, cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'members_male',    header: 'Male Members',   group: 'Beneficiary', size: 110, minSize: 90, cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'members_female',  header: 'Female Members', group: 'Beneficiary', size: 120, minSize: 90, cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'senior_citizen',  header: 'Senior Citizen', group: 'Beneficiary', size: 120, minSize: 90, cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'pwds',            header: 'PWDs',           group: 'Beneficiary', size: 90,  minSize: 70, cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'fourps',          header: '4Ps',            group: 'Beneficiary', size: 90,  minSize: 70, cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'ips',             header: 'IPs',            group: 'Beneficiary', size: 90,  minSize: 70, cell: ({ getValue }) => getValue() ?? '—' },

  // STATUS & IMPACT
  { accessorKey: 'overall_status',      header: 'Overall Status', group: 'Status & Impact', size: 160, minSize: 120, cell: StatusCell },
  { accessorKey: 'operational_status',  header: 'Operational',    group: 'Status & Impact', size: 150, minSize: 110, cell: OperationalCell },
  { accessorKey: 'interventions_count', header: 'Interventions',  group: 'Status & Impact', size: 110, minSize: 90,  cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'people_trained',      header: 'People Trained', group: 'Status & Impact', size: 120, minSize: 90,  cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'impact_notes',        header: 'Impact Notes',   group: 'Status & Impact', size: 250, minSize: 120, cell: ({ getValue }) => getValue() ?? '—' },

  // DOCUMENTS
  {
    accessorKey: 'gdrive_folder_link',
    header: 'GDrive Link',
    group: 'Documents',
    size: 110,
    minSize: 90,
    cell: ({ getValue }) => getValue()
      ? <a href={getValue()} target="_blank" rel="noreferrer" className="text-blue-500 underline text-xs">Open</a>
      : '—',
  },
]

// ─── Visibility Defaults ──────────────────────────────────────────────────────

export const DEFAULT_VISIBLE = {
  // Always visible, not user-toggleable via VisibilityPanel unless it
  // already treats unlisted-but-present keys as visible-by-default — if
  // VisibilityPanel iterates ALL_COLUMNS and defaults missing keys to true,
  // this entry is optional; included here explicitly to be safe.
  detail_link: true,
  // Visible by default
  year: true,
  title: true,
  project_type: true,
  project_category: true,
  project_scope: true,
  implementing_agency: true,
  cooperating_agencies: false,
  beneficiary: true,
  municipality: true,
  barangay: true,
  property_number: true,
  amount: true,
  overall_status: true,
  operational_status: true,
  // Hidden by default
  intervention: false,
  date_deployed: false,
  entry_point: false,
  category: false,
  district: false,
  members_male: false,
  members_female: false,
  senior_citizen: false,
  pwds: false,
  fourps: false,
  ips: false,
  interventions_count: false,
  people_trained: false,
  impact_notes: false,
  gdrive_folder_link: false,
}

// ─── Filter Config ────────────────────────────────────────────────────────────

export const FILTERABLE_COLUMN_IDS = [
  'year', 'project_category', 'municipality', 'barangay', 'district',
  'category', 'overall_status', 'operational_status', 'project_type', 'entry_point',
]

export const FILTER_LABELS = {
  year: 'Year',
  project_category: 'Project Category',
  municipality: 'Municipality',
  barangay: 'Barangay',
  district: 'District',
  category: 'Beneficiary Category',
  overall_status: 'Overall Status',
  operational_status: 'Operational',
  project_type: 'Project Type',
  entry_point: 'Entry Point',
}

export const STATIC_OPTIONS = {
  project_category:    ['In-house', 'Fund Transfer'],
  overall_status:      ['For Deployment', 'For Implementation', 'For Monitoring', 'For Transfer', 'Transfer Ongoing', 'Fully Transferred', 'For Pull Out', 'Done'],
  operational_status:  ['Operational', 'Non-operational', 'For Repair & Maintenance'],
}