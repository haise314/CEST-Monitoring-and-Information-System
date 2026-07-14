import { createBrowserRouter, RouterProvider, Outlet } from 'react-router'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Beneficiaries from './pages/Beneficiaries'
import Contacts from './pages/Contacts'

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
      { path: '/', element: <Dashboard /> },
      { path: '/projects', element: <Projects /> },
      { path: '/beneficiaries', element: <Beneficiaries /> },
      { path: '/contacts', element: <Contacts /> },
    ]
  }
])

function App() {
  return <RouterProvider router={router} />
}

export default App