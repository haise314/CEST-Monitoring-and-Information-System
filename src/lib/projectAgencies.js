export const AGENCY_TYPES = ['SUC', 'LGU', 'NGA', 'NGO', 'Cooperative', 'Academe', 'Private', 'Others']

// p = a project row that embedded `project_agencies (role, agencies (id, name))`
export const implementingAgency = p =>
  (p.project_agencies ?? []).find(a => a.role === 'implementing')?.agencies?.name ?? null

export const cooperatingAgencies = p =>
  (p.project_agencies ?? []).filter(a => a.role === 'cooperating').map(a => a.agencies?.name).filter(Boolean)