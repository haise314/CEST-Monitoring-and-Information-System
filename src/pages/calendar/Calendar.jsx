import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useProjects } from '../../hooks/useProjects'
import { useAllDocuments } from '../../hooks/useAllDocuments'
import { useTasks } from '../../hooks/useTasks'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import { useSessionState } from '../../hooks/useSessionState'
import FilterChips from '../../components/common/FilterChips'
import { applyFilters } from '../../lib/filterEngine'
import { isOverdue, isAccomplished } from '../../lib/documentStatus'
import { projectOwnerName } from '../../lib/projectAgencies'
import { ymd, todayYmd, parseYmd, addDays, formatLongDate, formatShortDate } from '../../lib/dates'
import TaskModal from './TaskModal'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const KIND_ORDER = { task: 0, doc: 1, deploy: 2 }
const MAX_CHIPS = 3

const FILTER_FIELDS = [
  { id: 'type',         label: 'Type',                 group: 'Event',        type: 'select', get: e => e.typeLabel },
  { id: 'municipality', label: 'Municipality',         group: 'Location',     type: 'select', get: e => e.municipality },
  { id: 'owner',        label: 'Agency / beneficiary', group: 'Organization', type: 'select', get: e => e.owner },
]

const docLabel = d => d.document_types?.name ?? d.custom_label ?? 'Untitled document'
const projectLabel = p => p?.title || p?.project_types?.name || 'Untitled project'

function chipClass(e) {
  if (e.done) return 'bg-gray-100 text-gray-500 line-through'
  if (e.overdue) return 'bg-red-100 text-red-700'
  if (e.kind === 'task') return 'bg-violet-100 text-violet-800'
  if (e.kind === 'doc') return 'bg-blue-100 text-blue-800'
  return 'bg-green-100 text-green-800'
}
function dotClass(e) {
  if (e.done) return 'bg-gray-300'
  if (e.overdue) return 'bg-red-500'
  return e.kind === 'doc' ? 'bg-blue-500' : 'bg-green-500'
}

function buildEvents({ documents, projects, tasks, today }) {
  const projectsById = Object.fromEntries(projects.map(p => [p.id, p]))
  const out = []

  for (const d of documents) {
    if (!d.expected_date || d.is_not_applicable) continue
    const p = d.project_instances
    out.push({
      key: `doc-${d.id}`, kind: 'doc', typeLabel: 'Document', date: d.expected_date,
      title: docLabel(d),
      owner: projectOwnerName(p), municipality: p?.beneficiaries?.municipality ?? null,
      done: isAccomplished(d), overdue: isOverdue(d),
      to: p ? `/projects/${p.id}` : null,
    })
  }

  for (const p of projects) {
    if (!p.date_deployed) continue
    out.push({
      key: `deploy-${p.id}`, kind: 'deploy', typeLabel: 'Deployment', date: p.date_deployed,
      title: `Deployed: ${projectLabel(p)}`,
      owner: projectOwnerName(p), municipality: p.beneficiaries?.municipality ?? null,
      done: false, overdue: false, to: `/projects/${p.id}`,
    })
  }

  for (const t of tasks) {
    const p = t.project_id != null ? projectsById[t.project_id] : null
    const done = Boolean(t.done_at)
    out.push({
      key: `task-${t.id}`, kind: 'task', typeLabel: 'Task', date: t.due_date,
      title: t.title,
      owner: p ? projectOwnerName(p) : null, municipality: p?.beneficiaries?.municipality ?? null,
      done, overdue: !done && t.due_date < today,
      to: p ? `/projects/${p.id}` : null, task: t,
    })
  }
  return out
}

