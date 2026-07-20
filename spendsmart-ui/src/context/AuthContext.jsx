import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { authApi } from '../api/auth'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { setLoading(false); return }
    authApi.me()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const userData = await authApi.login(email, password)
    setUser(userData)
    return userData
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    setUser(null)
  }, [])

  const socialLogin = useCallback(async (id_token) => {
    const userData = await authApi.socialLogin(id_token)
    setUser(userData)
    return userData
  }, [])

  const updateUser = useCallback((patch) => {
    setUser((prev) => ({ ...prev, ...patch }))
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, socialLogin, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}
