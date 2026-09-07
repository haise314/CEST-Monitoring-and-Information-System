import { createBrowserRouter, RouterProvider, Outlet } from 'react-router'
import Navbar from './components/Navbar'
import Dashboard from './pages/dashboard/Dashboard'
import Projects from './pages/projects/Projects'
import Beneficiaries from './pages/beneficiaries/Beneficiaries'
import Contacts from './pages/contacts/Contacts'
import Documents from './pages/documents/Documents'
import Overview from './pages/overview/Overview'
import MapPage from './pages/map/Map'

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
      { path: '/documents', element: <Documents /> },
      { path: '/beneficiaries', element: <Beneficiaries /> },
      { path: '/contacts', element: <Contacts /> },
      { path: '/map', element: <MapPage /> }
    ]
  }
])

function App() {
  return <RouterProvider router={router} />
}

export default App