import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router'
import { useProjects } from '../../hooks/useProjects'
import { useBudgets } from '../../hooks/useBudgets'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import Select from '../../components/common/Select'
import { summarizeYear, formatPeso, budgetBarColor, projectLabel } from '../../lib/budget'
import { parseAmount } from '../projects/columns'

const inputClass = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

function Card({ children, flush = false }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden ${flush ? '' : 'p-5'}`}>
      {children}
    </div>
  )
}

function Stat({ label, value, tone }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl sm:text-2xl font-bold tabular-nums ${tone ?? 'text-gray-800'}`}>{value}</div>
    </div>
  )
}

function ProjectRow({ p, muted = false }) {
  const sub = [p.beneficiaries?.name, p.beneficiaries?.municipality, p.project_category].filter(Boolean).join(' · ')
  return (
    <Link
      to={`/projects/${p.id}`}
      className="flex items-start justify-between gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50"
    >
      <div className="min-w-0">
        <div className={`text-sm break-words ${muted ? 'text-gray-500' : 'text-gray-800'}`}>{projectLabel(p)}</div>
        {sub && <div className="text-xs text-gray-400 break-words">{sub}</div>}
      </div>
      <div className="text-sm tabular-nums whitespace-nowrap text-right">
        {p.amount != null
          ? <span className={muted ? 'text-gray-400' : 'text-gray-800'}>{formatPeso(p.amount)}</span>
          : <span className="text-amber-600 text-xs">No amount</span>}
      </div>
    </Link>
  )
}

function ListCard({ title, count, children }) {
  return (
    <Card flush>
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">{count}</span>
      </div>
      {children}
    </Card>
  )
}

