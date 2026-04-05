import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Cpu, AlertCircle, CheckCircle2 } from 'lucide-react'
import api from '../services/api'

export default function RegisterPage() {
  const [form, setForm] = useState({
    username: '', email: '', password: '', confirm: '',
    full_name: '', institution: '',
  })
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) {
      setError('Passwords do not match')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      await api.post('/api/auth/register', {
        username: form.username,
        email: form.email,
        password: form.password,
        full_name: form.full_name || undefined,
        institution: form.institution || undefined,
      })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Registration failed. Try a different username or email.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="card text-center max-w-sm w-full">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="text-white font-semibold text-lg">Account created!</p>
          <p className="text-gray-400 text-sm mt-1">Redirecting to login…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="w-7 h-7 text-accent-blue" />
            <span className="text-xl font-bold text-white">Deep Stock <span className="text-accent-blue">Insights</span></span>
          </div>
        </div>

        <div className="card">
          <h1 className="text-lg font-semibold text-white mb-6">Create account</h1>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1 font-medium">Username *</label>
                <input name="username" value={form.username} onChange={handleChange} required
                  className="w-full bg-surface-hover border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-blue/60"
                  placeholder="johndoe" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1 font-medium">Email *</label>
                <input name="email" type="email" value={form.email} onChange={handleChange} required
                  className="w-full bg-surface-hover border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-blue/60"
                  placeholder="john@example.com" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1 font-medium">Full name</label>
                <input name="full_name" value={form.full_name} onChange={handleChange}
                  className="w-full bg-surface-hover border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-blue/60"
                  placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1 font-medium">Institution</label>
                <input name="institution" value={form.institution} onChange={handleChange}
                  className="w-full bg-surface-hover border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-blue/60"
                  placeholder="University / Company" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1 font-medium">Password *</label>
                <input name="password" type="password" value={form.password} onChange={handleChange} required
                  className="w-full bg-surface-hover border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-blue/60"
                  placeholder="Min. 8 characters" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1 font-medium">Confirm password *</label>
                <input name="confirm" type="password" value={form.confirm} onChange={handleChange} required
                  className="w-full bg-surface-hover border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-blue/60"
                  placeholder="Repeat password" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 text-sm font-semibold disabled:opacity-50 mt-2"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-accent-blue hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
