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
}

const ANON_ID_KEY = "anon_user_id"

function getOrCreateAnonId(): string {
  if (typeof window === "undefined") return "anon"
  let id = localStorage.getItem(ANON_ID_KEY)
  if (!id) {
    id = `anon_${crypto.randomUUID()}`
    localStorage.setItem(ANON_ID_KEY, id)
  }
  return id
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user)
        } else {
          const anonId = getOrCreateAnonId()
          setUser({ id: anonId, email: "", name: "guest" })
        }
        setIsLoading(false)
      })
      .catch(() => {
        const anonId = getOrCreateAnonId()
        setUser({ id: anonId, email: "", name: "guest" })
        setIsLoading(false)
      })
  }, [])

  const login = useCallback(() => {
    window.location.href = "/api/auth/login"
  }, [])

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    const anonId = getOrCreateAnonId()
    setUser({ id: anonId, email: "", name: "guest" })
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
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
