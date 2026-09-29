import {
  DashboardIcon, OverviewIcon, MapIcon,
  ProjectsIcon, DocumentsIcon, BeneficiariesIcon, ContactsIcon,
} from './icons'

// Single source of truth for the sidebar and the top bar's breadcrumb.
export const NAV_GROUPS = [
  {
    label: 'Monitor',
    items: [
      { to: '/',         label: 'Dashboard', icon: DashboardIcon, end: true },
      { to: '/overview', label: 'Overview',  icon: OverviewIcon },
      { to: '/map',      label: 'Map',       icon: MapIcon },
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