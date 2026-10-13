const YES_NO = ['Yes', 'No']
const has = v => (v ? 'Yes' : 'No')

// Filter chips for the Contacts page (rows = rows from useContacts).
export const CONTACT_FILTER_FIELDS = [
  { id: 'name', label: 'Name', group: 'Contact', type: 'text',   get: c => c.name },
  { id: 'role', label: 'Role', group: 'Contact', type: 'select', blankLabel: '(no role)', get: c => c.role },
  { id: 'has_number',    label: 'Has contact number', group: 'Details', type: 'select', order: YES_NO, get: c => has(c.contact_number) },
  { id: 'has_email',     label: 'Has email',          group: 'Details', type: 'select', order: YES_NO, get: c => has(c.email) },
  { id: 'has_messenger', label: 'Has Messenger link', group: 'Details', type: 'select', order: YES_NO, get: c => has(c.messenger_link) },
  { id: 'updated_at', label: 'Last updated', group: 'Details', type: 'date', get: c => c.updated_at },
]
