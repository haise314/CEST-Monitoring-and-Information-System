import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

function Navbar() {
  const { user, signOut } = useAuth()

  return (
    <nav className="bg-gray-800 text-white px-6 py-4 flex gap-6 items-center">
      <Link to="/">Dashboard</Link>
      <Link to="/overview">Overview</Link>
      <Link to="/projects">Projects</Link>
      <Link to="/documents">Documents</Link>
      <Link to="/beneficiaries">Beneficiaries</Link>
      <Link to="/contacts">Contacts</Link>
      <Link to="/map">Map</Link>
      <span className="flex-1" />
      {user && <span className="text-sm text-gray-300">{user.email}</span>}
      <button onClick={signOut} className="text-sm text-gray-300 hover:text-white underline">
        Sign out
      </button>
    </nav>
  )
}

export default Navbar