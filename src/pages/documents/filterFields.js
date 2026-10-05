import { STATIC_OPTIONS } from '../projects/columns'
import { computeProgress } from '../../lib/documentProgress'
import { DOC_CONDITIONS, isOverdue } from '../../lib/documentStatus'
import DocumentRulesEditor from './DocumentRulesEditor'

// Filter chips for the Documents page. Built from the loaded data because the
// "Document status" filter and the progress-based fields need the documents
// (rebuild with useMemo when documents / types change).
//
//   buildDocumentFilterFields({ documentTypesByPhase, docsByProject, docByProjectAndType })

const YES_NO = ['Yes', 'No']

export function buildDocumentFilterFields({ documentTypesByPhase, docsByProject, docByProjectAndType }) {
  const allTypes = Object.values(documentTypesByPhase).flat()
  const typeById = Object.fromEntries(allTypes.map(t => [String(t.id), t]))
  const nameCount = {}
  allTypes.forEach(t => { nameCount[t.name] = (nameCount[t.name] ?? 0) + 1 })
  const conditionById = Object.fromEntries(DOC_CONDITIONS.map(c => [c.id, c]))
  const condLabel = c => c?.label ?? c?.name ?? c?.id ?? ''

  // A rule is usable once both its document and its condition are chosen.
  const complete = rules => (rules ?? []).filter(r => r.typeId && r.conditionId && conditionById[r.conditionId])
  const docsOf = p => docsByProject[p.id] ?? []

  return [
    // ── Project ──
    { id: 'year',             label: 'Year',          group: 'Project', type: 'select', numeric: true, get: p => p.year },
    { id: 'project_type',     label: 'Project type',  group: 'Project', type: 'select', get: p => p.project_types?.name },
    { id: 'project_category', label: 'Category',      group: 'Project', type: 'select', order: STATIC_OPTIONS.project_category, get: p => p.project_category, blankLabel: '(not set)' },
    { id: 'overall_status',   label: 'Status',        group: 'Project', type: 'select', order: STATIC_OPTIONS.overall_status, get: p => p.overall_status },

    // ── Beneficiary ──
    { id: 'beneficiary',  label: 'Beneficiary',          group: 'Beneficiary', type: 'select', get: p => p.beneficiaries?.name },
    { id: 'ben_category', label: 'Beneficiary category', group: 'Beneficiary', type: 'select', get: p => p.beneficiaries?.category },
    { id: 'district',     label: 'District',             group: 'Beneficiary', type: 'select', get: p => p.beneficiaries?.district },
    { id: 'municipality', label: 'Municipality',         group: 'Beneficiary', type: 'select', get: p => p.beneficiaries?.municipality },
    { id: 'barangay',     label: 'Barangay',             group: 'Beneficiary', type: 'select', get: p => p.beneficiaries?.barangay },

    // ── Progress ──
    { id: 'compliance', label: 'Overall compliance (%)', group: 'Progress', type: 'number',
      get: p => computeProgress(docsOf(p)).overallPct },
    { id: 'overdue', label: 'Has overdue documents', group: 'Progress', type: 'select', order: YES_NO,
      get: p => (docsOf(p).some(isOverdue) ? 'Yes' : 'No') },
    { id: 'generated', label: 'Checklist generated', group: 'Progress', type: 'select', order: YES_NO,
      get: p => (docsOf(p).length > 0 ? 'Yes' : 'No') },

    // ── Documents: "<document> is <condition>", several rules AND'd ──
    {
      id: 'documents',
      label: 'Document status',
      group: 'Documents',
      type: 'custom',
      typesByPhase: documentTypesByPhase,
      conditions: DOC_CONDITIONS,
      Editor: DocumentRulesEditor,
      emptyValue: () => [],
      isEmpty: rules => complete(rules).length === 0,
      matches: (p, rules) =>
        complete(rules).every(r =>
          conditionById[r.conditionId].test(docByProjectAndType[`${p.id}-${r.typeId}`])
        ),
      summarize: rules => {
        const done = complete(rules)
        const text = r => {
          const t = typeById[r.typeId]
          const name = t ? (nameCount[t.name] > 1 ? `${t.name} (${t.phase})` : t.name) : 'Document'
          return `${name}: ${condLabel(conditionById[r.conditionId]).toLowerCase()}`
        }
        return done.length <= 1 ? text(done[0]) : `${text(done[0])} +${done.length - 1}`
      },
    },
  ]
}