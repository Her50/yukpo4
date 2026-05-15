import { createContext, useContext, useState, useEffect } from 'react'
import { login as apiLogin, register as apiRegister, logout as apiLogout } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('yukpo_token')
    if (token) {
      const stored = localStorage.getItem('yukpo_user')
      if (stored) setUser(JSON.parse(stored))
    }
    setLoading(false)
  }, [])

  async function login(email, password) {
    const data = await apiLogin(email, password)
    const u = data.user || data
    setUser(u)
    localStorage.setItem('yukpo_user', JSON.stringify(u))
    return data
  }

  async function register(payload) {
    const data = await apiRegister(payload)
    const u = data.user || data
    setUser(u)
    localStorage.setItem('yukpo_user', JSON.stringify(u))
    return data
  }

  function logout() {
    apiLogout()
    setUser(null)
    localStorage.removeItem('yukpo_user')
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
