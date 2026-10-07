import { IconPreview } from '../projects/ProjectTypeIconsEditor'

// Legend of project-type icons shown under the map. `types` is the list from
// useProjectTypeIcons ([{ id, name, icon_svg }]); only types that have an
// uploaded icon are listed. `usedTypeIds` (optional Set) limits the legend to
// types that actually appear on pinned beneficiaries.
export default function IconLegend({ types, usedTypeIds = null }) {
  const shown = types.filter(t => t.icon_svg && (!usedTypeIds || usedTypeIds.has(t.id)))
  if (shown.length === 0) return null

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 px-1 pt-2 border-t border-gray-100">
      <span className="text-xs font-medium text-gray-400">Project types</span>
      {shown.map(t => (
        <div key={t.id} className="flex items-center gap-1.5 text-xs text-gray-500">
          <IconPreview svg={t.icon_svg} size={16} />
          {t.name}
        </div>
      ))}
    </div>
  )
}