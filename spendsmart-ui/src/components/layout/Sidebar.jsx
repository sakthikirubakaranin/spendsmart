import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Receipt, Upload, PieChart,
  Target, Lightbulb, Repeat, FileText, Settings, LogOut, Users, SplitSquareVertical, CreditCard, TrendingUp
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import Logo from '../Logo'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/expenses',  icon: Receipt,         label: 'Expenses'  },
  { to: '/import',    icon: Upload,          label: 'Import'    },
  { to: '/analytics', icon: PieChart,        label: 'Analytics' },
  { to: '/budgets',   icon: Target,          label: 'Budgets'   },
  { to: '/tips',       icon: Lightbulb, label: 'Tips'      },
  { to: '/recurring',  icon: Repeat,    label: 'Recurring' },
  { to: '/groups',     icon: SplitSquareVertical, label: 'Split & Groups' },
  { to: '/accounts',   icon: CreditCard,          label: 'Accounts'      },
  { to: '/income',     icon: TrendingUp,          label: 'Income'        },
  { to: '/reports',    icon: FileText,  label: 'Reports'   },
  { to: '/settings',  icon: Settings,        label: 'Settings'  },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '??'

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] flex flex-col z-40"
      style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-subtle)' }}>

      {/* Logo */}
      <div className="px-5 py-6">
        <Logo size={30} />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
               ${isActive
                ? 'text-white'
                : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
              }`
            }
            style={({ isActive }) => isActive
              ? { background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.25)' }
              : {}
            }
          >
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="px-3 py-4 border-t space-y-1" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-200 truncate">{user?.full_name ?? 'User'}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email ?? ''}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
