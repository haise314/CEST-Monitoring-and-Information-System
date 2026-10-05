import { PHASE_ORDER } from '../../lib/documentProgress'

// Value editor for the "Document status" filter chip on the Documents page.
// value = [{ typeId, conditionId }, …] — e.g. "MOA is missing" AND
// "1st Progress Report is submitted". Rows still missing a choice are ignored.
// Rendered by FilterChips (which supplies the Clear / Done footer); the data it
// needs (document types by phase, the available conditions) hangs off `field`.

const selectCls = 'w-full border border-gray-300 rounded-lg px-2 py-2 text-base sm:text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500'
const BLANK_RULE = { typeId: '', conditionId: '' }

export default function DocumentRulesEditor({ field, value, onChange }) {
  const { typesByPhase, conditions } = field
  const rows = value.length ? value : [BLANK_RULE]

  const update = (i, patch) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const remove = i => onChange(rows.filter((_, idx) => idx !== i))

  return (
    <div className="p-3 space-y-3 overflow-y-auto min-h-0">
      {rows.map((r, i) => (
        <div key={i} className="rounded-lg border border-gray-200 p-2 space-y-1.5">
          <select
            aria-label="Document"
            value={r.typeId}
            onChange={e => update(i, { typeId: e.target.value })}
            className={selectCls}
          >
            <option value="">Choose a document…</option>
            {PHASE_ORDER.map(phase => (
              <optgroup key={phase} label={phase}>
                {(typesByPhase[phase] ?? []).map(t => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}{t.is_required ? '' : ' (optional)'}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <select
              aria-label="Condition"
              value={r.conditionId}
              onChange={e => update(i, { conditionId: e.target.value })}
              className={selectCls}
            >
              <option value="">…is…</option>
              {conditions.map(c => (
                <option key={c.id} value={c.id}>{c.label ?? c.name ?? c.id}</option>
              ))}
            </select>
            {rows.length > 1 && (
              <button
                onClick={() => remove(i)}
                aria-label="Remove this rule"
                className="text-gray-400 hover:text-red-500 px-2 py-1 flex-shrink-0"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      ))}

      <button
        onClick={() => onChange([...rows, BLANK_RULE])}
        className="text-sm sm:text-xs text-blue-600 hover:text-blue-800 py-1"
      >
        + Add another document rule
      </button>
    </div>
  )
}