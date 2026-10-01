import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router'
import { useAuth } from '../../lib/AuthContext'
import { useTheme } from '../../lib/ThemeContext'
import { getBreadcrumb } from './navConfig'
import CommandPalette from './CommandPalette'
import { MenuIcon, SunIcon, MoonIcon, LogoutIcon, SearchIcon } from './icons'

function Breadcrumb() {
  const { pathname } = useLocation()
  const trail = getBreadcrumb(pathname)
  return (
    <div className="flex items-center gap-1.5 text-sm min-w-0">
      {trail.map((part, i) => {
        const last = i === trail.length - 1
        const cls = last ? 'font-semibold text-gray-800' : 'text-gray-400'
        return (
          <span key={i} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <span className="text-gray-300">/</span>}
            {part.to && !last
              ? <Link to={part.to} className={`${cls} hover:text-gray-700 truncate`}>{part.label}</Link>
              : <span className={`${cls} truncate`}>{part.label}</span>}
          </span>
        )
      })}
    </div>
  )
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      onClick={toggleTheme}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-800"
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

function UserMenu() {
  const { user, profile, role, isAdmin, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const email = user?.email ?? ''
  const name = profile?.full_name || email
  const initial = (name[0] ?? '?').toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Account menu"
        className="w-9 h-9 rounded-full bg-blue-600 text-white text-sm font-semibold flex items-center justify-center hover:bg-blue-700"
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="text-sm font-medium text-gray-800 truncate">{name}</div>
            <div className="text-xs text-gray-400 truncate">{email}</div>
            <span className="inline-block mt-1.5 text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              {role ?? 'no role'}
            </span>
          </div>
          {isAdmin && (
            <Link
              to="/backup"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              Backup &amp; restore
            </Link>
          )}
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            <LogoutIcon className="w-4 h-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)

export default function Topbar({ onOpenMobile }) {
  const [searchOpen, setSearchOpen] = useState(false)

  // Ctrl/Cmd + K opens global search from anywhere.
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(v => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-gray-200 flex items-center gap-3 px-4 sm:px-6">
      <button
        onClick={onOpenMobile}
        aria-label="Open menu"
        className="lg:hidden w-9 h-9 -ml-2 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100"
      >
        <MenuIcon />
      </button>
      <Breadcrumb />
      <span className="flex-1" />
      <button
        onClick={() => setSearchOpen(true)}
        className="hidden sm:flex items-center gap-2 w-56 lg:w-72 h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-400 hover:border-gray-300"
      >
        <SearchIcon className="w-4 h-4" />
        <span className="flex-1 text-left">Search...</span>
        <kbd className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>
      <button
        onClick={() => setSearchOpen(true)}
        aria-label="Search"
        className="sm:hidden w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100"
      >
        <SearchIcon />
      </button>
      <ThemeToggle />
      <UserMenu />
      {searchOpen && <CommandPalette onClose={() => setSearchOpen(false)} />}
    </header>
  )
}