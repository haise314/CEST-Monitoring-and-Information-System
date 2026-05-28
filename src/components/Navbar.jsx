import { Link } from 'react-router-dom'

function Navbar() {
  return (
    <nav className="bg-gray-800 text-white px-6 py-4 flex gap-6">
      <Link to="/">Dashboard</Link>
      <Link to="/projects">Projects</Link>
      <Link to="/beneficiaries">Beneficiaries</Link>
      <Link to="/contacts">Contacts</Link>
    </nav>
  )
}

export default Navbar