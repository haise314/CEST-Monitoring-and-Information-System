import { createBrowserRouter, RouterProvider, Outlet, Navigate } from 'react-router'
import Navbar from './components/Navbar'
import Dashboard from './pages/dashboard/Dashboard'
import Projects from './pages/projects/Projects'
import ProjectDetail from './pages/projects/ProjectDetail'
import Beneficiaries from './pages/beneficiaries/Beneficiaries'
import Contacts from './pages/contacts/Contacts'
import Documents from './pages/documents/Documents'
import Overview from './pages/overview/Overview'
import MapPage from './pages/map/Map'
import Itinerary from './pages/itinerary/Itinerary'

const Layout = () => (
  <>
    <Navbar />
    <main className="p-6">
      <Outlet />
    </main>
  </>
)

const router = createBrowserRouter([
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
  return <RouterProvider router={router} />
}

export default App