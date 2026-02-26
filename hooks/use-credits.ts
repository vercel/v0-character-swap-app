"use client"

import useSWR from "swr"
import { useAuth } from "@/components/auth-provider"
import { useEffect, useRef } from "react"

export interface CreditsResponse {
  balance: string
  totalUsed: string
  buyCreditsUrl: string
}

export function useCredits() {
  const { user } = useAuth()
  const isAuthenticated = !!user
  const abortControllerRef = useRef<AbortController | null>(null)

  const {
    data,
    error,
    isLoading: creditsLoading,
    mutate: creditsMutate,
  } = useSWR<CreditsResponse, Error>(
    isAuthenticated ? "/api/credits" : null,
    async (): Promise<CreditsResponse> => {
      abortControllerRef.current = new AbortController()
      const response = await fetch("/api/credits", {
        signal: abortControllerRef.current.signal,
      })
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || "Failed to fetch credits")
      }

      return json
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000,
    },
  )

  // Abort in-flight requests on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    credits: data ?? null,
    balance: data?.balance ?? "0",
    totalUsed: data?.totalUsed ?? "0",
    buyCreditsUrl: data?.buyCreditsUrl ?? null,
    creditsLoading,
    error: error?.message ?? null,
    refresh: () => creditsMutate(),
  }
}
