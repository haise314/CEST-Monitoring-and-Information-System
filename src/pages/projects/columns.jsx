import StatusCell, { OperationalCell } from './statusCell'

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

// ─── Column Definitions ───────────────────────────────────────────────────────

export const ALL_COLUMNS = [
  // CORE
  { accessorKey: 'year',             header: 'Year',             group: 'Core', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorFn: r => r.project_types?.name, id: 'project_type', header: 'Project Type', group: 'Core', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'project_category', header: 'Category',         group: 'Core', cell: ProjectCategoryCell },
  { accessorKey: 'intervention',     header: 'Intervention',     group: 'Core', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'property_number',  header: 'Property No.',     group: 'Core', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'amount',           header: 'Amount',           group: 'Core', cell: ({ getValue }) => getValue() != null ? `₱${Number(getValue()).toLocaleString()}` : '—' },
  { accessorKey: 'date_deployed',    header: 'Date Deployed',    group: 'Core', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'entry_point',      header: 'Entry Point',      group: 'Core', cell: ({ getValue }) => getValue() ?? '—' },

  // BENEFICIARY
  { accessorFn: r => r.beneficiaries?.name,         id: 'beneficiary',  header: 'Beneficiary',  group: 'Beneficiary', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorFn: r => r.beneficiaries?.category,     id: 'category',     header: 'Category',     group: 'Beneficiary', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorFn: r => r.beneficiaries?.district,     id: 'district',     header: 'District',     group: 'Beneficiary', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorFn: r => r.beneficiaries?.municipality, id: 'municipality', header: 'Municipality', group: 'Beneficiary', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorFn: r => r.beneficiaries?.barangay,     id: 'barangay',     header: 'Barangay',     group: 'Beneficiary', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'members_male',    header: 'Male Members',   group: 'Beneficiary', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'members_female',  header: 'Female Members', group: 'Beneficiary', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'senior_citizen',  header: 'Senior Citizen', group: 'Beneficiary', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'pwds',            header: 'PWDs',           group: 'Beneficiary', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'fourps',          header: '4Ps',            group: 'Beneficiary', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'ips',             header: 'IPs',            group: 'Beneficiary', cell: ({ getValue }) => getValue() ?? '—' },

  // STATUS & IMPACT
  { accessorKey: 'overall_status',      header: 'Overall Status', group: 'Status & Impact', cell: StatusCell },
  { accessorKey: 'operational_status',  header: 'Operational',    group: 'Status & Impact', cell: OperationalCell },
  { accessorKey: 'interventions_count', header: 'Interventions',  group: 'Status & Impact', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'people_trained',      header: 'People Trained', group: 'Status & Impact', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'impact_notes',        header: 'Impact Notes',   group: 'Status & Impact', cell: ({ getValue }) => getValue() ?? '—' },

  // DOCUMENTS
  {
    accessorKey: 'gdrive_folder_link',
    header: 'GDrive Link',
    group: 'Documents',
    cell: ({ getValue }) => getValue()
      ? <a href={getValue()} target="_blank" rel="noreferrer" className="text-blue-500 underline text-xs">Open</a>
      : '—',
  },
]

// ─── Visibility Defaults ──────────────────────────────────────────────────────

export const DEFAULT_VISIBLE = {
  // Visible by default
  year: true,
  project_type: true,
  project_category: true,
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