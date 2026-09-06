// ─── Status Badge ─────────────────────────────────────────────────────────────

function Badge({ value, colorMap, fallback = 'bg-gray-100 text-gray-700' }) {
  if (!value) return <span className="text-gray-300">—</span>
  const cls = colorMap?.[value] ?? fallback
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cls}`}>
      {value}
    </span>
  )
}

const PHASE_COLORS = {
  'Pre-Implementation': 'bg-blue-100 text-blue-800',
  'Semi-Annual':        'bg-purple-100 text-purple-800',
  'Annual':             'bg-indigo-100 text-indigo-800',
  'Transfer':           'bg-orange-100 text-orange-800',
}

const STATUS_COLORS = {
  'For Deployment':     'bg-yellow-100 text-yellow-800',
  'For Implementation': 'bg-blue-100 text-blue-800',
  'For Monitoring':     'bg-purple-100 text-purple-800',
  'For Transfer':       'bg-orange-100 text-orange-800',
  'Transfer Ongoing':   'bg-orange-200 text-orange-900',
  'Fully Transferred':  'bg-green-100 text-green-800',
  'For Pull Out':       'bg-red-100 text-red-800',
  'Done':               'bg-green-200 text-green-900',
}

const CATEGORY_COLORS = {
  'In-house':      'bg-indigo-100 text-indigo-800',
  'Fund Transfer': 'bg-teal-100 text-teal-800',
}

// ─── Boolean Cell ─────────────────────────────────────────────────────────────

function BoolCell({ getValue, trueLabel = '✓', falseLabel = '—', trueClass = 'text-green-600', falseClass = 'text-gray-300' }) {
  const v = getValue()
  return (
    <span className={`text-sm font-medium ${v ? trueClass : falseClass}`}>
      {v ? trueLabel : falseLabel}
    </span>
  )
}

// ─── Column Definitions ───────────────────────────────────────────────────────

export const ALL_COLUMNS = [
  // DOCUMENT
  {
    id: 'document_name',
    accessorFn: r => r.document_types?.name ?? r.custom_label,
    header: 'Document',
    group: 'Document',
    cell: ({ getValue, row }) => {
      const val = getValue()
      const isNA = row.original.is_not_applicable
      return (
        <span className={isNA ? 'line-through text-gray-400 text-xs' : 'text-xs text-gray-800'}>
          {val ?? '—'}
        </span>
      )
    },
  },
  {
    id: 'phase',
    accessorFn: r => r.document_types?.phase,
    header: 'Phase',
    group: 'Document',
    cell: ({ getValue }) => <Badge value={getValue()} colorMap={PHASE_COLORS} />,
  },
  {
    id: 'is_not_applicable',
    accessorKey: 'is_not_applicable',
    header: 'N/A',
    group: 'Document',
    cell: ({ getValue }) => <BoolCell getValue={getValue} trueLabel="N/A" falseLabel="—" trueClass="text-gray-400 text-xs" falseClass="text-gray-200 text-xs" />,
  },
  {
    accessorKey: 'submitted',
    header: 'Submitted',
    group: 'Document',
    cell: ({ getValue }) => <BoolCell getValue={getValue} trueLabel="✓" falseLabel="✗" trueClass="text-green-600" falseClass="text-red-400" />,
  },
  {
    accessorKey: 'has_hard_copy',
    header: 'Hard Copy',
    group: 'Document',
    cell: ({ getValue }) => <BoolCell getValue={getValue} />,
  },
  {
    accessorKey: 'hard_copy_claimable',
    header: 'Claimable',
    group: 'Document',
    cell: ({ getValue }) => <BoolCell getValue={getValue} />,
  },
  {
    id: 'gdrive_link',
    accessorKey: 'gdrive_link',
    header: 'Soft Copy',
    group: 'Document',
    cell: ({ getValue }) => {
      const val = getValue()
      return val
        ? <a href={val} target="_blank" rel="noreferrer" className="text-blue-500 underline text-xs">Open</a>
        : <span className="text-gray-300 text-xs">—</span>
    },
  },
  {
    accessorKey: 'expected_date',
    header: 'Expected Date',
    group: 'Document',
    cell: ({ getValue }) => <span className="text-xs">{getValue() ?? '—'}</span>,
  },
  {
    accessorKey: 'submitted_date',
    header: 'Submitted Date',
    group: 'Document',
    cell: ({ getValue }) => <span className="text-xs">{getValue() ?? '—'}</span>,
  },
  {
    accessorKey: 'notes',
    header: 'Notes',
    group: 'Document',
    cell: ({ getValue }) => (
      <span className="text-xs text-gray-500 max-w-xs truncate block">{getValue() ?? '—'}</span>
    ),
  },

  // PROJECT CONTEXT
  {
    id: 'year',
    accessorFn: r => r.project_instances?.year,
    header: 'Year',
    group: 'Project',
    cell: ({ getValue }) => <span className="text-xs">{getValue() ?? '—'}</span>,
  },
  {
    id: 'project_type',
    accessorFn: r => r.project_instances?.project_types?.name,
    header: 'Project Type',
    group: 'Project',
    cell: ({ getValue }) => <span className="text-xs">{getValue() ?? '—'}</span>,
  },
  {
    id: 'project_category',
    accessorFn: r => r.project_instances?.project_category,
    header: 'Project Category',
    group: 'Project',
    cell: ({ getValue }) => <Badge value={getValue()} colorMap={CATEGORY_COLORS} />,
  },
  {
    id: 'overall_status',
    accessorFn: r => r.project_instances?.overall_status,
    header: 'Project Status',
    group: 'Project',
    cell: ({ getValue }) => <Badge value={getValue()} colorMap={STATUS_COLORS} />,
  },

  // LOCATION
  {
    id: 'beneficiary',
    accessorFn: r => r.project_instances?.beneficiaries?.name,
    header: 'Beneficiary',
    group: 'Location',
    cell: ({ getValue }) => <span className="text-xs">{getValue() ?? '—'}</span>,
  },
  {
    id: 'municipality',
    accessorFn: r => r.project_instances?.beneficiaries?.municipality,
    header: 'Municipality',
    group: 'Location',
    cell: ({ getValue }) => <span className="text-xs">{getValue() ?? '—'}</span>,
  },
  {
    id: 'barangay',
    accessorFn: r => r.project_instances?.beneficiaries?.barangay,
    header: 'Barangay',
    group: 'Location',
    cell: ({ getValue }) => <span className="text-xs">{getValue() ?? '—'}</span>,
  },
  {
    id: 'district',
    accessorFn: r => r.project_instances?.beneficiaries?.district,
    header: 'District',
    group: 'Location',
    cell: ({ getValue }) => <span className="text-xs">{getValue() ?? '—'}</span>,
  },
  {
    id: 'ben_category',
    accessorFn: r => r.project_instances?.beneficiaries?.category,
    header: 'Ben. Category',
    group: 'Location',
    cell: ({ getValue }) => <span className="text-xs">{getValue() ?? '—'}</span>,
  },
]

// ─── Visibility Defaults ──────────────────────────────────────────────────────

export const DEFAULT_VISIBLE = {
  document_name:       true,
  phase:               true,
  is_not_applicable:   true,
  submitted:           true,
  has_hard_copy:       true,
  hard_copy_claimable: false,
  gdrive_link:         true,
  expected_date:       false,
  submitted_date:      false,
  notes:               false,
  year:                true,
  project_type:        true,
  project_category:    false,
  overall_status:      true,
  beneficiary:         true,
  municipality:        true,
  barangay:            false,
  district:            false,
  ben_category:        false,
}

// ─── Filter Config ────────────────────────────────────────────────────────────

export const FILTERABLE_COLUMN_IDS = [
  'phase', 'is_not_applicable', 'submitted', 'has_hard_copy',
  'year', 'project_type', 'project_category', 'overall_status',
  'municipality', 'barangay', 'district', 'ben_category',
]

export const FILTER_LABELS = {
  phase:               'Phase',
  is_not_applicable:   'N/A',
  submitted:           'Submitted',
  has_hard_copy:       'Hard Copy',
  year:                'Year',
  project_type:        'Project Type',
  project_category:    'Project Category',
  overall_status:      'Project Status',
  municipality:        'Municipality',
  barangay:            'Barangay',
  district:            'District',
  ben_category:        'Ben. Category',
}

export const STATIC_OPTIONS = {
  phase:            ['Pre-Implementation', 'Semi-Annual', 'Annual', 'Transfer'],
  is_not_applicable: ['Yes', 'No'],
  submitted:        ['Yes', 'No'],
  has_hard_copy:    ['Yes', 'No'],
  project_category: ['In-house', 'Fund Transfer'],
  overall_status:   ['For Deployment', 'For Implementation', 'For Monitoring', 'For Transfer', 'Transfer Ongoing', 'Fully Transferred', 'For Pull Out', 'Done'],
}