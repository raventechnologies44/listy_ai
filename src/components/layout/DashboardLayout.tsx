import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
<<<<<<< HEAD
import { getPlan, planLabel, isTrialActive, trialDaysRemaining } from '../../lib/plans'
=======
import { getPlan, planLabel } from '../../lib/plans'
>>>>>>> c98eb7acb7cfce65c1b4c0831f03af377b3b7569
import { userInitials } from '../../lib/format'
import { AppFooter } from '../AppFooter'

const navGroups = [
  {
    label: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Overview', icon: '⌂', end: true },
      { to: '/dashboard/properties', label: 'Properties', icon: '▣' },
      { to: '/dashboard/properties/new', label: 'Add property', icon: '+' },
      { to: '/dashboard/leads', label: 'Leads', icon: '◉' },
      { to: '/dashboard/follow-ups', label: 'Follow-ups', icon: '↻' },
      { to: '/dashboard/scheduling', label: 'Scheduling', icon: '□' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/dashboard/whatsapp', label: 'WhatsApp enquiries', icon: '◌' },
      { to: '/dashboard/whatsapp-business', label: 'WhatsApp Business', icon: '◉' },
      { to: '/dashboard/analytics', label: 'Analytics', icon: '⌁' },
      { to: '/dashboard/billing', label: 'Billing & payments', icon: '$' },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/dashboard/about', label: 'About ListyAI', icon: 'i' },
      { to: '/dashboard/profile', label: 'Settings & profile', icon: '⚙' },
    ],
  },
]

export function DashboardLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const displayName = profile?.full_name || profile?.email || 'Agent'
  const plan = getPlan(profile)

  async function handleLogout() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="app-shell">
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sb-brand">
          <div className="brand-symbol">L</div>
          <div className="sb-brand-copy">
            <div className="name">Listy<span>AI</span></div>
            <div className="brand-subtitle">Real estate workspace</div>
          </div>
        </div>

        <div className="plan-mini">
          <div>
            <span>Current plan</span>
            <strong>{planLabel(plan)}</strong>
          </div>
          <span className="plan-dot" />
        </div>

        <nav className="sb-nav">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `sb-item${isActive ? ' active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="sb-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-velora">
            <img src="/velora-symbol.png" alt="VELORA" />
            <span>Powered by VELORA</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="hamburger"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
            <div className="mobile-brand">
              <div className="brand-symbol small">L</div>
              <strong>Listy<span>AI</span></strong>
            </div>
            <div className="breadcrumb-current">{location.pathname === '/dashboard' ? 'Overview' : ''}</div>
          </div>
          <div className="topbar-right">
<<<<<<< HEAD
            <div className="plan-pill"><span>{planLabel(plan)}</span>{isTrialActive(profile) && <small>{trialDaysRemaining(profile)}d trial</small>}</div>
=======
            <div className="plan-pill"><span>{planLabel(plan)}</span></div>
>>>>>>> c98eb7acb7cfce65c1b4c0831f03af377b3b7569
            <div className="topbar-user">
              <div className="avatar" title={displayName}>{userInitials(displayName)}</div>
              <div className="topbar-user-copy">
                <strong>{displayName}</strong>
                <span>{profile?.brokerage || 'Real estate agent'}</span>
              </div>
            </div>
            <button type="button" className="btn btn-ghost topbar-logout" onClick={() => void handleLogout()}>
              Log out
            </button>
          </div>
        </div>

        <div className="main-content">
          <Outlet />
        </div>
        <AppFooter />
      </main>
    </div>
  )
}
