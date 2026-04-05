import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem('dsi_token')
    if (!token) { setLoading(false); return }
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    api.get('/api/auth/me')
      .then(r => setUser({ ...r.data, token }))
      .catch(() => { localStorage.removeItem('dsi_token'); delete api.defaults.headers.common['Authorization'] })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const form = new URLSearchParams({ username: email, password })
    const { data } = await api.post('/api/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    localStorage.setItem('dsi_token', data.access_token)
    api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`
    setUser({ ...data, token: data.access_token })
    return data
  }, [])

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/api/auth/register', payload)
    return data
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('dsi_token')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
