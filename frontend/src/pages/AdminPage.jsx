import { useState, useEffect } from 'react'
import api, { adminApi, scannerApi } from '../services/api'
import { useToast } from '../context/ToastContext'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { LSTM_FEATURED_SYMBOLS } from '../lib/predictConfig'
import {
  ShieldCheck, Users, Cpu, RefreshCw, Trash2,
  UserCheck, UserX, ChevronDown, Play, CheckCircle2, XCircle,
} from 'lucide-react'

function UserRow({ user, onToggle, onDelete, onChangeRole }) {
  return (
    <tr className="border-b border-surface-border/50 hover:bg-surface-hover transition-colors">
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-white">{user.username}</p>
        <p className="text-xs text-gray-500">{user.email}</p>
      </td>
      <td className="px-4 py-3 text-sm text-gray-400">{user.full_name ?? '—'}</td>
      <td className="px-4 py-3 text-sm text-gray-400">{user.institution ?? '—'}</td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          user.role === 'admin' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-700 text-gray-300'
        }`}>
          {user.role}
        </span>
      </td>
      <td className="px-4 py-3">
        {user.is_active
          ? <CheckCircle2 className="w-4 h-4 text-green-400" />
          : <XCircle className="w-4 h-4 text-red-400" />
        }
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggle(user.id, user.is_active)}
            title={user.is_active ? 'Deactivate' : 'Activate'}
            className="p-1.5 rounded hover:bg-surface text-gray-400 hover:text-white transition-colors"
          >
            {user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onChangeRole(user.id, user.role === 'admin' ? 'user' : 'admin')}
            title="Toggle admin"
            className="p-1.5 rounded hover:bg-surface text-gray-400 hover:text-yellow-400 transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(user.id)}
            title="Deactivate user"
            className="p-1.5 rounded hover:bg-surface text-gray-400 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

function TrainingPanel() {
  const [training,  setTraining]  = useState(false)
  const [trainMsg,  setTrainMsg]  = useState('')
  const [assetType, setAssetType] = useState('all')

  const handleTrainAll = async () => {
    setTraining(true)
    setTrainMsg('')
    try {
      const res = await scannerApi.trainAll(assetType)
      setTrainMsg(`✓ Training queued for ${res.data.symbols?.length ?? '?'} assets in background`)
    } catch (e) {
      setTrainMsg('✗ ' + (e.response?.data?.detail ?? 'Training failed'))
    } finally {
      setTraining(false)
    }
  }

  return (
    <div className="card space-y-4">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
        <Cpu className="w-4 h-4 text-accent-blue" />
        Model Training
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-surface-hover rounded-xl p-4 border border-surface-border">
          <p className="text-sm font-medium text-white mb-1">N-HiTS Models</p>
          <p className="text-xs text-gray-400 mb-3">
            Featured sequence models across crypto, commodities, and large-cap equities
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {LSTM_FEATURED_SYMBOLS.map(asset => (
              <TrainAssetButton key={asset} asset={asset} apiCall={() => adminApi.trainModel(asset)} />
            ))}
          </div>
        </div>

        <div className="bg-surface-hover rounded-xl p-4 border border-surface-border">
          <p className="text-sm font-medium text-white mb-1">LightGBM Models</p>
          <p className="text-xs text-gray-400 mb-3">Train all assets in background (~30s each)</p>
          <div className="flex items-center gap-2 mb-3">
            {['all','crypto','stocks'].map(t => (
              <button
                key={t}
                onClick={() => setAssetType(t)}
                className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${
                  assetType === t ? 'bg-accent-blue text-white' : 'bg-surface border border-surface-border text-gray-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            onClick={handleTrainAll}
            disabled={training}
            className="btn-primary w-full text-sm flex items-center justify-center gap-2"
          >
            {training ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {training ? 'Queuing…' : `Train ${assetType} LightGBM`}
          </button>
          {trainMsg && (
            <p className={`text-xs mt-2 ${trainMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
              {trainMsg}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function TrainAssetButton({ asset, apiCall }) {
  const [state, setState] = useState('idle')   // idle | loading | ok | error
  const handle = async () => {
    setState('loading')
    try {
      await apiCall()
      setState('ok')
      setTimeout(() => setState('idle'), 4000)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 4000)
    }
  }
  return (
    <button
      onClick={handle}
      disabled={state === 'loading'}
      className="w-full flex items-center justify-between px-3 py-2 bg-surface rounded-lg border border-surface-border hover:border-accent-blue/50 transition-colors text-sm disabled:opacity-50"
    >
      <span className="font-mono font-medium text-white">{asset} N-HiTS</span>
      <span className={`text-xs ${
        state === 'ok'      ? 'text-green-400' :
        state === 'error'   ? 'text-red-400' :
        state === 'loading' ? 'text-yellow-400' :
        'text-gray-400'
      }`}>
        {state === 'loading' ? 'Training…' : state === 'ok' ? 'Done ✓' : state === 'error' ? 'Failed ✗' : 'Train'}
      </span>
    </button>
  )
}

export default function AdminPage() {
  const toast = useToast()
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [health,  setHealth]  = useState(null)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getUsers()
      setUsers(res.data?.users ?? [])
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const fetchHealth = async () => {
    try {
      const res = await api.get('/health')
      setHealth(res.data)
    } catch {}
  }

  useEffect(() => {
    fetchUsers()
    fetchHealth()
  }, [])

  const handleToggle = async (id, isActive) => {
    try {
      await adminApi.updateUser(id, { is_active: !isActive })
      setUsers(u => u.map(x => x.id === id ? { ...x, is_active: !isActive } : x))
      toast.success(isActive ? 'User deactivated' : 'User activated')
    } catch (e) {
      toast.error('Failed: ' + (e.response?.data?.detail ?? e.message))
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Deactivate this user account?')) return
    try {
      await adminApi.deleteUser(id)
      setUsers(u => u.map(x => x.id === id ? { ...x, is_active: false } : x))
      toast.success('User account deactivated')
    } catch (e) {
      toast.error('Failed: ' + (e.response?.data?.detail ?? e.message))
    }
  }

  const handleChangeRole = async (id, newRole) => {
    try {
      await adminApi.updateUser(id, { role: newRole })
      setUsers(u => u.map(x => x.id === id ? { ...x, role: newRole } : x))
      toast.success(`Role changed to ${newRole}`)
    } catch (e) {
      toast.error('Failed: ' + (e.response?.data?.detail ?? e.message))
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-6 h-6 text-yellow-400" />
        <h1 className="text-xl font-bold text-white">Admin Panel</h1>
      </div>

      {/* Health check */}
      {health && (
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-green-400" />
            System Health
          </h2>
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-2 h-2 rounded-full ${health.status === 'healthy' ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-sm text-white capitalize">{health.status}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(health.models ?? {}).map(([asset, info]) => (
              <div key={asset} className="bg-surface-hover rounded-lg px-3 py-2">
                <p className="text-xs text-gray-400 font-medium">{asset} N-HiTS</p>
                <p className={`text-sm font-semibold mt-0.5 ${info.trained ? 'text-green-400' : 'text-yellow-400'}`}>
                  {info.trained ? '✓ Trained' : '⚠ Not trained'}
                </p>
                {info.version && <p className="text-xs text-gray-600 mt-0.5">{info.version}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Training panel */}
      <TrainingPanel />

      {/* User management */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-accent-blue" />
            User Management
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{users.length} users</span>
            <button
              onClick={fetchUsers}
              className="p-1.5 rounded hover:bg-surface-hover text-gray-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <p className="text-center text-red-400 text-sm py-8">{error}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-surface-border">
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Institution</th>
                  <th className="text-left px-4 py-3 font-medium">Role</th>
                  <th className="text-left px-4 py-3 font-medium">Active</th>
                  <th className="text-left px-4 py-3 font-medium">Last login</th>
                  <th className="text-left px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <UserRow
                    key={u.id}
                    user={u}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onChangeRole={handleChangeRole}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
