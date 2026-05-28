import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Beneficiaries from './pages/Beneficiaries'
import Contacts from './pages/Contacts'

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <>
        <Navbar />
        <main className="p-6">
          <Dashboard />
        </main>
      </>
    ),
  },
  {
    path: '/projects',
    element: (
      <>
        <Navbar />
        <main className="p-6">
          <Projects />
        </main>
      </>
    ),
  },
  {
    path: '/beneficiaries',
    element: (
      <>
        <Navbar />
        <main className="p-6">
          <Beneficiaries />
        </main>
      </>
    ),
  },
  {
    path: '/contacts',
    element: (
      <>
        <Navbar />
        <main className="p-6">
          <Contacts />
        </main>
      </>
    )
  }
])

function App() {
  return <RouterProvider router={router} />
}

export default App