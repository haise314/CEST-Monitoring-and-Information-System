import { useState } from 'react'
import { useDocuments } from '../../hooks/useDocuments'
import { PHASE_ORDER, computeProgress, progressBarColor } from '../../lib/documentProgress'
import { getDocStatus, STATUS_META, isOverdue, isUpcoming } from '../../lib/documentStatus'
import { useToast } from '../../lib/ToastContext'
import { useAuth } from '../../lib/AuthContext'

// Same status scale as the dots on the Documents page (lib/documentStatus.js),
// so the two screens always agree.
const ROW_STYLE = {
  na:        'border-l-gray-300',
  none:      'border-l-red-400 bg-red-50/40',
  claimable: 'border-l-amber-400 bg-amber-50/40',
  soft:      'border-l-blue-400 bg-blue-50/40',
  hard:      'border-l-indigo-500 bg-indigo-50/40',
  submitted: 'border-l-green-500 bg-green-50/50',
}
const PILL_STYLE = {
  na:        'bg-gray-100 text-gray-700',
  none:      'bg-red-100 text-red-700',
  claimable: 'bg-amber-100 text-amber-800',
  soft:      'bg-blue-100 text-blue-700',
  hard:      'bg-indigo-100 text-indigo-700',
  submitted: 'bg-green-100 text-green-700',
}
const shortLabel = status => STATUS_META[status].label.replace(/ \(.*\)/, '')

// [field, short label, tooltip, checkbox accent, label color when checked]
const CHECKS = [
  ['has_hard_copy',       'HC',    'Hard Copy',           'accent-indigo-600', 'text-indigo-700'],
  ['hard_copy_claimable', 'Claim', 'Hard Copy Claimable', 'accent-amber-500',  'text-amber-700'],
  ['submitted',           'Sub',   'Submitted to next office', 'accent-green-600', 'text-green-700'],
]

