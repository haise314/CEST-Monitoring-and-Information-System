import { createBrowserRouter, RouterProvider, Navigate, useLocation } from 'react-router'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { ThemeProvider } from './lib/ThemeContext'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/auth/Login'
import Dashboard from './pages/dashboard/Dashboard'
import Projects from './pages/projects/Projects'
import ProjectDetail from './pages/projects/ProjectDetail'
import Beneficiaries from './pages/beneficiaries/Beneficiaries'
import Contacts from './pages/contacts/Contacts'
import Documents from './pages/documents/Documents'
import Overview from './pages/overview/Overview'
import MapPage from './pages/map/Map'
import Itinerary from './pages/itinerary/Itinerary'

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
      // Itinerary is now a tab inside /map (Plan Visit mode) rather than its
      // own page. This redirect keeps old bookmarks/links to /itinerary alive.
      { path: '/itinerary', element: <Navigate to="/map?mode=plan" replace /> }
    ]
  }
])

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App