import { projectCount, implementingCount, cooperatingCount } from '../../hooks/useBeneficiaries'

const CATEGORIES = ['LGU', 'BLGU', 'SUC', 'NGA', 'SDO', 'Academe', 'NGO', 'Cooperative', 'Private', 'Others']

// Filter chips for the Organizations page (rows = rows from useBeneficiaries).
export const BENEFICIARY_FILTER_FIELDS = [
  { id: 'name',         label: 'Name',         group: 'Organization', type: 'text',   get: b => b.name },
  { id: 'category',     label: 'Category',     group: 'Organization', type: 'select', order: CATEGORIES, get: b => b.category },
  { id: 'district',     label: 'District',     group: 'Location',     type: 'select', blankLabel: '(not set)', get: b => b.district },
  { id: 'municipality', label: 'Municipality', group: 'Location',     type: 'select', blankLabel: '(not set)', get: b => b.municipality },
  { id: 'barangay',     label: 'Barangay',     group: 'Location',     type: 'select', blankLabel: '(not set)', get: b => b.barangay },
  { id: 'as_beneficiary', label: 'Projects as beneficiary', group: 'Usage', type: 'number', get: projectCount },
  { id: 'implementing',   label: 'Projects implementing',   group: 'Usage', type: 'number', get: implementingCount },
  { id: 'cooperating',    label: 'Projects cooperating',    group: 'Usage', type: 'number', get: cooperatingCount },
]
