"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { getStoredUser, removeToken, apiGetMe } from "./api"
import type { AuthUser } from "./types"

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  signOut: () => void
  refreshUser: () => Promise<void>
  setUser: (user: AuthUser | null) => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: () => {},
  refreshUser: async () => {},
  setUser: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    try {
      const stored = getStoredUser()
      if (stored) {
        setUser(stored)
        // Verify token is still valid in background
        apiGetMe()
          .then(({ user }) => setUser(user))
          .catch(() => {
            removeToken()
            setUser(null)
          })
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshUser()
  }, [])

  const signOut = () => {
    removeToken()
    setUser(null)
    window.location.href = "/auth/login"
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
