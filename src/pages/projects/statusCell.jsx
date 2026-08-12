// ─── Status Cells ────────────────────────────────────────────────────────────

function StatusCell({ getValue }) {
  const status = getValue()
  const colors = {
    'For Deployment':     'bg-yellow-100 text-yellow-800',
    'For Implementation': 'bg-blue-100 text-blue-800',
    'For Monitoring':     'bg-purple-100 text-purple-800',
    'For Transfer':       'bg-orange-100 text-orange-800',
    'Transfer Ongoing':   'bg-orange-200 text-orange-900',
    'Fully Transferred':  'bg-green-100 text-green-800',
    'For Pull Out':       'bg-red-100 text-red-800',
    'Done':               'bg-green-200 text-green-900',
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${colors[status] ?? 'bg-gray-100 text-gray-800'}`}>
      {status ?? '—'}
    </span>
  )
}

export function OperationalCell({ getValue }) {
  const status = getValue()
  const colors = {
    'Operational':              'bg-green-100 text-green-800',
    'Non-operational':          'bg-red-100 text-red-800',
    'For Repair & Maintenance': 'bg-yellow-100 text-yellow-800',
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${colors[status] ?? 'bg-gray-100 text-gray-800'}`}>
      {status ?? '—'}
    </span>
  )
}

export default StatusCell