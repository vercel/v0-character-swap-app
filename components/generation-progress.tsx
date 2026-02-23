"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"

interface GenerationProgressProps {
  characterImageUrl?: string | null
  createdAt: string
  status: "uploading" | "pending" | "processing"
  onCancel?: (e?: React.MouseEvent) => void
}

const DEFAULT_MEDIAN_SECONDS = 420 // 7 minutes

// Module-level cached median — shared across all component instances
let _cachedMedian: number = DEFAULT_MEDIAN_SECONDS
let _medianFetched = false

function fetchMedianDuration(): void {
  if (_medianFetched) return
  _medianFetched = true
  fetch("/api/generation-stats")
    .then((r) => r.json())
    .then((data) => {
      if (data?.medianDurationSeconds && data.medianDurationSeconds > 0) {
        _cachedMedian = data.medianDurationSeconds
      }
    })
    .catch(() => {}) // fallback already set
}

/**
 * Asymptotic progress curve that never gets stuck.
 *
 * tau is calibrated so that at the median completion time, progress ≈ 80%.
 * Formula: progress = 95 * (1 - e^(-elapsed / tau))
 *   where tau = medianDuration / 1.845
 *
 * At 1× median (~7 min): ≈ 80%
 * At 2× median (~14 min): ≈ 94%
 * Never reaches 95% — backend completion snaps to 100%.
 */
function computeProgress(elapsedSeconds: number, medianDuration: number): number {
  const tau = medianDuration / 1.845
  return 95 * (1 - Math.exp(-elapsedSeconds / tau))
}

export function GenerationProgress({
  characterImageUrl,
  createdAt,
  status,
  onCancel
}: GenerationProgressProps) {
  const [progress, setProgress] = useState(() => {
    const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000
    return computeProgress(elapsed, _cachedMedian)
  })

  useEffect(() => {
    fetchMedianDuration()
    const startTime = new Date(createdAt).getTime()
    const update = () => {
      const elapsed = (Date.now() - startTime) / 1000
      setProgress(computeProgress(elapsed, _cachedMedian))
    }
    update()
    const interval = setInterval(update, 5000)
    return () => clearInterval(interval)
  }, [createdAt])

  return (
    <div className="group relative flex h-full w-full flex-col overflow-hidden">
      {/* Background character image */}
      {characterImageUrl && (
        <Image
          src={characterImageUrl}
          alt=""
          fill
          className="object-cover opacity-20"
          sizes="56px"
        />
      )}

      {/* Progress indicator */}
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center">
        {/* Circular progress */}
        <div className="relative h-8 w-8 md:h-9 md:w-9">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
            <circle
              cx="18" cy="18" r="15"
              fill="none" stroke="currentColor" strokeWidth="2.5"
              className="text-neutral-800"
            />
            <circle
              cx="18" cy="18" r="15"
              fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={`${progress * 0.94} 94`}
              className="text-white transition-all duration-1000"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-mono text-[8px] font-semibold tabular-nums text-white">
            {Math.round(progress)}%
          </span>
        </div>
      </div>

      {/* Cancel button — appears on hover, positioned outside via parent */}
      {onCancel && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onCancel(e)
          }}
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 opacity-0 transition-opacity group-hover:opacity-100"
          title="Cancel generation"
        >
          <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

// Expanded version for larger displays
export function GenerationProgressExpanded({
  characterImageUrl,
  characterName,
  createdAt,
  status,
  onCancel
}: GenerationProgressProps & { characterName?: string | null }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    fetchMedianDuration()
    const startTime = new Date(createdAt).getTime()

    const updateElapsed = () => {
      const now = Date.now()
      const elapsed = Math.floor((now - startTime) / 1000)
      setElapsedSeconds(elapsed)
    }

    updateElapsed()
    const interval = setInterval(updateElapsed, 1000)

    return () => clearInterval(interval)
  }, [createdAt])

  const progress = computeProgress(elapsedSeconds, _cachedMedian)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getStatusMessage = () => {
    if (status === "uploading") return "Uploading video..."
    if (status === "pending") return "In queue..."
    if (progress < 10) return "Starting AI model..."
    if (progress < 30) return "Analyzing motion..."
    if (progress < 60) return "Processing frames..."
    if (progress < 85) return "Generating video..."
    return "Rendering final..."
  }

  return (
    <div className="rounded-lg bg-neutral-900 p-4 ring-1 ring-neutral-800">
      <div className="flex items-start gap-4">
        {/* Character thumbnail */}
        {characterImageUrl && (
          <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg">
            <Image
              src={characterImageUrl}
              alt={characterName || ""}
              fill
              className="object-cover"
              sizes="48px"
            />
          </div>
        )}

        <div className="flex-1">
          {/* Status message */}
          <p className="mb-2 font-sans text-[13px] font-medium text-white">
            {getStatusMessage()}
          </p>

          {/* Progress bar */}
          <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-white transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Time info */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-neutral-500">
              {characterName || "Generating"}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-neutral-400">
              Elapsed: {formatTime(elapsedSeconds)}
            </span>
          </div>
        </div>
      </div>

      {/* Cancel button */}
      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-3 w-full rounded-lg bg-neutral-800 px-3 py-2 font-sans text-[12px] text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-white"
        >
          Cancel Generation
        </button>
      )}
    </div>
  )
}
