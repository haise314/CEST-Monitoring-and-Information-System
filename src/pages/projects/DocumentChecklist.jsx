import { useState } from 'react'
import { useDocuments } from '../../hooks/useDocuments'
import { PHASE_ORDER, computeProgress, progressBarColor } from '../../lib/documentProgress'
import { isOverdue } from '../../lib/documentStatus'
import { useToast } from '../../lib/ToastContext'
import { useAuth } from '../../lib/AuthContext'

// Format a 'YYYY-MM-DD' string as e.g. "Sep 15" without going through
// Date/timezone conversion (which can shift the day depending on locale).
function formatShortDate(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[m - 1]} ${d}`
}

// ─── Expected Date Cell ───────────────────────────────────────────────────────
// Click to set/edit the expected date. Shows in red if overdue (per the same
// isOverdue() logic DocBadge uses, so the two stay consistent).

function ExpectedDateCell({ doc, onChange }) {
  const [editing, setEditing] = useState(false)
  const [input, setInput]     = useState(doc.expected_date ?? '')
  const overdue = isOverdue(doc)
  const { canEdit } = useAuth()

  if (!canEdit) {
    return doc.expected_date ? (
      <span className={`text-xs whitespace-nowrap ${overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
        {overdue ? '⚠ ' : ''}{formatShortDate(doc.expected_date)}
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
        className="border border-blue-400 rounded px-1.5 py-1 text-base sm:text-xs w-36 sm:w-32 focus:outline-none"
      />
    )
  }

  return doc.expected_date ? (
    <button
      onClick={() => { setInput(doc.expected_date); setEditing(true) }}
      title={overdue ? 'Overdue — click to change' : 'Expected date — click to change'}
      className={`text-xs whitespace-nowrap ${overdue ? 'text-red-500 font-medium' : 'text-gray-400 hover:text-gray-600'}`}
    >
      {overdue ? '⚠ ' : ''}{formatShortDate(doc.expected_date)}
    </button>
  ) : (
    <button
      onClick={() => setEditing(true)}
      className="text-gray-300 text-xs hover:text-blue-500 whitespace-nowrap"
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
      <a href={value} target="_blank" rel="noreferrer" className="text-blue-500 text-xs underline">Open</a>
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
        className="border border-blue-400 rounded px-2 py-1 text-base sm:text-xs w-full min-w-[12rem] sm:w-44 focus:outline-none"
      />
    )
  }

  return value ? (
    <div className="flex items-center gap-1">
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="text-blue-500 text-xs underline"
      >
        Open
      </a>
      <button
        onClick={() => { setInput(value); setEditing(true) }}
        className="text-gray-300 text-xs hover:text-gray-500"
        title="Edit link"
      >
        ✎
      </button>
    </div>
  ) : (
    <button
      onClick={() => setEditing(true)}
      className="text-gray-300 text-xs hover:text-blue-500 whitespace-nowrap"
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
  const isNA = doc.is_not_applicable

  function handleCheck(field, value) {
    onUpdate(doc.id, { [field]: value })
  }

  function handleNotesBlur() {
    const trimmed = notes.trim()
    if (trimmed !== (doc.notes ?? '')) onUpdate(doc.id, { notes: trimmed || null })
  }

  return (
    <div className={`py-2 border-b border-gray-50 last:border-0 ${isNA ? 'opacity-40' : ''}`}>
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-2">

        {/* N/A toggle */}
        <button
          onClick={() => handleCheck('is_not_applicable', !isNA)}
          title={isNA ? 'Mark as applicable' : 'Mark as not applicable'}
          disabled={!canEdit}
          className={`text-xs px-2 py-1 sm:px-1.5 sm:py-0.5 rounded border flex-shrink-0 transition-colors ${
            isNA
              ? 'bg-gray-200 border-gray-300 text-gray-500'
              : 'border-gray-200 text-gray-300 hover:border-gray-400 hover:text-gray-500'
          }`}
        >
          N/A
        </button>

        {/* Document name */}
        <span className={`text-xs flex-1 min-w-0 ${isNA ? 'line-through text-gray-400' : 'text-gray-700'}`}>
          {doc.document_types?.name ?? doc.custom_label ?? '—'}
          {doc.document_types && !doc.document_types.is_required && !isNA && (
            <span className="ml-1 text-gray-400 italic">(optional)</span>
          )}
        </span>

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

            {/* Checkboxes */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer py-1" title="Hard Copy">
                <input
                  type="checkbox"
                  checked={doc.has_hard_copy ?? false}
                  disabled={!canEdit}
                  onChange={e => handleCheck('has_hard_copy', e.target.checked)}
                  className="rounded h-4 w-4"
                />
                <span>HC</span>
              </label>

              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer py-1" title="Hard Copy Claimable">
                <input
                  type="checkbox"
                  checked={doc.hard_copy_claimable ?? false}
                  disabled={!canEdit}
                  onChange={e => handleCheck('hard_copy_claimable', e.target.checked)}
                  className="rounded h-4 w-4"
                />
                <span>Claim</span>
              </label>

              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer py-1" title="Submitted to next office">
                <input
                  type="checkbox"
                  checked={doc.submitted ?? false}
                  disabled={!canEdit}
                  onChange={e => handleCheck('submitted', e.target.checked)}
                  className="rounded h-4 w-4"
                />
                <span>Sub</span>
              </label>

              {/* Notes toggle */}
              <button
                onClick={() => setShowNotes(v => !v)}
                className={`text-sm sm:text-xs px-1 transition-colors ${showNotes || doc.notes ? 'text-blue-400' : 'text-gray-300 hover:text-gray-500'}`}
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
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-base sm:text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
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

  return (
    <div className="mb-2 border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-left"
      >
        <span className="text-xs font-semibold text-gray-700">{phase}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {completeCount}/{applicableCount}
          </span>
          <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-gray-400">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="px-3 pt-1 pb-0.5">
          {docs.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No documents in this phase.</p>
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
// useAllDocuments(), which is a separate cache) can be told to refetch. Without
// this, editing a document here leaves that other page's badges/status stale
// until a manual page refresh.
export default function DocumentChecklist({ project, onChanged }) {
  const { documents, loading, error, generateDocuments, updateDocument } = useDocuments(project.id)
  const [generating, setGenerating]     = useState(false)
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

  // Wrap updateDocument so every field edit (date, link, checkboxes, notes,
  // N/A toggle) also notifies the parent — pass this to PhaseSection/DocumentRow
  // instead of the raw hook function.
  async function handleUpdate(id, updates) {
    const result = await updateDocument(id, updates)
    if (!result.error) onChanged?.()
    return result
  }

  const { byPhase, overallPct, totalApplicable, totalComplete } = computeProgress(documents)

  if (loading) return (
    <div className="text-xs text-gray-400 py-3 text-center">Loading documents...</div>
  )

  if (error) return (
    <div className="text-xs text-red-500 py-3">{error}</div>
  )

  // No documents yet — show generate button
  if (documents.length === 0) {
    return (
      <div className="text-center py-4 border border-dashed border-gray-200 rounded-lg">
        <p className="text-xs text-gray-500 mb-3">
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
          <p className="text-red-500 text-xs mt-2">{generateError}</p>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Overall compliance bar */}
      <div className="flex items-center gap-3 mb-3 px-1">
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {totalComplete}/{totalApplicable} complete
        </span>
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${overallPct}%` }}
          />
        </div>
        <span className="text-xs font-medium text-gray-600 w-8 text-right">
          {overallPct}%
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3 px-1">
        <span className="text-xs text-gray-400">HC = Hard Copy</span>
        <span className="text-xs text-gray-400">Claim = Claimable</span>
        <span className="text-xs text-gray-400">Sub = Submitted</span>
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
          className="text-xs text-blue-500 hover:text-blue-700 underline disabled:opacity-50"
        >
          {generating ? 'Syncing...' : '+ Sync missing documents'}
        </button>
        {generateError && (
          <span className="text-red-500 text-xs">{generateError}</span>
        )}
      </div>
    </div>
  )
}