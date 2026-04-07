import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AppShell from './components/layout/AppShell'
import LoadingSpinner from './components/ui/LoadingSpinner'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const PredictPage = lazy(() => import('./pages/PredictPage'))
const GraphAnalysisPage = lazy(() => import('./pages/GraphAnalysisPage'))
const ComparisonPage = lazy(() => import('./pages/ComparisonPage'))
const AIInsightsPage = lazy(() => import('./pages/AIInsightsPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const LearnPage = lazy(() => import('./pages/LearnPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const AgentPage = lazy(() => import('./pages/AgentPage'))

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <Suspense fallback={(
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )}>
      <Routes>
      {/* Public routes */}
      <Route path="/login"    element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <RegisterPage />} />

      {/* Protected app shell */}
      <Route path="/" element={
        <ProtectedRoute>
          <AppShell />
        </ProtectedRoute>
      }>
        <Route index                   element={<HomePage />} />
        <Route path="predict"          element={<PredictPage />} />
        <Route path="crypto"           element={<Navigate to="/predict?asset=BTC&model=lstm" replace />} />
        <Route path="stocks"           element={<Navigate to="/predict?asset=TSLA&model=xgboost" replace />} />
        <Route path="graph-analysis"   element={<GraphAnalysisPage />} />
        <Route path="comparison"       element={<ComparisonPage />} />
        <Route path="history"          element={<Navigate to="/graph-analysis?period=25y" replace />} />
        <Route path="ai-insights"      element={<AIInsightsPage />} />
        <Route path="agent"            element={<AgentPage />} />
        <Route path="learn"             element={<LearnPage />} />
        <Route path="profile"          element={<ProfilePage />} />
        <Route path="admin"            element={
          <ProtectedRoute adminOnly>
            <AdminPage />
          </ProtectedRoute>
        } />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
