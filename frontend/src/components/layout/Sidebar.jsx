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
  { to: '/',              label: 'Home',            icon: Home,        section: '§01' },
  { to: '/predict',       label: 'Predict',         icon: TrendingUp,  section: '§02' },
  { to: '/graph-analysis',label: 'Graph Analysis',  icon: LineChart,   section: '§03' },
  { to: '/comparison',    label: 'Comparison',      icon: GitCompare,  section: '§04' },
  { to: '/ai-insights',   label: 'AI Insights',     icon: Sparkles,    section: '§05' },
  { to: '/agent',         label: 'Agent Desk',      icon: Bot,         section: '§06' },
  { to: '/learn',         label: 'Learn & Markets', icon: BookOpen,    section: '§07' },
]

const ADMIN_ITEM = { to: '/admin', label: 'Admin', icon: ShieldCheck, section: '§⚡' }

function SectionMark({ mark, isActive }) {
  return (
    <span
      className={`font-mono text-[9px] tracking-[0.15em] w-7 flex-shrink-0 ${
        isActive ? 'text-ember-500' : 'text-parchment-faint'
      }`}
    >
      {mark}
    </span>
  )
}

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
          className="fixed inset-0 z-40 bg-surface/80 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-surface-card/85 backdrop-blur-md
        border-r border-surface-border flex flex-col
        transform transition-transform duration-300 ease-out
        lg:relative lg:translate-x-0 lg:z-auto
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Masthead */}
        <div className="relative px-6 pt-7 pb-6 border-b border-surface-border">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 lg:hidden p-1 text-parchment-muted hover:text-parchment"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="eyebrow mb-2">MMXXVI · Vol. I</div>
          <div
            className="font-display font-light text-[26px] leading-[0.95] text-parchment tracking-tight"
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
              Terminal Online
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
          <div className="eyebrow px-3 pb-3">── The Desk</div>
          {NAV_ITEMS.map(({ to, label, icon: Icon, section }) => (
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
                  <SectionMark mark={section} isActive={isActive} />
                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
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
              <div className="eyebrow px-3 pb-3 pt-6">── Restricted</div>
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
                    <SectionMark mark={ADMIN_ITEM.section} isActive={isActive} />
                    <ADMIN_ITEM.icon className={`w-3.5 h-3.5 flex-shrink-0 ${
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
            <div className="relative flex h-9 w-9 items-center justify-center border border-surface-ring bg-surface">
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
                  ★ Editor-in-Chief
                </div>
              )}
            </div>
          </NavLink>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 border border-surface-border text-[11px] font-mono uppercase tracking-[0.15em] text-parchment-muted hover:text-bear hover:border-bear/50 hover:bg-bear/5 transition-all"
          >
            <LogOut className="w-3 h-3" />
            Close Terminal
          </button>
        </div>
      </aside>
    </>
  )
}