const sortEvents = (a, b) =>
  a.date.localeCompare(b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.title.localeCompare(b.title)

function EventRow({ e, showDate, canEdit, onToggle, onEdit }) {
  const isTask = e.kind === 'task'
  const sub = [
    showDate ? formatShortDate(e.date) : null,
    e.typeLabel, e.owner, e.municipality,
    e.task?.recurrence ? `↻ ${e.task.recurrence}` : null,
  ].filter(Boolean).join(' · ')

  const titleCls = `text-sm break-words ${e.done ? 'line-through text-gray-500' : 'text-gray-800'}`

  return (
    <div className="flex items-start gap-2.5 px-3 py-2 border-b border-gray-100 last:border-0">
      {isTask ? (
        <input
          type="checkbox" checked={e.done} disabled={!canEdit} onChange={() => onToggle(e)}
          aria-label={e.done ? 'Mark as not done' : 'Mark as done'}
          className="mt-1 h-4 w-4 rounded flex-shrink-0"
        />
      ) : (
        <span className={`mt-1.5 inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass(e)}`} />
      )}
      <div className="flex-1 min-w-0">
        {isTask && canEdit ? (
          <button onClick={() => onEdit(e.task)} className={`${titleCls} text-left hover:underline`}>{e.title}</button>
        ) : e.to && !isTask ? (
          <Link to={e.to} className={`${titleCls} hover:underline`}>{e.title}</Link>
        ) : (
          <span className={titleCls}>{e.title}</span>
        )}
        <div className="text-xs text-gray-500 break-words">
          {e.overdue && <span className="text-red-500 font-medium">Overdue · </span>}
          {sub}
          {isTask && e.to && <> · <Link to={e.to} className="text-blue-500 underline">Project ↗</Link></>}
        </div>
        {isTask && e.task.notes && <div className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap line-clamp-2">{e.task.notes}</div>}
      </div>
    </div>
  )
}

export default function CalendarPage() {
  const toast = useToast()
  const { canEdit } = useAuth()
  const { projects, loading: projLoading, error: projError } = useProjects()
  const { documents, loading: docsLoading, error: docsError } = useAllDocuments()
  const { tasks, loading: tasksLoading, error: tasksError, addTask, updateTask, deleteTask, setDone } = useTasks()

  const today = todayYmd()
  const [cursor, setCursor]       = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const [selected, setSelected]   = useState(today)
  const [view, setView]           = useState(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'agenda' : 'month'))
  const [showDone, setShowDone]   = useState(false)
  const [filters, setFilters]     = useSessionState('calendarFilters', [])
  const [modal, setModal]         = useState(null) // { task, date } | null

  const allEvents = useMemo(
    () => buildEvents({ documents, projects, tasks, today }),
    [documents, projects, tasks, today]
  )

  const events = useMemo(() => {
    const filtered = applyFilters(allEvents, filters, FILTER_FIELDS)
    return (showDone ? filtered : filtered.filter(e => !e.done)).sort(sortEvents)
  }, [allEvents, filters, showDone])

  const byDate = useMemo(() => {
    const m = {}
    events.forEach(e => { (m[e.date] ??= []).push(e) })
    return m
  }, [events])

  const projectOptions = useMemo(() =>
    [...projects]
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
      .map(p => ({ value: p.id, label: [projectLabel(p), projectOwnerName(p), p.year].filter(Boolean).join(' · ') })),
    [projects]
  )

  // ── Month grid ──
  const monthStart = new Date(cursor.y, cursor.m, 1)
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const weeks = Math.ceil((monthStart.getDay() + daysInMonth) / 7)
  const gridStart = new Date(cursor.y, cursor.m, 1 - monthStart.getDay())
  const cells = Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
    return { date: ymd(d), day: d.getDate(), inMonth: d.getMonth() === cursor.m }
  })
  const monthLabel = monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const monthPrefix = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`

  function shiftMonth(delta) {
    const d = new Date(cursor.y, cursor.m + delta, 1)
    setCursor({ y: d.getFullYear(), m: d.getMonth() })
  }
  function goToday() {
    const d = new Date()
    setCursor({ y: d.getFullYear(), m: d.getMonth() })
    setSelected(today)
  }

  // ── Side lists ──
  const overdueList = useMemo(() => events.filter(e => e.overdue), [events])
  const soon = useMemo(() => {
    const end = addDays(today, 7)
    return events.filter(e => !e.done && !e.overdue && e.kind !== 'deploy' && e.date >= today && e.date <= end)
  }, [events, today])

  const agendaGroups = useMemo(() => {
    const dates = Object.keys(byDate).filter(d => d.startsWith(monthPrefix)).sort()
    return dates.map(d => [d, byDate[d]])
  }, [byDate, monthPrefix])

  // ── Actions ──
  async function handleToggle(e) {
    const { error, nextDue } = await setDone(e.task, !e.done)
    if (error) toast.error(error)
    else toast.success(nextDue ? `Done. Next one scheduled for ${formatShortDate(nextDue)}` : e.done ? 'Task reopened' : 'Task done')
  }

  async function handleSave(payload) {
    const isEdit = Boolean(modal?.task)
    const r = isEdit ? await updateTask(modal.task.id, payload) : await addTask(payload)
    if (!r.error) toast.success(isEdit ? 'Task updated' : 'Task added')
    return r
  }

  async function handleDelete(id) {
    const r = await deleteTask(id)
    if (!r.error) toast.success('Task deleted')
    return r
  }

  const rowProps = { canEdit, onToggle: handleToggle, onEdit: t => setModal({ task: t }) }

  if (projLoading || docsLoading || tasksLoading) return <div className="p-6 text-gray-500">Loading calendar...</div>
  const loadError = projError || docsError
  if (loadError) return <div className="p-6 text-red-500">Error: {loadError}</div>

  const selectedEvents = byDate[selected] ?? []

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
        <h1 className="text-xl font-bold text-gray-800">Calendar</h1>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} className="h-4 w-4 rounded" />
            Show completed
          </label>
          <div className="flex border border-gray-300 rounded overflow-hidden text-sm">
            {[['month', 'Month'], ['agenda', 'Agenda']].map(([id, label], i) => (
              <button
                key={id} onClick={() => setView(id)}
                className={`px-3 py-1.5 ${i > 0 ? 'border-l border-gray-300' : ''} ${view === id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {canEdit && (
            <button
              onClick={() => setModal({ task: null, date: selected })}
              className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm font-medium hover:bg-blue-700"
            >
              + Add task
            </button>
          )}
        </div>
      </div>

      {tasksError && (
        <div className="mb-3 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-sm text-amber-800">
          Tasks couldn't load ({tasksError}). Run <code>migrations/08_tasks.sql</code> in Supabase. Deadlines and deployments still show.
        </div>
      )}

      <FilterChips fields={FILTER_FIELDS} rows={allEvents} filters={filters} onChange={setFilters} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">
        {/* Left: month grid / agenda */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => shiftMonth(-1)} aria-label="Previous month" className="border border-gray-300 rounded px-2.5 py-1 text-sm hover:bg-gray-50">‹</button>
            <button onClick={() => shiftMonth(1)} aria-label="Next month" className="border border-gray-300 rounded px-2.5 py-1 text-sm hover:bg-gray-50">›</button>
            <button onClick={goToday} className="border border-gray-300 rounded px-3 py-1 text-sm hover:bg-gray-50">Today</button>
            <h2 className="text-base font-semibold text-gray-800 ml-1">{monthLabel}</h2>
          </div>

          {view === 'month' ? (
            <>
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">
                  {WEEKDAYS.map(w => <div key={w} className="px-2 py-2 text-center">{w}</div>)}
                </div>
                <div className="grid grid-cols-7">
                  {cells.map(c => {
                    const list = byDate[c.date] ?? []
                    const isToday = c.date === today
                    const isSel = c.date === selected
                    return (
                      <div
                        key={c.date}
                        onClick={() => setSelected(c.date)}
                        className={`min-h-[5.5rem] sm:min-h-[6.5rem] border-b border-r border-gray-100 p-1 cursor-pointer min-w-0 ${
                          c.inMonth ? '' : 'bg-gray-50/60'
                        } ${isSel ? 'ring-2 ring-inset ring-blue-500' : 'hover:bg-blue-50/40'}`}
                      >
                        <div className="flex justify-end mb-0.5">
                          <span className={`text-xs w-6 h-6 flex items-center justify-center rounded-full ${
                            isToday ? 'bg-blue-600 text-white font-semibold' : c.inMonth ? 'text-gray-700' : 'text-gray-400'
                          }`}>
                            {c.day}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {list.slice(0, MAX_CHIPS).map(e => (
                            <div key={e.key} title={e.title} className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate ${chipClass(e)}`}>
                              {e.title}
                            </div>
                          ))}
                          {list.length > MAX_CHIPS && (
                            <div className="text-[10px] text-gray-500 px-1">+{list.length - MAX_CHIPS} more</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 px-1 text-xs text-gray-500">
                {[['bg-blue-500', 'Document due'], ['bg-violet-500', 'Task'], ['bg-green-500', 'Deployment'], ['bg-red-500', 'Overdue']].map(([dot, label]) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${dot}`} /> {label}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {agendaGroups.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-10">Nothing scheduled in {monthLabel}.</p>
              ) : (
                agendaGroups.map(([date, list]) => (
                  <div key={date}>
                    <div className={`px-3 py-1.5 text-xs font-semibold border-b border-gray-100 ${
                      date === today ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-600'
                    }`}>
                      {formatLongDate(date)}{date === today && ' · Today'}
                    </div>
                    {list.map(e => <EventRow key={e.key} e={e} {...rowProps} />)}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right: selected day + attention */}
        <div className="space-y-4 min-w-0">
          {view === 'month' && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-gray-700">{formatLongDate(selected)}</span>
                {canEdit && (
                  <button onClick={() => setModal({ task: null, date: selected })} className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap">
                    + Task
                  </button>
                )}
              </div>
              {selectedEvents.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">Nothing on this day.</p>
              ) : (
                selectedEvents.map(e => <EventRow key={e.key} e={e} {...rowProps} />)
              )}
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50 text-sm font-semibold text-gray-700">Needs attention</div>
            <div className="max-h-[26rem] overflow-y-auto">
              {overdueList.length === 0 && soon.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-6">Nothing overdue or due this week 🎉</p>
              )}
              {overdueList.length > 0 && (
                <>
                  <div className="px-3 pt-2 pb-1 text-xs font-semibold text-red-600">Overdue ({overdueList.length})</div>
                  {overdueList.slice(0, 15).map(e => <EventRow key={e.key} e={e} showDate {...rowProps} />)}
                  {overdueList.length > 15 && (
                    <p className="text-xs text-gray-500 px-3 py-2">+{overdueList.length - 15} more. Use the filters to narrow down.</p>
                  )}
                </>
              )}
              {soon.length > 0 && (
                <>
                  <div className="px-3 pt-2 pb-1 text-xs font-semibold text-amber-600">Next 7 days ({soon.length})</div>
                  {soon.map(e => <EventRow key={e.key} e={e} showDate {...rowProps} />)}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {modal && (
        <TaskModal
          task={modal.task}
          defaultDate={modal.date}
          projectOptions={projectOptions}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}