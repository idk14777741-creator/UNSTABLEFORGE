import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest } from '../lib/api'
import { navigate } from '../lib/router'

const STORAGE_KEY = 'unstableforge.session.v1'
const AuthContext = createContext(null)

function isOrganizer(user) {
  return user?.role === 'organizer' || user?.role === 'admin'
}

function readStoredSession() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (
      !parsed ||
      typeof parsed.token !== 'string' ||
      typeof parsed.expiresAt !== 'string' ||
      !parsed.user ||
      typeof parsed.user.email !== 'string'
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function clearStoredSession() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage can be unavailable in private contexts; state still clears.
  }
}

function persistSession(session) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // The in-memory session still works for this tab.
  }
}

function isExpired(session) {
  const expires = new Date(session.expiresAt).getTime()
  return !Number.isFinite(expires) || expires <= Date.now()
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({
    status: 'checking',
    user: null,
    token: null,
    expiresAt: null,
    expired: false,
  })
  const expiredRef = useRef(false)

  const applySession = useCallback((session) => {
    expiredRef.current = false
    persistSession(session)
    setAuth({
      status: 'authenticated',
      user: session.user,
      token: session.token,
      expiresAt: session.expiresAt,
      expired: false,
    })
  }, [])

  const clearSession = useCallback((expired = false) => {
    expiredRef.current = expired
    clearStoredSession()
    setAuth({
      status: 'anonymous',
      user: null,
      token: null,
      expiresAt: null,
      expired,
    })
  }, [])

  useEffect(() => {
    const stored = readStoredSession()

    if (!stored || isExpired(stored)) {
      if (stored && isExpired(stored)) expiredRef.current = true
      clearStoredSession()
      setAuth({
        status: 'anonymous',
        user: null,
        token: null,
        expiresAt: null,
        expired: expiredRef.current,
      })
      return undefined
    }

    let active = true
    apiRequest('/api/auth/me', { token: stored.token })
      .then((body) => {
        if (!active) return
        const session = { ...stored, user: body.user }
        applySession(session)
      })
      .catch(() => {
        if (!active) return
        clearSession(true)
      })

    return () => {
      active = false
    }
  }, [applySession, clearSession])

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== STORAGE_KEY) return
      const stored = readStoredSession()
      if (!stored) {
        expiredRef.current = false
        setAuth({ status: 'anonymous', user: null, token: null, expiresAt: null, expired: false })
        return
      }
      if (isExpired(stored)) {
        expiredRef.current = true
        clearStoredSession()
        setAuth({ status: 'anonymous', user: null, token: null, expiresAt: null, expired: true })
        return
      }
      setAuth({
        status: 'authenticated',
        user: stored.user,
        token: stored.token,
        expiresAt: stored.expiresAt,
        expired: false,
      })
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const login = useCallback(
    async (email, password) => {
      const body = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      })
      const session = {
        token: body.token,
        expiresAt: body.expiresAt,
        user: body.user,
      }
      applySession(session)
      return body.user
    },
    [applySession],
  )

  const signup = useCallback(async (email, password) => {
    const body = await apiRequest('/api/auth/signup', {
      method: 'POST',
      body: { email, password },
    })
    return body.user
  }, [])

  const logout = useCallback(
    ({ redirect = '/' } = {}) => {
      clearSession()
      if (redirect) navigate(redirect, { replace: true })
    },
    [clearSession],
  )

  const request = useCallback(
    async (path, options = {}) => {
      const token = auth.token
      if (!token) {
        throw new Error('You need to sign in again.')
      }

      try {
        return await apiRequest(path, { ...options, token })
      } catch (error) {
        if (error.status === 401) {
          clearSession(true)
          navigate(
            `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}&reason=expired`,
            { replace: true },
          )
        }
        throw error
      }
    },
    [auth.token, clearSession],
  )

  const value = useMemo(
    () => ({
      status: auth.status,
      user: auth.user,
      token: auth.token,
      expiresAt: auth.expiresAt,
      expired: auth.expired,
      isAuthenticated: auth.status === 'authenticated',
      isOrganizer: isOrganizer(auth.user),
      login,
      signup,
      logout,
      request,
    }),
    [auth, login, signup, logout, request],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

export function roleHome(user) {
  return isOrganizer(user) ? '/admin' : '/'
}

export function safeNext(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}
