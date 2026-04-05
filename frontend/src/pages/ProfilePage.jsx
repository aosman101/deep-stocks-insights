import { useState, useEffect } from 'react'
import { profileApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import {
  User, Mail, Building2, FileText, Shield, Calendar,
  Save, Lock, Eye, EyeOff,
} from 'lucide-react'

export default function ProfilePage() {
  const { user } = useAuth()
  const toast = useToast()

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ full_name: '', institution: '', bio: '' })

  // Password change
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [showPw, setShowPw] = useState(false)

  useEffect(() => {
    profileApi.getMe()
      .then(r => {
        setProfile(r.data)
        setForm({
          full_name: r.data.full_name ?? '',
          institution: r.data.institution ?? '',
          bio: r.data.bio ?? '',
        })
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [])

  const handleProfileSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await profileApi.updateProfile(form)
      setProfile(res.data)
      toast.success('Profile updated successfully')
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (pwForm.new_password !== pwForm.confirm) {
      toast.error('Passwords do not match')
      return
    }
    if (pwForm.new_password.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }
    setPwSaving(true)
    try {
      await profileApi.changePassword({
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      })
      toast.success('Password changed successfully')
      setPwForm({ current_password: '', new_password: '', confirm: '' })
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Failed to change password')
    } finally {
      setPwSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <User className="w-5 h-5 text-accent-blue" />
          Profile
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Manage your account details and password
        </p>
      </div>

      {/* Account info (read-only) */}
      <div className="card">
        <h2 className="text-sm font-semibold text-white mb-4">Account Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 bg-surface-hover rounded-lg px-4 py-3">
            <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Username</p>
              <p className="text-sm text-white font-medium">{profile?.username}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-surface-hover rounded-lg px-4 py-3">
            <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Email</p>
              <p className="text-sm text-white font-medium">{profile?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-surface-hover rounded-lg px-4 py-3">
            <Shield className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Role</p>
              <p className="text-sm text-white font-medium capitalize">{profile?.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-surface-hover rounded-lg px-4 py-3">
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Member since</p>
              <p className="text-sm text-white font-medium">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit profile */}
      <form onSubmit={handleProfileSave} className="card space-y-4">
        <h2 className="text-sm font-semibold text-white">Edit Profile</h2>

        <div>
          <label className="flex items-center gap-2 text-xs text-gray-400 mb-1 font-medium">
            <User className="w-3.5 h-3.5" /> Full Name
          </label>
          <input
            value={form.full_name}
            onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
            className="w-full bg-surface-hover border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-blue/60 transition-colors"
            placeholder="Your full name"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-xs text-gray-400 mb-1 font-medium">
            <Building2 className="w-3.5 h-3.5" /> Institution
          </label>
          <input
            value={form.institution}
            onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
            className="w-full bg-surface-hover border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-blue/60 transition-colors"
            placeholder="University or company"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-xs text-gray-400 mb-1 font-medium">
            <FileText className="w-3.5 h-3.5" /> Bio
          </label>
          <textarea
            value={form.bio}
            onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
            rows={3}
            className="w-full bg-surface-hover border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-blue/60 transition-colors resize-none"
            placeholder="Tell us about yourself or your research interests"
          />
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary text-sm">
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </form>

      {/* Change password */}
      <form onSubmit={handlePasswordChange} className="card space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-yellow-400" />
          Change Password
        </h2>

        <div>
          <label className="block text-xs text-gray-400 mb-1 font-medium">Current Password</label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={pwForm.current_password}
              onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
              required
              className="w-full bg-surface-hover border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-blue/60 transition-colors pr-10"
              placeholder="Enter current password"
            />
            <button
              type="button"
              onClick={() => setShowPw(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1 font-medium">New Password</label>
            <input
              type="password"
              value={pwForm.new_password}
              onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
              required
              className="w-full bg-surface-hover border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-blue/60 transition-colors"
              placeholder="Min. 8 characters"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1 font-medium">Confirm New Password</label>
            <input
              type="password"
              value={pwForm.confirm}
              onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
              required
              className="w-full bg-surface-hover border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-blue/60 transition-colors"
              placeholder="Repeat new password"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={pwSaving} className="btn-ghost text-sm border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10">
            <Lock className="w-4 h-4" />
            {pwSaving ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </form>
    </div>
  )
}
