import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import BackupReminder from './BackupReminder'

const COLLAPSED_KEY = 'cest_sidebar_collapsed'

function readCollapsed() {
  try { return localStorage.getItem(COLLAPSED_KEY) === '1' } catch { return false }
}

// Sidebar + top bar shell. Rendered inside RequireAuth in App.jsx.
export default function AppLayout() {
  const [collapsed, setCollapsed]   = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    try { localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0') } catch { /* ignore */ }
  }, [collapsed])

  // Close the mobile drawer after navigating.
  useEffect(() => { setMobileOpen(false) }, [pathname])

  return (
    <div className="min-h-screen">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(v => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className={`min-w-0 transition-[padding] duration-200 ${collapsed ? 'lg:pl-[68px]' : 'lg:pl-60'}`}>
        <Topbar onOpenMobile={() => setMobileOpen(true)} />
        <main className="p-4 sm:p-6 min-w-0">
          <BackupReminder />
          <Outlet />
        </main>
      </div>
    </div>
  )
}