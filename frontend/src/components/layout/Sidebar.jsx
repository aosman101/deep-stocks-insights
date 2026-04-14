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
  User,
  X,
  Bot,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/',              label: 'Home',            icon: Home       },
  { to: '/predict',       label: 'Predict',         icon: TrendingUp },
  { to: '/graph-analysis',label: 'Graph Analysis',  icon: LineChart  },
  { to: '/comparison',    label: 'Comparison',      icon: GitCompare },
  { to: '/ai-insights',   label: 'AI Insights',     icon: Sparkles   },
  { to: '/agent',         label: 'Agent Desk',      icon: Bot        },
  { to: '/learn',         label: 'Learn & Markets', icon: BookOpen   },
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
    if (onClose) onClose()
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-60 bg-surface-card/85 backdrop-blur-md
        border-r border-surface-border flex flex-col
        transform transition-transform duration-300 ease-out
        lg:relative lg:translate-x-0 lg:z-auto
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Masthead */}
        <div className="relative px-5 pt-6 pb-5 border-b border-surface-border">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 lg:hidden p-1 text-parchment-muted hover:text-parchment"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5 mb-1">
            <div className="relative flex h-7 w-7 items-center justify-center border border-ember-500/60">
              <div className="h-1.5 w-1.5 bg-ember-500 animate-pulse" />
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-parchment-muted">
              Research Terminal
            </div>
          </div>

          <div
            className="font-display font-light text-[22px] leading-[0.95] text-parchment tracking-tight mt-3"
            style={{ fontVariationSettings: '"opsz" 144, "SOFT" 40' }}
          >
            Deep Stock
            <br />
            <span className="italic text-ember-500" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100' }}>
              Insights
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-bull animate-pulse" />
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-parchment-muted">
              Markets Online
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
          <div className="eyebrow px-3 pb-3">Navigation</div>
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={handleNav}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3 py-2.5 text-[13px] transition-all duration-200 ${
                  isActive
                    ? 'text-parchment bg-ember-500/5 border-l-2 border-ember-500 pl-[10px]'
                    : 'text-parchment-dim border-l-2 border-transparent hover:text-parchment hover:bg-surface-hover/50 hover:border-surface-ring pl-[10px]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${
                    isActive ? 'text-ember-500' : 'text-parchment-muted group-hover:text-parchment-dim'
                  }`} />
                  <span className="font-medium tracking-tight flex-1">{label}</span>
                  {isActive && <span className="font-mono text-[9px] text-ember-500">●</span>}
                </>
              )}
            </NavLink>
          ))}

          {user?.role === 'admin' && (
            <>
              <div className="eyebrow px-3 pb-3 pt-6">Restricted</div>
              <NavLink
                to={ADMIN_ITEM.to}
                onClick={handleNav}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 px-3 py-2.5 text-[13px] transition-all duration-200 ${
                    isActive
                      ? 'text-parchment bg-ember-600/5 border-l-2 border-ember-600 pl-[10px]'
                      : 'text-parchment-dim border-l-2 border-transparent hover:text-parchment hover:bg-surface-hover/50 hover:border-surface-ring pl-[10px]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <ADMIN_ITEM.icon className={`w-4 h-4 flex-shrink-0 ${
                      isActive ? 'text-ember-600' : 'text-parchment-muted'
                    }`} />
                    <span className="font-medium tracking-tight flex-1">{ADMIN_ITEM.label}</span>
                  </>
                )}
              </NavLink>
            </>
          )}
        </nav>

        {/* User block */}
        <div className="border-t border-surface-border p-4 space-y-3">
          <NavLink
            to="/profile"
            onClick={handleNav}
            className="flex items-center gap-3 group"
          >
            <div className="relative flex h-9 w-9 items-center justify-center border border-surface-ring bg-surface-deep">
              <User className="w-4 h-4 text-parchment-dim group-hover:text-ember-500 transition-colors" />
              <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-bull ring-2 ring-surface-card" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="eyebrow">Signed in as</div>
              <div className="text-[13px] font-medium text-parchment truncate group-hover:text-ember-500 transition-colors">
                {user?.username}
              </div>
              {user?.role === 'admin' && (
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-ember-500 mt-0.5">
                  Administrator
                </div>
              )}
            </div>
          </NavLink>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 border border-surface-border text-[11px] font-mono uppercase tracking-[0.15em] text-parchment-muted hover:text-bear hover:border-bear/50 hover:bg-bear/5 transition-all"
          >
            <LogOut className="w-3 h-3" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}
