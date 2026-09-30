import { useState, useEffect } from 'react'
import { useRemarks } from '../../hooks/useRemarks'
import { getSavedAuthor, saveAuthor } from '../../lib/localAuthor'
import { useToast } from '../../lib/ToastContext'

const LEVEL_OPTIONS = [
  { value: 'provincial', label: 'Provincial' },
  { value: 'regional',   label: 'Regional' },
  { value: 'pcest',      label: 'PCEST' },
  { value: 'rcest',      label: 'RCEST' },
]

const LEVEL_META = {
  provincial: { label: 'Provincial', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  regional:   { label: 'Regional',   className: 'bg-purple-50 text-purple-700 border-purple-200' },
  pcest:      { label: 'PCEST',      className: 'bg-teal-50 text-teal-700 border-teal-200' },
  rcest:      { label: 'RCEST',      className: 'bg-amber-50 text-amber-700 border-amber-200' },
}

// How long after posting a remark can still be deleted (mis-clicks/typos
// only). After this, corrections go in as a new remark, not an edit or
// silent delete — see useRemarks.js.
const DELETE_WINDOW_MINUTES = 15

function minutesSince(iso) {
  return (Date.now() - new Date(iso).getTime()) / 60000
}

function LevelBadge({ level }) {
  const meta = LEVEL_META[level]
  if (!meta) return null
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}

function formatTimestamp(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function RemarkRow({ remark, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting]     = useState(false)

  const ageMinutes  = minutesSince(remark.created_at)
  const canDelete   = ageMinutes < DELETE_WINDOW_MINUTES
  const minutesLeft = Math.max(0, Math.ceil(DELETE_WINDOW_MINUTES - ageMinutes))

  async function handleDelete() {
    setDeleting(true)
    await onDelete(remark.id)
    // No need to reset deleting/confirming — row unmounts on success.
    // If it failed, the parent's error surfaces separately; reset here
    // so the button isn't stuck saying "Deleting...".
    setDeleting(false)
  }

  return (
    <div className="py-3 border-b border-gray-50 last:border-0 group">
      <div className="flex items-center gap-2 mb-1">
        <LevelBadge level={remark.level} />
        <span className="text-xs font-medium text-gray-600">{remark.added_by || 'Unknown'}</span>
        <span className="text-xs text-gray-300">·</span>
        <span className="text-xs text-gray-400">{formatTimestamp(remark.created_at)}</span>

        {canDelete && !confirming && (
          <button
            onClick={() => setConfirming(true)}
            className="text-xs text-gray-300 hover:text-red-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
            title={`You can delete this for ${minutesLeft} more minute${minutesLeft === 1 ? '' : 's'}`}
          >
            Delete
          </button>
        )}
      </div>

      <p className="text-sm text-gray-700 whitespace-pre-wrap">{remark.content}</p>

      {confirming && (
        <div className="mt-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          <span className="text-xs text-red-700">Delete this remark? This can't be undone.</span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs bg-red-600 text-white rounded px-2 py-1 hover:bg-red-700 disabled:opacity-50 ml-auto"
          >
            {deleting ? 'Deleting...' : 'Yes, delete'}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-xs border border-gray-300 rounded px-2 py-1 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

const inputClass  = 'w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const selectClass = 'border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function RemarksSection({ projectId }) {
  const { remarks, loading, error, addRemark, deleteRemark } = useRemarks(projectId)
  const toast = useToast()

  const [level, setLevel]     = useState('provincial')
  const [content, setContent] = useState('')
  const [author, setAuthor]   = useState(getSavedAuthor())
  const [editingAuthor, setEditingAuthor] = useState(!getSavedAuthor())
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  // Re-render periodically so "Delete" buttons disappear on their own
  // once the window closes, without needing a page refresh. Only runs
  // while at least one remark is still within the window.
  const [, forceTick] = useState(0)
  useEffect(() => {
    const stillWithinWindow = remarks.some(r => minutesSince(r.created_at) < DELETE_WINDOW_MINUTES)
    if (!stillWithinWindow) return
    const interval = setInterval(() => forceTick(t => t + 1), 30_000)
    return () => clearInterval(interval)
  }, [remarks])

  async function handlePost() {
    const trimmedContent = content.trim()
    const trimmedAuthor  = author.trim()
    if (!trimmedContent) return
    if (!trimmedAuthor) {
      setEditingAuthor(true)
      return
    }

    setPosting(true)
    setPostError(null)
    const { error } = await addRemark({
      level,
      content: trimmedContent,
      added_by: trimmedAuthor,
    })
    setPosting(false)

    if (error) {
      setPostError(error)
      return
    }

    saveAuthor(trimmedAuthor)
    setContent('')
    toast.success('Remark posted')
  }

  async function handleDelete(id) {
    setDeleteError(null)
    const { error } = await deleteRemark(id)
    if (error) setDeleteError(error)
    else toast.success('Remark deleted')
  }

  return (
    <div>
      {/* ── Compose ── */}
      <div className="border border-gray-200 rounded-lg p-3 mb-4 bg-gray-50">
        <div className="flex items-center gap-2 mb-2">
          <select
            value={level}
            onChange={e => setLevel(e.target.value)}
            className={selectClass}
          >
            {LEVEL_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {editingAuthor ? (
            <input
              type="text"
              value={author}
              onChange={e => setAuthor(e.target.value)}
              onBlur={() => { if (author.trim()) setEditingAuthor(false) }}
              placeholder="Your name"
              autoFocus
              className={inputClass + ' max-w-[160px]'}
            />
          ) : (
            <button
              onClick={() => setEditingAuthor(true)}
              className="text-xs text-gray-500 hover:text-gray-700"
              title="Not you? Click to change"
            >
              Posting as <span className="font-medium">{author}</span> · not you?
            </button>
          )}
        </div>

        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Add a remark — context that doesn't fit in a status field..."
          rows={2}
          className={inputClass}
        />

        {postError && (
          <p className="text-red-500 text-xs mt-1">{postError}</p>
        )}

        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-gray-400">
            Remarks can be deleted for {DELETE_WINDOW_MINUTES} minutes after posting. After that, post a correction instead.
          </p>
          <button
            onClick={handlePost}
            disabled={posting || !content.trim()}
            className="bg-blue-600 text-white rounded px-3 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex-shrink-0 ml-3"
          >
            {posting ? 'Posting...' : 'Post Remark'}
          </button>
        </div>
      </div>

      {deleteError && (
        <p className="text-red-500 text-xs mb-2">{deleteError}</p>
      )}

      {/* ── History (append-only, newest first) ── */}
      {loading ? (
        <p className="text-xs text-gray-400">Loading remarks...</p>
      ) : error ? (
        <p className="text-xs text-red-500">{error}</p>
      ) : remarks.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No remarks yet.</p>
      ) : (
        <div>
          {remarks.map(r => (
            <RemarkRow key={r.id} remark={r} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}