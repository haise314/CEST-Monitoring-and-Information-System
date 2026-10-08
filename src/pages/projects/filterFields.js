import { STATIC_OPTIONS } from './columns'
import { implementingAgency } from '../../lib/projectAgencies'

// Every column of the Projects table can be filtered. `group` matches the
// column groups in columns.jsx and is only used to organise the field picker.
export const PROJECT_FILTER_FIELDS = [
  // ── Core ──
  { id: 'year',             label: 'Year',             group: 'Core', type: 'select', numeric: true, get: p => p.year },
  { id: 'title',            label: 'Title',            group: 'Core', type: 'text',   get: p => p.title },
  { id: 'project_type',     label: 'Project type',     group: 'Core', type: 'select', get: p => p.project_types?.name },
  { id: 'project_category', label: 'Category',         group: 'Core', type: 'select', order: STATIC_OPTIONS.project_category, get: p => p.project_category, blankLabel: '(not set)' },
  { id: 'intervention',     label: 'Intervention',     group: 'Core', type: 'text',   get: p => p.intervention },
  { id: 'property_number',  label: 'Property no.',     group: 'Core', type: 'text',   get: p => p.property_number },
  { id: 'amount',           label: 'Amount',           group: 'Core', type: 'number', format: 'currency', get: p => p.amount },
  { id: 'date_deployed',    label: 'Date deployed',    group: 'Core', type: 'date',   get: p => p.date_deployed },
  { id: 'entry_point',      label: 'Entry point',      group: 'Core', type: 'select', get: p => p.entry_point },

  { id: 'implementing_agency', label: 'Implementing agency', group: 'Core', type: 'select', blankLabel: '(none)', get: p => implementingAgency(p) },

  // ── Beneficiary ──
  { id: 'beneficiary',      label: 'Beneficiary',          group: 'Beneficiary', type: 'select', get: p => p.beneficiaries?.name },
  { id: 'category',         label: 'Beneficiary category', group: 'Beneficiary', type: 'select', get: p => p.beneficiaries?.category },
  { id: 'district',         label: 'District',             group: 'Beneficiary', type: 'select', get: p => p.beneficiaries?.district },
  { id: 'municipality',     label: 'Municipality',         group: 'Beneficiary', type: 'select', get: p => p.beneficiaries?.municipality },
  { id: 'barangay',         label: 'Barangay',             group: 'Beneficiary', type: 'select', get: p => p.beneficiaries?.barangay },
  { id: 'members_male',     label: 'Male members',         group: 'Beneficiary', type: 'number', get: p => p.members_male },
  { id: 'members_female',   label: 'Female members',       group: 'Beneficiary', type: 'number', get: p => p.members_female },
  { id: 'senior_citizen',   label: 'Senior citizens',      group: 'Beneficiary', type: 'number', get: p => p.senior_citizen },
  { id: 'pwds',             label: 'PWDs',                 group: 'Beneficiary', type: 'number', get: p => p.pwds },
  { id: 'fourps',           label: '4Ps',                  group: 'Beneficiary', type: 'number', get: p => p.fourps },
  { id: 'ips',              label: 'IPs',                  group: 'Beneficiary', type: 'number', get: p => p.ips },

  // ── Status & Impact ──
  { id: 'overall_status',      label: 'Overall status', group: 'Status & Impact', type: 'select', order: STATIC_OPTIONS.overall_status,     get: p => p.overall_status },
  { id: 'operational_status',  label: 'Operational',    group: 'Status & Impact', type: 'select', order: STATIC_OPTIONS.operational_status, get: p => p.operational_status, blankLabel: '(not set)' },
  { id: 'interventions_count', label: 'Interventions',  group: 'Status & Impact', type: 'number', get: p => p.interventions_count },
  { id: 'people_trained',      label: 'People trained', group: 'Status & Impact', type: 'number', get: p => p.people_trained },
  { id: 'impact_notes',        label: 'Impact notes',   group: 'Status & Impact', type: 'text',   get: p => p.impact_notes },

  // ── Documents ──
  { id: 'gdrive_folder_link',  label: 'Drive folder link', group: 'Documents', type: 'link', get: p => p.gdrive_folder_link },
]