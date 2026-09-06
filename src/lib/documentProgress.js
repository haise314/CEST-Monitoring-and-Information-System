export const PHASE_ORDER = ['Pre-Implementation', 'Semi-Annual', 'Annual', 'Transfer']

// A document counts as "complete" if it has a soft copy (gdrive_link)
// or a hard copy on file. N/A documents are excluded from both the
// numerator and denominator. Kept here so DocumentChecklist and the
// Overview page can't drift on what "complete" means.
function isComplete(doc) {
  return Boolean(doc.gdrive_link || doc.has_hard_copy)
}

// documents: flat array of document rows, each with a joined
// document_types (needs at least { phase }), is_not_applicable,
// gdrive_link, has_hard_copy.
export function computeProgress(documents = []) {
  const byPhase = PHASE_ORDER.reduce((acc, phase) => {
    const docs = documents.filter(d => d.document_types?.phase === phase)
    const applicable = docs.filter(d => !d.is_not_applicable)
    const complete = applicable.filter(isComplete)
    acc[phase] = {
      docs,
      applicableCount: applicable.length,
      completeCount: complete.length,
      pct: applicable.length === 0 ? 0 : Math.round((complete.length / applicable.length) * 100),
    }
    return acc
  }, {})

  const allApplicable = documents.filter(d => !d.is_not_applicable)
  const allComplete = allApplicable.filter(isComplete)

  return {
    byPhase,
    overallPct: allApplicable.length === 0 ? 0 : Math.round((allComplete.length / allApplicable.length) * 100),
    totalApplicable: allApplicable.length,
    totalComplete: allComplete.length,
  }
}

// Same color scale DocumentChecklist already uses for its bars.
export function progressBarColor(pct) {
  if (pct === 100) return 'bg-green-500'
  if (pct >= 50) return 'bg-blue-400'
  return 'bg-yellow-400'
}