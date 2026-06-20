import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function DashboardLayout() {
  const { profile, signOut, isSuperAdmin } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <h3>Rent Manager</h3>
        <p className="owner-name">{profile?.full_name}</p>
        <nav>
          <NavLink to="/dashboard">Overview</NavLink>
          <NavLink to="/dashboard/properties">Properties</NavLink>
          <NavLink to="/dashboard/rentals">Rentals</NavLink>
          <NavLink to="/dashboard/invoices">Invoices</NavLink>
          <NavLink to="/dashboard/overdue">Overdue</NavLink>
          <NavLink to="/dashboard/messages">SMS / WhatsApp</NavLink>
          {isSuperAdmin && <NavLink to="/admin">Super Admin</NavLink>}
        </nav>
        <button className="signout-btn" onClick={handleSignOut}>Sign out</button>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
