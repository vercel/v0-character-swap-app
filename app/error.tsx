"use client"

import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("App error:", error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center">
      <h2 className="mb-2 text-lg font-bold text-black">Something went wrong</h2>
      <p className="mb-6 max-w-md text-sm font-medium text-black/70">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="ds-btn-primary"
      >
        Try again
      </button>
    </div>
  )
}
