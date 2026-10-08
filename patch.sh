python3 - <<'PY'
import re, sys
edits = {}
def load(p):
    if p not in edits: edits[p] = open(p, encoding='utf-8').read()
    return edits[p]
def rep(p, old, new, rx=False):
    s = load(p)
    n = len(re.findall(old, s)) if rx else s.count(old)
    if n != 1:
        print(f"FAIL {p}: anchor found {n}x -> {old[:70]!r}"); sys.exit(1)
    edits[p] = re.sub(old, lambda m: new, s) if rx else s.replace(old, new)

# extra beneficiaries need the full field set for the full-page cards
rep('src/hooks/useProjectParties.js',
    "beneficiaries (id, name, municipality, barangay)')",
    "beneficiaries (id, name, category, district, municipality, barangay)')")

# Projects CSV: cooperating agencies visible by default
rep('src/pages/projects/columns.jsx', "cooperating_agencies: false,", "cooperating_agencies: true,")

# Documents CSV: agency columns
rep('src/pages/documents/Documents.jsx',
    "import { useSessionState } from '../../hooks/useSessionState'",
    "import { useSessionState } from '../../hooks/useSessionState'\nimport { implementingAgency, cooperatingAgencies } from '../../lib/projectAgencies'")
rep('src/pages/documents/Documents.jsx',
    "const docCols = (documentTypesByPhase[activePhase] ?? []).map(type => ({",
    """const agencyCols = [
      {
        id: 'implementing_agency',
        accessorFn: r => implementingAgency(r) ?? '',
        header: 'Implementing Agency',
        group: 'Project Info',
        enableGlobalFilter: true,
        cell: ({ getValue }) => <span className="text-xs">{getValue() || '—'}</span>,
      },
      {
        id: 'cooperating_agencies',
        accessorFn: r => cooperatingAgencies(r).join('; '),
        header: 'Cooperating Agencies',
        group: 'Project Info',
        enableGlobalFilter: true,
        cell: ({ getValue }) => <span className="text-xs">{getValue() || '—'}</span>,
      },
    ]

    const docCols = (documentTypesByPhase[activePhase] ?? []).map(type => ({""")
rep('src/pages/documents/Documents.jsx',
    "return [...core, ...docCols]", "return [...core, ...agencyCols, ...docCols]")

# Dashboard: breakdown by implementing agency
D = 'src/pages/dashboard/Dashboard.jsx'
rep(D, "export default function Dashboard() {", """// ─── SECTION: By implementing agency ────────────────────────────────────────

const NO_AGENCY = '(No implementing agency)'

function AgencyBreakdownSection({ projects, documents }) {
  const rows = useMemo(() => {
    const docsByProject = {}
    documents.forEach(d => { (docsByProject[d.project_id] ??= []).push(d) })
    const map = new Map()
    projects.forEach(p => {
      const name = implementingAgency(p) ?? NO_AGENCY
      if (!map.has(name)) map.set(name, { name, count: 0, amount: 0, docs: [] })
      const r = map.get(name)
      r.count += 1
      r.amount += Number(p.amount) || 0
      r.docs.push(...(docsByProject[p.id] ?? []))
    })
    return [...map.values()]
      .map(r => ({ ...r, pct: computeProgress(r.docs).overallPct, hasDocs: r.docs.length > 0, overdue: r.docs.filter(isOverdue).length }))
      .sort((a, b) => (a.name === NO_AGENCY) - (b.name === NO_AGENCY) || b.count - a.count || a.name.localeCompare(b.name))
  }, [projects, documents])

  return (
    <Card flush>
      <CardBar title="Projects by implementing agency" count={rows.length} />
      {rows.length === 0 ? (
        <EmptyNote>No projects yet</EmptyNote>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500">
              <tr>
                <th className="text-left font-medium px-4 py-2">Agency</th>
                <th className="text-right font-medium px-4 py-2">Projects</th>
                <th className="text-right font-medium px-4 py-2">Amount</th>
                <th className="text-right font-medium px-4 py-2">Compliance</th>
                <th className="text-right font-medium px-4 py-2">Overdue docs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(r => (
                <tr key={r.name}>
                  <td className={`px-4 py-2 ${r.name === NO_AGENCY ? 'text-gray-500 italic' : 'text-gray-800'}`}>{r.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.count}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{peso(r.amount)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.hasDocs ? `${r.pct}%` : '—'}</td>
                  <td className={`px-4 py-2 text-right tabular-nums ${r.overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>{r.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

export default function Dashboard() {""")
rep(D, "      <BudgetRollupSection projects={projects} />",
       "      <BudgetRollupSection projects={projects} />\n\n      {/* By implementing agency */}\n      <AgencyBreakdownSection projects={projects} documents={documents} />")

# ProjectDetail: merge sections
P = 'src/pages/projects/ProjectDetail.jsx'
rep(P, "      <ProjectParties project={project} beneficiaries={beneficiaries} />\n", "")
rep(P, '<Section id="sec-beneficiary" title="Beneficiary" locked={!canEdit}>',
       '<Section id="sec-beneficiary" title="Agencies & Beneficiaries" locked={!canEdit}>\n        <ProjectParties project={project} beneficiaries={beneficiaries} updateBeneficiary={updateBeneficiary}>')
rep(P, r"</Section>\s*</div>\s*\{/\* Right rail",
       "</ProjectParties>\n      </Section>\n      </div>\n\n      {/* Right rail", rx=True)
rep(P, "{ id: 'sec-beneficiary', label: 'Beneficiary' }", "{ id: 'sec-beneficiary', label: 'Agencies & Beneficiaries' }")

# EditPanel (modal): names in read-only textboxes
E = 'src/pages/projects/editPanel.jsx'
rep(E, "\nimport ProjectParties from './ProjectParties'",
       "\nimport { implementingAgency, cooperatingAgencies, additionalBeneficiaries } from '../../lib/projectAgencies'")
rep(E, "const { projectTypes, beneficiaries, entryPoints, loading } = useFormData()",
       "const { projectTypes, entryPoints, loading } = useFormData()")
rep(E, r"[ \t]*<ProjectParties[^\n]*/>\n\n", "", rx=True)
rep(E, r'<Section title="Beneficiary" locked=\{!canEdit\}>[\s\S]*?</Section>',
"""<Section title="Agencies & Beneficiaries">
              <Field label="Implementing Agency">
                <input readOnly value={implementingAgency(project) ?? ''} placeholder="—" className={`${inputClass} bg-gray-50`} />
              </Field>
              <Field label="Cooperating Agencies">
                <input readOnly value={cooperatingAgencies(project).join('; ')} placeholder="—" className={`${inputClass} bg-gray-50`} />
              </Field>
              <Field label="Beneficiaries">
                <input
                  readOnly
                  value={[project.beneficiaries?.name, ...additionalBeneficiaries(project)].filter(Boolean).join('; ')}
                  placeholder="—"
                  className={`${inputClass} bg-gray-50`}
                />
              </Field>
              {project.beneficiary_id && (
                <Link
                  to={`/beneficiaries?edit=${project.beneficiary_id}`}
                  className="text-xs text-blue-500 hover:text-blue-700 underline"
                >
                  View / edit the primary beneficiary's info →
                </Link>
              )}
              <p className="text-xs text-gray-500">
                To change agencies or beneficiaries, use the full page.
              </p>
            </Section>""", rx=True)

for p, s in edits.items():
    open(p, 'w', encoding='utf-8').write(s)
print("OK, patched:", *edits, sep="\n  ")
PY