export default function Budget() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const { projects, loading: projLoading, error: projError } = useProjects()
  const { budgets, loading: budLoading, error: budError, saveBudget } = useBudgets()

  const thisYear = new Date().getFullYear()
  const [year, setYear]               = useState(thisYear)
  const [amountInput, setAmountInput] = useState('')
  const [notesInput, setNotesInput]   = useState('')
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState(null)

  const years = useMemo(() => {
    const set = new Set([thisYear])
    budgets.forEach(b => set.add(Number(b.year)))
    projects.forEach(p => p.year && set.add(Number(p.year)))
    return [...set].sort((a, b) => b - a)
  }, [budgets, projects, thisYear])

  const budget = budgets.find(b => Number(b.year) === Number(year)) ?? null
  const allocated = budget ? Number(budget.allocated_amount) : null
  const summary = useMemo(() => summarizeYear(projects, year, allocated), [projects, year, allocated])

  // Reset the editor whenever the selected year or its saved values change.
  useEffect(() => {
    setAmountInput(budget ? String(Number(budget.allocated_amount)) : '')
    setNotesInput(budget?.notes ?? '')
    setSaveError(null)
  }, [year, budget?.allocated_amount, budget?.notes]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    const amount = parseAmount(amountInput)
    if (amount == null || amount < 0) {
      setSaveError('Enter a valid amount (0 or more).')
      return
    }
    setSaving(true)
    setSaveError(null)
    const { error } = await saveBudget({ year: Number(year), allocated_amount: amount, notes: notesInput.trim() || null })
    setSaving(false)
    if (error) setSaveError(error)
    else toast.success(`${year} budget saved`)
  }

  if (projLoading || budLoading) return <div className="p-6 text-sm text-gray-500">Loading budget...</div>
  if (projError || budError) {
    return (
      <div className="p-6 text-sm text-red-500">
        Could not load budget data: {projError || budError}
        {budError && <div className="text-gray-500 mt-1">If this is the first time, run the budget SQL migration in Supabase.</div>}
      </div>
    )
  }

  const { used, remaining, pct, over, counted, regional, missingAmount } = summary

  return (
    <div className="max-w-5xl mx-auto w-full space-y-5 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Budget</h1>
          <p className="text-sm text-gray-400">
            Budget of the Provincial CEST office for projects implemented in {year}.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Year</span>
          <Select value={year} onChange={e => setYear(Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1.5 text-sm">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </Select>
        </div>
      </div>

      {over && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <strong>Over budget by {formatPeso(Math.abs(remaining))}.</strong>{' '}
          Provincial projects for {year} total {formatPeso(used)} against a budget of {formatPeso(allocated)}.
        </div>
      )}

      <Card>
        <div className="grid grid-cols-3 gap-4">
          <Stat label={`${year} budget`} value={allocated != null ? formatPeso(allocated) : '—'} />
          <Stat label="Used (Provincial)" value={formatPeso(used)} />
          <Stat
            label="Remaining"
            value={remaining != null ? formatPeso(remaining) : '—'}
            tone={remaining != null && remaining < 0 ? 'text-red-500' : undefined}
          />
        </div>

        {allocated != null ? (
          <div className="mt-4">
            <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${budgetBarColor(pct)}`} style={{ width: `${Math.min(pct ?? 0, 100)}%` }} />
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {pct != null ? `${pct.toFixed(1)}% of the budget is committed` : 'Budget is 0'}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 mt-4">
            No budget has been set for {year} yet.{!isAdmin && ' An admin can set it.'}
          </p>
        )}

        {budget?.notes && !isAdmin && <p className="text-sm text-gray-500 mt-3">{budget.notes}</p>}

        {isAdmin && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <div className="text-xs font-medium text-gray-500 mb-2">{budget ? `Edit ${year} budget` : `Set ${year} budget`}</div>
            <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr_auto] gap-2 items-start">
              <input
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={e => setAmountInput(e.target.value)}
                placeholder="Amount, e.g. 5,000,000"
                className={inputClass}
              />
              <input
                type="text"
                value={notesInput}
                onChange={e => setNotesInput(e.target.value)}
                placeholder="Notes (optional)"
                className={inputClass}
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
            {saveError && <p className="text-red-500 text-xs mt-2">{saveError}</p>}
          </div>
        )}
      </Card>

      {missingAmount.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          {missingAmount.length} Provincial project{missingAmount.length === 1 ? ' has' : 's have'} no amount entered, so
          {missingAmount.length === 1 ? ' it is' : ' they are'} not in the total:{' '}
          {missingAmount.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ', '}
              <Link to={`/projects/${p.id}`} className="underline">{projectLabel(p)}</Link>
            </span>
          ))}
        </div>
      )}

      <ListCard title={`Counted projects (Provincial, ${year})`} count={counted.length}>
        {counted.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No Provincial projects for {year}.</p>
        ) : (
          <>
            {counted.map(p => <ProjectRow key={p.id} p={p} />)}
            <div className="flex justify-between px-4 py-2.5 bg-gray-50 text-sm font-semibold text-gray-700">
              <span>Total</span>
              <span className="tabular-nums">{formatPeso(used)}</span>
            </div>
          </>
        )}
      </ListCard>

      {regional.length > 0 && (
        <ListCard title={`Regional projects (not counted, ${year})`} count={regional.length}>
          {regional.map(p => <ProjectRow key={p.id} p={p} muted />)}
        </ListCard>
      )}

      {budgets.length > 0 && (
        <Card flush>
          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-sm font-semibold text-gray-700">All years</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Year</th>
                  <th className="text-right font-medium px-4 py-2">Budget</th>
                  <th className="text-right font-medium px-4 py-2">Used</th>
                  <th className="text-right font-medium px-4 py-2">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {budgets.map(b => {
                  const s = summarizeYear(projects, b.year, Number(b.allocated_amount))
                  return (
                    <tr key={b.year} onClick={() => setYear(Number(b.year))} className="cursor-pointer hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{b.year}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatPeso(s.allocated)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatPeso(s.used)}</td>
                      <td className={`px-4 py-2 text-right tabular-nums ${s.over ? 'text-red-500 font-medium' : ''}`}>{formatPeso(s.remaining)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}