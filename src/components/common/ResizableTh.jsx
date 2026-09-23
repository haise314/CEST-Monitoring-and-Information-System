import { flexRender } from '@tanstack/react-table'

// One <th> for any resizable, sortable TanStack Table column. Extracted
// from Projects.jsx once Beneficiaries.jsx and Contacts.jsx needed the
// identical header markup (sort-click area + Excel-style drag handle on
// the right edge) — not built as a shared piece before that, per this
// project's convention of extracting only once a second real consumer
// exists.
export default function ResizableTh({ header }) {
  return (
    <th
      style={{ width: header.getSize() }}
      className="relative px-4 py-3 text-left font-medium select-none"
    >
      <div
        onClick={header.column.getToggleSortingHandler()}
        className="cursor-pointer hover:text-gray-800 truncate pr-2"
        title={typeof header.column.columnDef.header === 'string' ? header.column.columnDef.header : undefined}
      >
        {flexRender(header.column.columnDef.header, header.getContext())}
        {header.column.getIsSorted() === 'asc'  ? ' ↑'
         : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
      </div>
      {/* Drag handle — right edge of the column, Excel-style */}
      <div
        onMouseDown={header.getResizeHandler()}
        onTouchStart={header.getResizeHandler()}
        onClick={e => e.stopPropagation()}
        className={`absolute top-0 right-0 h-full w-1.5 cursor-col-resize select-none touch-none hover:bg-blue-300 ${
          header.column.getIsResizing() ? 'bg-blue-400' : 'bg-transparent'
        }`}
      />
    </th>
  )
}