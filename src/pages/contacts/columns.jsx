export const ALL_COLUMNS = [
  { accessorKey: 'name',            header: 'Name',         size: 180, minSize: 120, cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'role',            header: 'Role',         size: 150, minSize: 100, cell: ({ getValue }) => getValue() ?? '—' },
  { accessorFn: r => r.beneficiaries?.name,         id: 'beneficiary',  header: 'Beneficiary',  size: 200, minSize: 120, cell: ({ getValue }) => getValue() ?? '—' },
  { accessorFn: r => r.beneficiaries?.municipality, id: 'municipality', header: 'Municipality', size: 150, minSize: 100, cell: ({ getValue }) => getValue() ?? '—' },
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
]