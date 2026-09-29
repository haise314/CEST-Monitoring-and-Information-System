import { NavLink } from 'react-router'
import { NAV_GROUPS } from './navConfig'
import { ChevronLeftIcon, CloseIcon } from './icons'

function Brand({ collapsed }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
        C
      </div>
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <div className="text-sm font-bold text-gray-800 truncate">CEST-MIS</div>
          <div className="text-xs text-gray-400 truncate">Monitoring &amp; Information</div>
        </div>
      )}
    </div>
  )
}

function NavItem({ item, collapsed }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          collapsed ? 'justify-center' : ''
        } ${
          isActive
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  )
}

function NavList({ collapsed }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
      {NAV_GROUPS.map(group => (
        <div key={group.label}>
          {collapsed ? (
            <div className="mx-3 mb-2 border-t border-gray-200" />
          ) : (
            <div className="px-3 mb-1.5 text-xs font-medium text-gray-400">{group.label}</div>
          )}
          <div className="space-y-0.5">
            {group.items.map(item => <NavItem key={item.to} item={item} collapsed={collapsed} />)}
          </div>
        </div>
      ))}
    </nav>
  )
}

// Desktop: fixed rail, collapsible to icons. Below lg: off-canvas drawer.
export default function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }) {
  return (
    <>
      {/* Desktop rail */}
      <aside
        className={`hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col bg-white border-r border-gray-200 transition-[width] duration-200 ${
          collapsed ? 'w-[68px]' : 'w-60'
        }`}
      >
        <div className={`h-14 flex items-center border-b border-gray-200 flex-shrink-0 ${collapsed ? 'justify-center' : 'px-4'}`}>
          <Brand collapsed={collapsed} />
        </div>
        <NavList collapsed={collapsed} />
        <div className="p-3 border-t border-gray-200">
          <button
            onClick={onToggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800 ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <ChevronLeftIcon className={`w-5 h-5 flex-shrink-0 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={onCloseMobile} />
          <aside className="absolute inset-y-0 left-0 w-64 flex flex-col bg-white border-r border-gray-200 shadow-xl">
            <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 flex-shrink-0">
              <Brand collapsed={false} />
              <button onClick={onCloseMobile} aria-label="Close menu" className="text-gray-400 hover:text-gray-700">
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            <NavList collapsed={false} />
          </aside>
        </div>
      )}
    </>
  )
}