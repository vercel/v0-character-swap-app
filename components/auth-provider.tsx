"use client"

import React from "react"

import { createContext, useContext, useEffect, useState, useCallback } from "react"

interface User {
  id: string
  email: string
  name: string
  avatar?: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: () => void
  logout: () => Promise<void>
  teamId: string | null
  hasApiKey: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [teamId, setTeamId] = useState<string | null>(null)
  const [hasApiKey, setHasApiKey] = useState(false)

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user || null)
        setTeamId(data.teamId || null)
        setHasApiKey(data.hasApiKey || false)
        setIsLoading(false)
      })
      .catch((err) => {
        console.error("Failed to fetch session:", err)
        setUser(null)
        setIsLoading(false)
      })
  }, [])

  const login = useCallback(() => {
    window.location.href = "/api/auth/login"
  }, [])

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    setUser(null)
    setTeamId(null)
    setHasApiKey(false)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, teamId, hasApiKey }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
