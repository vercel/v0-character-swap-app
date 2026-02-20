"use client"

import React, { useEffect, useRef, useCallback } from "react"
import useSWR from "swr"

// Use Next.js image optimization for tiny thumbnails (128px, q60)
function thumbUrl(src: string): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=128&q=60`
}
import { FailedGeneration } from "@/components/failed-generation"
import { GenerationProgress } from "@/components/generation-progress"
import { useAuth } from "@/components/auth-provider"

// Request notification permission
async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    return false
  }

  if (Notification.permission === "granted") {
    return true
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission()
    return permission === "granted"
  }

  return false
}

// Show notification when video is ready
function showVideoReadyNotification(characterName: string | null) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return
  }

  const notification = new Notification("Video Ready!", {
    body: characterName
      ? `Your ${characterName} video is ready to view`
      : "Your video generation is complete",
    icon: "/favicon.ico",
    tag: "video-ready", // Prevents duplicate notifications
  })

  // Auto-close after 5 seconds
  setTimeout(() => notification.close(), 5000)

  // Focus window when clicked
  notification.onclick = () => {
    window.focus()
    notification.close()
  }
}

interface Generation {
  id: number
  video_url: string | null
  source_video_url: string | null
  character_name: string | null
  character_image_url: string | null
  aspect_ratio: "9:16" | "16:9" | "fill"
  status: "uploading" | "pending" | "processing" | "completed" | "failed" | "cancelled"
  created_at: string
  completed_at: string | null
  error_message: string | null
  error?: {
    kind: string
    message: string
    code?: string
    provider?: string
    model?: string
    summary?: string
    details?: string
  } | null
}

interface GenerationsPanelProps {
  onSelectVideo?: (videoUrl: string, sourceVideoUrl: string | null, sourceAspectRatio: "9:16" | "16:9" | "fill", generatedAspectRatio: "9:16" | "16:9" | "fill") => void
  onSelectError?: (error: { message: string; characterName: string | null; characterImageUrl: string | null; createdAt: string }) => void
  className?: string
  variant?: "default" | "compact"
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

export function GenerationsPanel({ onSelectVideo, onSelectError, className = "", variant = "default" }: GenerationsPanelProps) {
  const { user } = useAuth()
  const prevGenerationsRef = useRef<Generation[]>([])
  const hasRequestedPermission = useRef(false)

  const { data, isLoading, mutate } = useSWR(
    user?.id ? "/api/generations" : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  )

  const generations: Generation[] = data?.generations || []
  const hasPending = generations.some(g => g.status === "uploading" || g.status === "pending" || g.status === "processing")

  // Preload optimized poster thumbnails so they appear instantly
  const preloadedRef = useRef(new Set<string>())
  useEffect(() => {
    generations.forEach(gen => {
      if (gen.character_image_url && !preloadedRef.current.has(gen.character_image_url)) {
        preloadedRef.current.add(gen.character_image_url)
        const img = new window.Image()
        img.src = thumbUrl(gen.character_image_url)
      }
    })
  }, [generations])

  // Request notification permission when there's a pending generation
  useEffect(() => {
    if (hasPending && !hasRequestedPermission.current) {
      hasRequestedPermission.current = true
      requestNotificationPermission()
    }
  }, [hasPending])

  // Detect when a generation completes and show notification
  useEffect(() => {
    const prevGenerations = prevGenerationsRef.current

    // Check if any generation just completed
    for (const gen of generations) {
      if (gen.status === "completed") {
        const prevGen = prevGenerations.find(p => p.id === gen.id)
        if (prevGen && prevGen.status !== "completed") {
          // This generation just completed!
          showVideoReadyNotification(gen.character_name)
        }
      }
    }

    // Update ref for next comparison - make a copy to avoid reference issues
    prevGenerationsRef.current = [...generations]
  }, [generations])

  // Poll only when there are pending generations
  useSWR(
    user?.id && hasPending ? "/api/generations" : null,
    fetcher,
    {
      refreshInterval: 10000,
      dedupingInterval: 5000,
    }
  )

  // Listen for refresh events from the generate action
  useEffect(() => {
    const handleRefresh = () => mutate()
    window.addEventListener("refresh-generations", handleRefresh)
    return () => window.removeEventListener("refresh-generations", handleRefresh)
  }, [mutate])

  // Delete/Cancel a generation (optimistic update)
  const handleDelete = async (generationId: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    // Remove from UI immediately
    mutate(
      (current: { generations: Generation[] } | undefined) => {
        if (!current) return current
        return { generations: current.generations.filter(g => g.id !== generationId) }
      },
      { revalidate: false }
    )
    try {
      await fetch(`/api/generations/${generationId}`, { method: "DELETE" })
    } catch (error) {
      console.error("Failed to delete generation:", error)
      // Revert on failure
      mutate()
    }
  }

  // Show sign in prompt if user is not logged in
  if (!user) {
    if (variant === "compact") return null
    return (
      <div className={className}>
        <p className="mb-2 font-mono text-[11px] lowercase text-neutral-500">
          my videos
        </p>
        <p className="font-mono text-[11px] text-neutral-600">
          sign in to see your videos
        </p>
      </div>
    )
  }

  // Show loading state
  if (isLoading) {
    if (variant === "compact") {
      return (
        <div className="flex items-center justify-center py-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-700 border-t-white" />
        </div>
      )
    }
    return (
      <div className={`${className}`}>
        <p className="font-mono text-[11px] lowercase text-neutral-500">
          my videos
        </p>
        <div className="mt-2 flex items-center justify-center py-4">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-700 border-t-white" />
        </div>
      </div>
    )
  }

  // Show empty state with helpful message
  if (generations.length === 0) {
    if (variant === "compact") return null
    return (
      <div className={className}>
        <p className="mb-2 font-mono text-[11px] lowercase text-neutral-500">
          my videos
        </p>
        <p className="font-mono text-[11px] text-neutral-600">
          your generated videos will appear here
        </p>
      </div>
    )
  }

  // Filter generations based on variant
  // Compact: show completed and processing videos (not cancelled/failed)
  // Default: show all except cancelled
  const displayGenerations = variant === "compact"
    ? generations.filter(g => (g.status === "completed" && g.video_url) || g.status === "processing" || g.status === "pending")
    : generations.filter(g => g.status !== "cancelled")

  if (variant === "compact" && displayGenerations.length === 0) {
    return null
  }

  return (
    <div className={className}>
      {variant !== "compact" && (
        <p className="mb-1.5 font-mono text-[10px] lowercase text-neutral-500 md:mb-2 md:text-[11px]">
          my videos
        </p>
      )}

      <div className={variant === "compact" ? "-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" : "-mx-2 flex gap-2.5 overflow-x-auto px-2 pb-2 pt-3"}>
        {displayGenerations.map((gen) => {
          // Determine thumbnail width based on aspect ratio
          const isLandscape = gen.aspect_ratio === "16:9"
          const thumbnailClass = variant === "compact"
            ? isLandscape ? "h-12 w-16" : "h-12 w-9"
            : isLandscape
              ? "h-16 w-[85px] md:h-20 md:w-[107px]" // 16:9 ratio
              : "h-16 w-11 md:h-20 md:w-14" // portrait/fill

          const showDeleteButton = gen.status === "completed" || gen.status === "failed"

          return (
          <div
            key={gen.id}
            className={`group relative shrink-0 ${thumbnailClass}`}
          >
            {/* Content container with overflow hidden */}
            <div className="h-full w-full overflow-hidden rounded-lg bg-neutral-900 ring-1 ring-neutral-800">
            {/* Thumbnail or status indicator */}
            {gen.status === "completed" && gen.video_url ? (
              <button
                onClick={() => onSelectVideo?.(gen.video_url!, gen.source_video_url, gen.source_video_aspect_ratio || "fill", gen.aspect_ratio || "fill")}
                className="relative h-full w-full"
                onMouseEnter={() => {
                  // Prefetch both videos so they open instantly on click
                  if (gen.video_url) fetch(gen.video_url, { mode: "cors" }).catch(() => {})
                  if (gen.source_video_url) fetch(gen.source_video_url, { mode: "cors" }).catch(() => {})
                }}
              >
                {/* Optimized poster image underneath video */}
                {gen.character_image_url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={thumbUrl(gen.character_image_url)}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="eager"
                    draggable={false}
                  />
                )}
                <video
                  src={gen.video_url}
                  className="relative h-full w-full object-cover"
                  muted
                  playsInline
                  preload="none"
                  onMouseEnter={(e) => e.currentTarget.play()}
                  onMouseLeave={(e) => {
                    e.currentTarget.pause()
                    e.currentTarget.currentTime = 0
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </button>
            ) : gen.status === "failed" || gen.status === "cancelled" ? (
              <button
                className="h-full w-full"
                onClick={() => onSelectError?.({
                  message: gen.error?.summary ?? gen.error?.message ?? gen.error_message ?? "Generation failed",
                  characterName: gen.character_name,
                  characterImageUrl: gen.character_image_url,
                  createdAt: gen.created_at,
                })}
              >
                <FailedGeneration gen={gen} />
              </button>
            ) : (
              // Processing/Pending state with progress indicator
              <GenerationProgress
                characterImageUrl={gen.character_image_url}
                createdAt={gen.created_at}
                status={gen.status as "uploading" | "pending" | "processing"}
                onCancel={(e) => handleDelete(gen.id, e)}
              />
            )}
            </div>

            {/* Delete button - OUTSIDE overflow container so it's never clipped */}
            {showDeleteButton && (
              <button
                onClick={(e) => handleDelete(gen.id, e)}
                className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-800 text-neutral-400 opacity-0 shadow-md ring-1 ring-neutral-700 transition-all hover:bg-neutral-700 hover:text-white group-hover:opacity-100"
                title="Delete video"
              >
                <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          )
        })}
      </div>
    </div>
  )
}
