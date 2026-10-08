import { createBrowserRouter, RouterProvider, Navigate, useLocation } from 'react-router'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { ThemeProvider } from './lib/ThemeContext'
import { ToastProvider } from './lib/ToastContext'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/auth/Login'
import About from './pages/about/About'
import Dashboard from './pages/dashboard/Dashboard'
import Projects from './pages/projects/Projects'
import ProjectDetail from './pages/projects/ProjectDetail'
import Beneficiaries from './pages/beneficiaries/Beneficiaries'
import Contacts from './pages/contacts/Contacts'
import Documents from './pages/documents/Documents'
import Overview from './pages/overview/Overview'
import MapPage from './pages/map/Map'
import Backup from './pages/backup/Backup'
import Budget from './pages/budget/Budget'
import Agencies from './pages/agencies/Agencies'

// Gate for everything under the main Layout. Shows a brief loading state
// while Supabase checks for an existing session, then either renders the
// app or bounces to /login (remembering where the user was headed).
function RequireAuth({ children }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="p-6 text-sm text-gray-400">Loading...</div>
  }
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return children
}

// Sidebar + top bar shell (components/layout/) — it renders the <Outlet />.
const Layout = () => (
  <RequireAuth>
    <AppLayout />
  </RequireAuth>
)

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  // Public info page about CEST 2.0 (linked from the login card).
  { path: '/about', element: <About /> },
  {
    element: <Layout />,
    children: [
      { path: '/overview', element: <Overview /> },
      { path: '/', element: <Dashboard /> },
      { path: '/projects', element: <Projects /> },
      { path: '/projects/:id', element: <ProjectDetail /> },
      { path: '/documents', element: <Documents /> },
      { path: '/beneficiaries', element: <Beneficiaries /> },
      { path: '/contacts', element: <Contacts /> },
      { path: '/map', element: <MapPage /> },
      { path: '/budget', element: <Budget /> },
      { path: '/agencies', element: <Agencies /> },
      // Itinerary is now a tab inside /map (Plan Visit mode) rather than its
      // own page. This redirect keeps old bookmarks/links to /itinerary alive.
      { path: '/itinerary', element: <Navigate to="/map?mode=plan" replace /> },
      { path: '/backup', element: <Backup />}
    ]
  }
])

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App