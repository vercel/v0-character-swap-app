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
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-center">
      <h2 className="mb-2 font-mono text-lg text-white">something went wrong</h2>
      <p className="mb-6 max-w-md font-mono text-sm text-neutral-400">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-white px-5 py-2.5 font-mono text-sm font-medium text-black transition-colors hover:bg-neutral-200"
      >
        try again
      </button>
    </div>
  )
}
