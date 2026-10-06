import {
  DashboardIcon, OverviewIcon, MapIcon,
  ProjectsIcon, DocumentsIcon, BeneficiariesIcon, ContactsIcon,
} from './icons'

// Defined here (not in icons.jsx) so adding the Budget page doesn't require
// replacing that file. Same stroke style as the rest of the icon set.
const BudgetIcon = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M3 7a2 2 0 0 1 2-2h12v4" />
    <path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z" />
    <circle cx="16" cy="14" r="1" />
  </svg>
)

// Single source of truth for the sidebar and the top bar's breadcrumb.
export const NAV_GROUPS = [
  {
    label: 'Monitor',
    items: [
      { to: '/',         label: 'Dashboard', icon: DashboardIcon, end: true },
      { to: '/overview', label: 'Overview',  icon: OverviewIcon },
      { to: '/map',      label: 'Map',       icon: MapIcon },
      { to: '/budget',   label: 'Budget',    icon: BudgetIcon },
    ],
  },
  {
    label: 'Records',
    items: [
      { to: '/projects',      label: 'Projects',      icon: ProjectsIcon },
      { to: '/documents',     label: 'Documents',     icon: DocumentsIcon },
      { to: '/beneficiaries', label: 'Beneficiaries', icon: BeneficiariesIcon },
      { to: '/contacts',      label: 'Contacts',      icon: ContactsIcon },
    ],
  },
]

// Breadcrumb trail for the current path: [{ label, to? }, ...]
export function getBreadcrumb(pathname) {
  if (pathname.startsWith('/projects/')) {
    return [
      { label: 'Records' },
      { label: 'Projects', to: '/projects' },
      { label: 'Project details' },
    ]
  }
  for (const group of NAV_GROUPS) {
    const item = group.items.find(i => (i.end ? pathname === i.to : pathname.startsWith(i.to)))
    if (item) return [{ label: group.label }, { label: item.label }]
  }
  return []
}