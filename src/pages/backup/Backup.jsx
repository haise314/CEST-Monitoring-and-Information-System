import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'

// Admin-only page: download a full backup, and restore from one.
// All real enforcement lives in the database (backup_export / backup_restore
// check is_admin() themselves) — this page just calls them.

const TABLE_LABELS = {
  project_types:        'Project types',
  document_types:       'Document types',
  beneficiaries:        'Beneficiaries',
  beneficiary_contacts: 'Contacts',
  project_instances:    'Projects',
  documents:            'Documents',
  project_contacts:     'Project–contact links',
  remarks:              'Remarks',
  itineraries:          'Itineraries',
  itinerary_stops:      'Itinerary stops',
}

function daysAgo(iso) {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function formatWhen(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10)
}

function sum(report, key) {
  return Object.values(report ?? {}).reduce((n, t) => n + (t[key] ?? 0), 0)
}

const card = 'bg-white border border-gray-200 rounded-xl p-4 sm:p-5 mb-5'
const h2   = 'text-sm font-semibold text-gray-800 mb-1'
const btn  = 'bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
const btn2 = 'border border-gray-300 rounded px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50'

export default function Backup() {
  const { isAdmin } = useAuth()
  const toast = useToast()

  const [status, setStatus]           = useState(null)
  const [busy, setBusy]               = useState(null) // 'download' | 'preview' | 'apply'
  const [downloadError, setDownloadError] = useState(null)

  const [fileName, setFileName]   = useState('')
  const [payload, setPayload]     = useState(null)
  const [fileError, setFileError] = useState(null)
  const [overwrite, setOverwrite] = useState(false)
  const [preview, setPreview]     = useState(null)   // { overwrite, tables }
  const [restoreError, setRestoreError] = useState(null)
  const [confirming, setConfirming]     = useState(false)
  const [done, setDone]                 = useState(null)

  async function loadStatus() {
    const { data } = await supabase.from('backup_status').select('*').maybeSingle()
    setStatus(data ?? null)
  }

  useEffect(() => { if (isAdmin) loadStatus() }, [isAdmin])

  if (!isAdmin) {
    return <div className="p-6 text-sm text-gray-500">Only admins can open this page.</div>
  }

  // ── Download ──
  async function handleDownload() {
    setBusy('download')
    setDownloadError(null)
    const { data, error } = await supabase.rpc('backup_export')
    if (error) {
      setDownloadError(error.message)
      setBusy(null)
      return
    }
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cest-mis-backup-${todayStamp()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success('Backup downloaded — store it in Google Drive')
    await loadStatus()
    setBusy(null)
  }

  // ── Restore: choose file ──
  async function handleFile(e) {
    const file = e.target.files?.[0]
    setPayload(null); setPreview(null); setDone(null)
    setFileError(null); setRestoreError(null); setConfirming(false)
    setFileName(file?.name ?? '')
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      if (parsed?.app !== 'cest-mis' || !parsed?.tables) {
        setFileError('This file is not a CEST-MIS backup.')
        return
      }
      if (parsed.version !== 1) {
        setFileError(`Unsupported backup version (${parsed.version ?? 'none'}).`)
        return
      }
      setPayload(parsed)
    } catch {
      setFileError("Couldn't read this file — is it a JSON backup?")
    }
  }

  // ── Restore: preview / apply ──
  async function runRestore(apply) {
    setBusy(apply ? 'apply' : 'preview')
    setRestoreError(null)
    const { data, error } = await supabase.rpc('backup_restore', {
      p_payload: payload,
      p_apply: apply,
      p_overwrite: overwrite,
    })
    setBusy(null)
    if (error) {
      setRestoreError(error.message)
      return
    }
    if (apply) {
      setDone({ overwrite, tables: data.tables })
      setPreview(null)
      setConfirming(false)
      toast.success('Restore complete')
      loadStatus()
    } else {
      setPreview({ overwrite, tables: data.tables })
    }
  }

  const age = daysAgo(status?.last_backup_at)
  const previewCurrent = preview && preview.overwrite === overwrite
  const toAdd       = previewCurrent ? sum(preview.tables, 'new') : 0
  const differing   = previewCurrent ? sum(preview.tables, 'differ') : 0
  const toOverwrite = overwrite ? differing : 0
  const nothingToDo = previewCurrent && toAdd + toOverwrite === 0

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-gray-800 mb-1">Backup &amp; restore</h1>
      <p className="text-sm text-gray-500 mb-5">Admin only. Backups are a single JSON file with every table — no passwords, no emails.</p>

      {/* ── Backup ── */}
      <div className={card}>
        <div className={h2}>Download a backup</div>
        <p className="text-xs text-gray-500 mb-3">
          Last backup:{' '}
          <span className={age == null || age > 7 ? 'text-amber-600 font-medium' : 'text-gray-700'}>
            {status?.last_backup_at
              ? `${formatWhen(status.last_backup_at)} (${age === 0 ? 'today' : `${age} day${age === 1 ? '' : 's'} ago`})`
              : 'never'}
          </span>
          . Save the file in Google Drive.
        </p>
        <button onClick={handleDownload} disabled={busy === 'download'} className={btn}>
          {busy === 'download' ? 'Preparing…' : '⇩ Download backup'}
        </button>
        {downloadError && <p className="text-red-500 text-xs mt-2">{downloadError}</p>}
      </div>

      {/* ── Restore ── */}
      <div className={card}>
        <div className={h2}>Restore from a backup</div>
        <p className="text-xs text-gray-500 mb-3">
          Restore only <strong>adds</strong> rows that are missing (matched by ID) and <strong>never deletes</strong> anything.
          You always see a preview first, and it either fully applies or not at all.
          Download a fresh backup above before restoring.
        </p>

        <label className={`${btn2} inline-block cursor-pointer`}>
          Choose backup file…
          <input type="file" accept="application/json,.json" onChange={handleFile} className="hidden" />
        </label>
        {fileName && <span className="ml-3 text-xs text-gray-500 break-all">{fileName}</span>}
        {fileError && <p className="text-red-500 text-xs mt-2">{fileError}</p>}

        {payload && (
          <div className="mt-4">
            <div className="text-xs text-gray-500 mb-3">
              Backup taken {formatWhen(payload.exported_at)}
              {payload.exported_by ? ` by ${payload.exported_by}` : ''}.
            </div>

            <label className="flex items-start gap-2 text-sm text-gray-700 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={e => { setOverwrite(e.target.checked); setConfirming(false) }}
                className="mt-0.5 h-4 w-4 rounded"
              />
              <span>
                Also overwrite existing rows that differ from the backup
                <span className="block text-xs text-gray-400">
                  Off (recommended): rows that exist now are left exactly as they are. On: they go back to the backup's version, which can undo newer edits.
                </span>
              </span>
            </label>

            <button onClick={() => runRestore(false)} disabled={busy === 'preview'} className={btn2}>
              {busy === 'preview' ? 'Checking…' : 'Preview restore'}
            </button>
          </div>
        )}

        {restoreError && (
          <div className="mt-3 text-red-500 text-xs bg-red-50 border border-red-200 rounded px-3 py-2 break-words">
            {restoreError}
            <div className="text-red-400 mt-1">Nothing was changed.</div>
          </div>
        )}

        {previewCurrent && (
          <div className="mt-4">
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-xs">
                <thead className="text-gray-500 bg-gray-50">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Table</th>
                    <th className="text-right font-medium px-3 py-2">In file</th>
                    <th className="text-right font-medium px-3 py-2">Will add</th>
                    <th className="text-right font-medium px-3 py-2">{overwrite ? 'Will overwrite' : 'Differ (kept)'}</th>
                    <th className="text-right font-medium px-3 py-2">Same</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(TABLE_LABELS).map(([key, label]) => {
                    const t = preview.tables[key] ?? {}
                    return (
                      <tr key={key}>
                        <td className="px-3 py-1.5 text-gray-700">{label}</td>
                        <td className="px-3 py-1.5 text-right text-gray-500">{t.in_file ?? 0}</td>
                        <td className={`px-3 py-1.5 text-right ${t.new ? 'text-green-600 font-medium' : 'text-gray-400'}`}>{t.new ?? 0}</td>
                        <td className={`px-3 py-1.5 text-right ${t.differ ? (overwrite ? 'text-amber-600 font-medium' : 'text-gray-500') : 'text-gray-400'}`}>{t.differ ?? 0}</td>
                        <td className="px-3 py-1.5 text-right text-gray-400">{t.identical ?? 0}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {nothingToDo ? (
              <p className="text-sm text-gray-600 mt-3">
                Nothing to restore — everything in this file is already in the database{!overwrite && differing > 0 ? ' (rows that differ were left alone)' : ''}.
              </p>
            ) : !confirming ? (
              <button onClick={() => setConfirming(true)} className={`${btn} mt-3`}>
                Apply restore…
              </button>
            ) : (
              <div className="mt-3 bg-amber-50 border border-amber-300 rounded p-3">
                <p className="text-sm text-amber-900 font-medium mb-1">
                  Add {toAdd} row{toAdd === 1 ? '' : 's'}{overwrite ? ` and overwrite ${toOverwrite}` : ''}?
                </p>
                <p className="text-xs text-amber-800 mb-3">
                  Nothing is deleted. If anything goes wrong, nothing is changed.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => runRestore(true)} disabled={busy === 'apply'} className={btn}>
                    {busy === 'apply' ? 'Restoring…' : 'Yes, restore'}
                  </button>
                  <button onClick={() => setConfirming(false)} className={btn2}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {done && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800">
            Restore complete: added {sum(done.tables, 'new')} row{sum(done.tables, 'new') === 1 ? '' : 's'}
            {done.overwrite ? `, overwrote ${sum(done.tables, 'differ')}` : ''}. Reload the pages you had open to see the data.
          </div>
        )}

        <p className="text-xs text-gray-400 mt-4">
          User accounts and roles are not restored — they are managed in the Supabase dashboard.
        </p>
      </div>

      {/* ── Schema dump reminder ── */}
      <div className={card}>
        <div className={h2}>Also keep a schema dump</div>
        <p className="text-xs text-gray-500 mb-2">
          The JSON backup holds data only — not table structure, access rules or triggers. Create a schema dump once
          (and again after structure changes) and keep it next to the backups. On a computer with the PostgreSQL client
          tools, using the connection string from Supabase → Connect (session pooler):
        </p>
        <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto">{`pg_dump "<connection string>" --schema=public --schema-only --no-owner --no-privileges -f cest-mis-schema.sql`}</pre>
        <p className="text-xs text-gray-400 mt-2">
          The sign-up trigger lives outside this schema; it is in <code>migrations/01_profiles.sql</code>. Keep the migrations folder too.
          Never paste the connection string (it contains your database password) into chats or documents.
        </p>
      </div>
    </div>
  )
}