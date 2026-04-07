import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { bootstrapAdmin as bootstrapAdminApi, getMe, login as loginApi, type AuthUser } from '../api/auth'
import { getTokenStorageKey, setAuthToken } from '../api/client'

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  bootstrapAdmin: (payload: { username: string; email: string; full_name: string; password: string }) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const TOKEN_KEY = getTokenStorageKey()

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    setAuthToken(null)
    localStorage.removeItem(TOKEN_KEY)
  }, [])

  const loadMe = useCallback(async () => {
    if (!token) {
      setUser(null)
      setIsLoading(false)
      return
    }

    try {
      setAuthToken(token)
      const me = await getMe()
      setUser(me)
    } catch {
      logout()
    } finally {
      setIsLoading(false)
    }
  }, [token, logout])

  useEffect(() => {
    setIsLoading(true)
    void loadMe()
  }, [loadMe])

  const login = useCallback(async (username: string, password: string) => {
    const response = await loginApi({ username, password })
    setToken(response.access_token)
    setAuthToken(response.access_token)
    localStorage.setItem(TOKEN_KEY, response.access_token)

    const me = await getMe()
    setUser(me)
  }, [])

  const bootstrapAdmin = useCallback(
    async (payload: { username: string; email: string; full_name: string; password: string }) => {
      await bootstrapAdminApi(payload)
      await login(payload.username, payload.password)
    },
    [login],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: Boolean(user && token),
      login,
      logout,
      bootstrapAdmin,
    }),
    [user, token, isLoading, login, logout, bootstrapAdmin],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
