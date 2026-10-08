export const AGENCY_TYPES = ['SUC', 'LGU', 'NGA', 'NGO', 'Cooperative', 'Academe', 'Private', 'Others']

// p = a project row that embedded `project_agencies (role, agencies (id, name))`
export const implementingAgency = p =>
  (p.project_agencies ?? []).find(a => a.role === 'implementing')?.agencies?.name ?? null

export const cooperatingAgencies = p =>
  (p.project_agencies ?? []).filter(a => a.role === 'cooperating').map(a => a.agencies?.name).filter(Boolean)

// Names of the ADDITIONAL beneficiaries (project_beneficiaries); the primary one is on the project itself.
export const additionalBeneficiaries = p =>
  (p.project_beneficiaries ?? []).map(b => b.beneficiaries?.name).filter(Boolean)

// Who a project is "for": the implementing agency if there is one, otherwise
// the beneficiary. Null-safe. Use this wherever a project is labelled by its
// owner (cards, lists, headers); the beneficiaries are shown as secondary text.
export const projectOwnerName = p =>
  p ? (implementingAgency(p) ?? p.beneficiaries?.name ?? null) : null

// Every beneficiary of the project, all treated equally (no "primary" in the UI).
export const allBeneficiaryNames = p =>
  [p.beneficiaries?.name, ...additionalBeneficiaries(p)].filter(Boolean)
