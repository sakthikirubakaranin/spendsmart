import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './hooks/useAuth'
import DashboardPage from './pages/DashboardPage'
import ExpensesPage from './pages/ExpensesPage'
import ImportPage from './pages/ImportPage'
import AnalyticsPage from './pages/AnalyticsPage'
import BudgetsPage from './pages/BudgetsPage'
import TipsPage from './pages/TipsPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import RecurringPage from './pages/RecurringPage'
import GroupsPage from './pages/GroupsPage'
import GroupDetailPage from './pages/GroupDetailPage'
import AccountsPage from './pages/AccountsPage'
import IncomePage from './pages/IncomePage'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  return user ? children : <Navigate to="/login" replace />
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/dashboard" replace /> : children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
        <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
        <Route path="/reset-password" element={<GuestOnly><ResetPasswordPage /></GuestOnly>} />

        <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
        <Route path="/expenses" element={<RequireAuth><ExpensesPage /></RequireAuth>} />
        <Route path="/import" element={<RequireAuth><ImportPage /></RequireAuth>} />
        <Route path="/analytics" element={<RequireAuth><AnalyticsPage /></RequireAuth>} />
        <Route path="/budgets" element={<RequireAuth><BudgetsPage /></RequireAuth>} />
        <Route path="/tips" element={<RequireAuth><TipsPage /></RequireAuth>} />
        <Route path="/reports" element={<RequireAuth><ReportsPage /></RequireAuth>} />
        <Route path="/recurring" element={<RequireAuth><RecurringPage /></RequireAuth>} />
        <Route path="/groups" element={<RequireAuth><GroupsPage /></RequireAuth>} />
        <Route path="/groups/:id" element={<RequireAuth><GroupDetailPage /></RequireAuth>} />
        <Route path="/accounts" element={<RequireAuth><AccountsPage /></RequireAuth>} />
        <Route path="/income" element={<RequireAuth><IncomePage /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
      </Routes>
    </AuthProvider>
  )
}