// Format a 'YYYY-MM-DD' string as e.g. "Sep 15" without going through
// Date/timezone conversion (which can shift the day depending on locale).
function formatShortDate(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[m - 1]} ${d}`
}

// ─── Expected Date Cell ───────────────────────────────────────────────────────
// Click to set/edit the expected date. Red if overdue, amber if due soon (same
// isOverdue()/isUpcoming() logic the Dashboard uses).

function ExpectedDateCell({ doc, onChange }) {
  const [editing, setEditing] = useState(false)
  const [input, setInput]     = useState(doc.expected_date ?? '')
  const overdue = isOverdue(doc)
  const soon    = isUpcoming(doc)
  const { canEdit } = useAuth()

  const tone = overdue ? 'text-red-600 font-semibold'
             : soon    ? 'text-amber-600 font-medium'
             :           'text-gray-600'
  const prefix = overdue ? '⚠ ' : soon ? '⏰ ' : ''

  if (!canEdit) {
    return doc.expected_date ? (
      <span className={`text-xs whitespace-nowrap ${tone}`}>
        {prefix}{formatShortDate(doc.expected_date)}
      </span>
    ) : null
  }

  function handleBlur() {
    setEditing(false)
    const next = input || null
    if (next !== (doc.expected_date ?? null)) onChange(next)
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="date"
        value={input}
        onChange={e => setInput(e.target.value)}
        onBlur={handleBlur}
        className="border border-blue-400 rounded px-1.5 py-1 text-base sm:text-xs w-36 sm:w-32 bg-white text-gray-800 focus:outline-none"
      />
    )
  }

  return doc.expected_date ? (
    <button
      onClick={() => { setInput(doc.expected_date); setEditing(true) }}
      title={overdue ? 'Overdue — click to change' : soon ? 'Due soon — click to change' : 'Expected date — click to change'}
      className={`text-xs whitespace-nowrap hover:underline ${tone}`}
    >
      {prefix}{formatShortDate(doc.expected_date)}
    </button>
  ) : (
    <button
      onClick={() => setEditing(true)}
      className="text-gray-500 text-xs hover:text-blue-600 whitespace-nowrap"
    >
      + due date
    </button>
  )
}

// ─── Link Cell ────────────────────────────────────────────────────────────────
// Click to add/edit a GDrive link. Shows "Open" button if link exists.

function LinkCell({ value, onChange }) {
  const [editing, setEditing] = useState(false)
  const [input, setInput]     = useState(value ?? '')
  const { canEdit } = useAuth()

  if (!canEdit) {
    return value ? (
      <a href={value} target="_blank" rel="noreferrer" className="text-blue-600 text-xs underline">Open</a>
    ) : null
  }

  function handleBlur() {
    setEditing(false)
    const trimmed = input.trim()
    if (trimmed !== (value ?? '')) onChange(trimmed || null)
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="url"
        value={input}
        onChange={e => setInput(e.target.value)}
        onBlur={handleBlur}
        placeholder="Paste GDrive link..."
        className="border border-blue-400 rounded px-2 py-1 text-base sm:text-xs w-full min-w-[12rem] sm:w-44 bg-white text-gray-800 focus:outline-none"
      />
    )
  }

  return value ? (
    <div className="flex items-center gap-1">
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="text-blue-600 text-xs underline"
      >
        Open
      </a>
      <button
        onClick={() => { setInput(value); setEditing(true) }}
        className="text-gray-500 text-xs hover:text-gray-800"
        title="Edit link"
      >
        ✎
      </button>
    </div>
  ) : (
    <button
      onClick={() => setEditing(true)}
      className="text-gray-500 text-xs hover:text-blue-600 whitespace-nowrap"
    >
      + link
    </button>
  )
}

// ─── Document Row ─────────────────────────────────────────────────────────────

function DocumentRow({ doc, onUpdate }) {
  const { canEdit } = useAuth()
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes]         = useState(doc.notes ?? '')
  const isNA    = doc.is_not_applicable
  const status  = getDocStatus(doc)
  const overdue = isOverdue(doc)

  function handleCheck(field, value) {
    onUpdate(doc.id, { [field]: value })
  }

  function handleNotesBlur() {
    const trimmed = notes.trim()
    if (trimmed !== (doc.notes ?? '')) onUpdate(doc.id, { notes: trimmed || null })
  }

  return (
    <div
      className={`my-1 pl-2 pr-1 py-2 rounded-r border-l-4 ${
        overdue && !isNA ? 'border-l-red-600 bg-red-50' : ROW_STYLE[status]
      } ${isNA ? 'opacity-60' : ''}`}
    >
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-2">

        {/* N/A toggle */}
        <button
          onClick={() => handleCheck('is_not_applicable', !isNA)}
          title={isNA ? 'Mark as applicable' : 'Mark as not applicable'}
          disabled={!canEdit}
          className={`text-xs px-2 py-1 sm:px-1.5 sm:py-0.5 rounded border flex-shrink-0 transition-colors ${
            isNA
              ? 'bg-gray-200 border-gray-400 text-gray-700'
              : 'border-gray-300 text-gray-500 hover:border-gray-500 hover:text-gray-700'
          }`}
        >
          N/A
        </button>

        {/* Document name */}
        <span className={`text-xs flex-1 min-w-0 ${isNA ? 'line-through text-gray-500' : 'text-gray-800'}`}>
          {doc.document_types?.name ?? doc.custom_label ?? '—'}
          {doc.document_types && !doc.document_types.is_required && !isNA && (
            <span className="ml-1 text-gray-500 italic">(optional)</span>
          )}
        </span>

        {/* Status pill */}
        {!isNA && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${
            overdue ? 'bg-red-100 text-red-700' : PILL_STYLE[status]
          }`}>
            {overdue ? 'Overdue' : shortLabel(status)}
          </span>
        )}

        {!isNA && (
          // On phones this group drops to its own line under the name
          // (w-full, indented past the N/A button); from sm up it sits
          // inline with the name as before.
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 w-full pl-9 sm:w-auto sm:pl-0 sm:flex-nowrap sm:flex-shrink-0">
            {/* Expected date */}
            <div className="flex-shrink-0">
              <ExpectedDateCell
                doc={doc}
                onChange={val => handleCheck('expected_date', val)}
              />
            </div>

            {/* GDrive link */}
            <div className="flex-shrink-0">
              <LinkCell
                value={doc.gdrive_link}
                onChange={val => handleCheck('gdrive_link', val)}
              />
            </div>

            {/* Checkboxes: each has its own color, label lights up when checked */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {CHECKS.map(([field, short, title, accent, on]) => (
                <label
                  key={field}
                  title={title}
                  className={`flex items-center gap-1.5 text-xs cursor-pointer py-1 ${
                    doc[field] ? `${on} font-semibold` : 'text-gray-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={doc[field] ?? false}
                    disabled={!canEdit}
                    onChange={e => handleCheck(field, e.target.checked)}
                    className={`rounded h-4 w-4 ${accent}`}
                  />
                  <span>{short}</span>
                </label>
              ))}

              {/* Notes toggle */}
              <button
                onClick={() => setShowNotes(v => !v)}
                className={`text-sm sm:text-xs px-1 transition-colors ${showNotes || doc.notes ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
                title="Notes"
              >
                ✎
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notes input — expands on toggle */}
      {showNotes && !isNA && (
        <div className="mt-1.5 ml-9 sm:ml-7">
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            readOnly={!canEdit}
            placeholder="Add notes..."
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-base sm:text-xs bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      )}
    </div>
  )
}

// ─── Phase Section ────────────────────────────────────────────────────────────

function PhaseSection({ phase, phaseProgress, onUpdate }) {
  const [open, setOpen] = useState(true)
  const { docs, applicableCount, completeCount, pct } = phaseProgress
  const barColor = progressBarColor(pct)
  const done = applicableCount > 0 && pct === 100

  return (
    <div className="mb-2 border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between px-3 py-2 text-left ${
          done ? 'bg-green-50 hover:bg-green-100' : 'bg-gray-50 hover:bg-gray-100'
        }`}
      >
        <span className="text-xs font-semibold text-gray-800">
          {done && <span className="text-green-600 mr-1">✓</span>}{phase}
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${done ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
            {completeCount}/{applicableCount}
          </span>
          <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="px-3 pt-1 pb-0.5">
          {docs.length === 0 ? (
            <p className="text-xs text-gray-600 py-2">No documents in this phase.</p>
          ) : (
            docs.map(doc => (
              <DocumentRow key={doc.id} doc={doc} onUpdate={onUpdate} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

// onChanged: optional. Called after any successful document mutation
// (generate or update). DocumentChecklist keeps its own useDocuments(project.id)
// state in sync on its own — this callback exists purely so a *different*
// hook instance holding the same underlying rows elsewhere (e.g. Documents.jsx's
// useAllDocuments(), which is a separate cache) can be told to refetch.
export default function DocumentChecklist({ project, onChanged }) {
  const { documents, loading, error, generateDocuments, updateDocument } = useDocuments(project.id)
  const [generating, setGenerating]       = useState(false)
  const [generateError, setGenerateError] = useState(null)
  const toast = useToast()
  const { canEdit } = useAuth()

  async function handleGenerate() {
    if (!project.project_category) {
      setGenerateError('Set a Project Category first.')
      return
    }
    setGenerating(true)
    setGenerateError(null)
    const { error, added } = await generateDocuments(project.project_category)
    setGenerating(false)
    if (error) setGenerateError(error)
    else {
      onChanged?.()
      toast.success(added ? `Added ${added} document${added === 1 ? '' : 's'} to the checklist` : 'Checklist is already up to date')
    }
  }

  // Wrap updateDocument so every field edit also notifies the parent.
  async function handleUpdate(id, updates) {
    const result = await updateDocument(id, updates)
    if (!result.error) onChanged?.()
    return result
  }

  const { byPhase, overallPct, totalApplicable, totalComplete } = computeProgress(documents)

  if (loading) return (
    <div className="text-xs text-gray-600 py-3 text-center">Loading documents...</div>
  )

  if (error) return (
    <div className="text-xs text-red-600 py-3">{error}</div>
  )

  // No documents yet — show generate button
  if (documents.length === 0) {
    return (
      <div className="text-center py-4 border border-dashed border-gray-300 rounded-lg">
        <p className="text-xs text-gray-600 mb-3">
          {project.project_category
            ? 'No documents yet. Generate the checklist based on the project category.'
            : 'Set a Project Category first, then generate the document checklist.'}
        </p>
        {project.project_category && canEdit && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-blue-600 text-white rounded px-3 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {generating ? 'Generating...' : `Generate Checklist (${project.project_category})`}
          </button>
        )}
        {generateError && (
          <p className="text-red-600 text-xs mt-2">{generateError}</p>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Overall compliance bar (same color scale as the phase bars) */}
      <div className="flex items-center gap-3 mb-3 px-1">
        <span className="text-xs text-gray-600 whitespace-nowrap">
          {totalComplete}/{totalApplicable} complete
        </span>
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${progressBarColor(overallPct)}`}
            style={{ width: `${overallPct}%` }}
          />
        </div>
        <span className="text-xs font-medium text-gray-700 w-8 text-right">
          {overallPct}%
        </span>
      </div>

      {/* Legend — matches the dots on the Documents page */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3 px-1 text-xs text-gray-600">
        {['none', 'claimable', 'soft', 'hard', 'submitted'].map(k => (
          <span key={k} className="flex items-center gap-1">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_META[k].dotClass}`} />
            {shortLabel(k)}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600" /> Overdue
        </span>
        <span className="text-gray-500">· HC = Hard copy · Claim = Claimable · Sub = Submitted</span>
      </div>

      {/* Phase sections */}
      {PHASE_ORDER.map(phase => {
        const phaseProgress = byPhase[phase]
        if (!phaseProgress || phaseProgress.docs.length === 0) return null
        return (
          <PhaseSection
            key={phase}
            phase={phase}
            phaseProgress={phaseProgress}
            onUpdate={handleUpdate}
          />
        )
      })}

      {/* Sync missing docs (e.g. after category change) */}
      <div className={canEdit ? 'mt-2 flex items-center gap-2' : 'hidden'}>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="text-xs text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
        >
          {generating ? 'Syncing...' : '+ Sync missing documents'}
        </button>
        {generateError && (
          <span className="text-red-600 text-xs">{generateError}</span>
        )}
      </div>
    </div>
  )
}