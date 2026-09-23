import { projectCount } from '../../hooks/useBeneficiaries'

export const ALL_COLUMNS = [
  { accessorKey: 'name',         header: 'Name',         size: 220, minSize: 120, cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'category',     header: 'Category',     size: 120, minSize: 90,  cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'district',     header: 'District',     size: 130, minSize: 90,  cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'municipality', header: 'Municipality', size: 150, minSize: 100, cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'barangay',     header: 'Barangay',     size: 150, minSize: 100, cell: ({ getValue }) => getValue() ?? '—' },
  { id: 'projects', accessorFn: projectCount, header: 'Projects', size: 100, minSize: 80, cell: ({ getValue }) => getValue() },
]