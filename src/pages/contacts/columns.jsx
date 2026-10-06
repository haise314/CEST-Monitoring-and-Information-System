import { formatRelativeTime } from '../../lib/formatRelativeTime'

// A contact can belong to several beneficiaries (c.beneficiaries is an array).
const names = r => (r.beneficiaries ?? []).map(b => b.name).join(', ')
const towns = r => [...new Set((r.beneficiaries ?? []).map(b => b.municipality).filter(Boolean))].join(', ')

export const ALL_COLUMNS = [
  { accessorKey: 'name',            header: 'Name',         size: 180, minSize: 120, cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'role',            header: 'Role',         size: 150, minSize: 100, cell: ({ getValue }) => getValue() ?? '—' },
  { accessorFn: names, id: 'beneficiary',  header: 'Beneficiaries', size: 220, minSize: 120, cell: ({ getValue }) => getValue() || '—' },
  { accessorFn: towns, id: 'municipality', header: 'Municipality',  size: 150, minSize: 100, cell: ({ getValue }) => getValue() || '—' },
  { accessorKey: 'contact_number',  header: 'Contact No.', size: 140, minSize: 100, cell: ({ getValue }) => getValue() ?? '—' },
  {
    accessorKey: 'messenger_link',
    header: 'Messenger',
    size: 110,
    minSize: 80,
    cell: ({ getValue }) => getValue()
      ? <a
          href={getValue()}
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-blue-500 underline text-xs"
        >
          Open
        </a>
      : '—',
  },
  // Rows that existed before the column was added stay NULL until edited —
  // shown as a dash rather than a made-up date.
  {
    accessorKey: 'updated_at',
    header: 'Updated',
    size: 130,
    minSize: 100,
    cell: ({ getValue }) => {
      const v = getValue()
      return v
        ? <span className="text-xs text-gray-500" title={new Date(v).toLocaleString()}>{formatRelativeTime(v)}</span>
        : <span className="text-gray-300">—</span>
    },
  },
]