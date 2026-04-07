import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Home,
  TrendingUp,
  LineChart,
  GitCompare,
  Sparkles,
  BookOpen,
  ShieldCheck,
  LogOut,
  Cpu,
  User,
  X,
  Bot,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/',              label: 'Home',           icon: Home },
  { to: '/predict',       label: 'Predict',        icon: TrendingUp },
  { to: '/graph-analysis',label: 'Graph Analysis', icon: LineChart },
  { to: '/comparison',    label: 'Comparison',     icon: GitCompare },
  { to: '/ai-insights',   label: 'AI Insights',    icon: Sparkles },
  { to: '/agent',         label: 'Agent Dashboard', icon: Bot },
  { to: '/learn',         label: 'Learn & Markets', icon: BookOpen },
]

const ADMIN_ITEM = { to: '/admin', label: 'Admin', icon: ShieldCheck }

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleNav = () => {
    // Close on mobile after navigating
    if (onClose) onClose()
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-56 bg-surface-card border-r border-surface-border flex flex-col
        transform transition-transform duration-200 ease-in-out
        lg:relative lg:translate-x-0 lg:z-auto
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo + mobile close */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <Cpu className="w-6 h-6 text-accent-blue" />
            <span className="font-bold text-white tracking-tight leading-tight text-sm">
              Deep Stock<br />
              <span className="text-accent-blue">Insights</span>
            </span>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 rounded text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={handleNav}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent-blue/20 text-accent-blue'
                    : 'text-gray-400 hover:bg-surface-hover hover:text-white'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}

          {user?.role === 'admin' && (
            <NavLink
              to={ADMIN_ITEM.to}
              onClick={handleNav}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'text-gray-400 hover:bg-surface-hover hover:text-white'
                }`
              }
            >
              <ADMIN_ITEM.icon className="w-4 h-4 flex-shrink-0" />
              {ADMIN_ITEM.label}
            </NavLink>
          )}
        </nav>

        {/* User + logout */}
        <div className="px-3 py-4 border-t border-surface-border space-y-1">
          <NavLink
            to="/profile"
            onClick={handleNav}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent-blue/20 text-accent-blue'
                  : 'text-gray-400 hover:bg-surface-hover hover:text-white'
              }`
            }
          >
            <User className="w-4 h-4 flex-shrink-0" />
            Profile
          </NavLink>
          <div className="px-3 py-2">
            <p className="text-xs text-gray-500">Signed in as</p>
            <p className="text-sm text-white font-medium truncate">{user?.username}</p>
            {user?.role === 'admin' && (
              <span className="text-xs text-yellow-400 font-medium">Admin</span>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-surface-hover hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Log out
          </button>
        </div>
      </aside>
    </>
  )
}
