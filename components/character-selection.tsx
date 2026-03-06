"use client"

import { useRef, useState, useCallback, useEffect, useMemo, useSyncExternalStore } from "react"
import { cn, type AspectRatio } from "@/lib/utils"
import type { Character } from "@/lib/types"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then(res => res.json())

// Generate a video poster via Cloudinary (first frame, preserves original aspect ratio)
function videoFrameUrl(videoUrl: string): string | null {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (!cloudName || !videoUrl.includes(".public.blob.vercel-storage.com")) return null
  return `https://res.cloudinary.com/${cloudName}/video/fetch/w_480,c_limit,so_1,f_jpg,q_60/${encodeURIComponent(videoUrl)}`
}

interface GenerationVideo {
  video_url: string
  character_name: string | null
}

function optimizedUrl(src: string, width: number): string {
  if (src.startsWith("/")) return src
  if (!src.startsWith("http")) return src
  // Use Cloudinary CDN for Blob images (global edge cache, no server processing)
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (cloudName && src.includes(".public.blob.vercel-storage.com")) {
    return `https://res.cloudinary.com/${cloudName}/image/fetch/w_${width},c_fill,g_north,f_webp,q_80/${encodeURIComponent(src)}`
  }
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`
}

/** Get the optimized image URL for a character at a given aspect ratio */
function charImageUrl(char: Character, ar: AspectRatio): string {
  const src = char.sources?.[ar] || char.src
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (cloudName && src.includes(".public.blob.vercel-storage.com")) {
    const bustSrc = src + (src.includes("?") ? "&v=4" : "?v=4")
    return `https://res.cloudinary.com/${cloudName}/image/fetch/w_800,c_fill,g_north,f_webp,q_85/${encodeURIComponent(bustSrc)}`
  }
  return src
}

const ALL_RATIOS: AspectRatio[] = ["9:16", "1:1", "16:9"]


interface CharacterSelectionProps {
  selectedId: number | null
  onSelect: (id: number) => void
  onNext: (aspectRatio: AspectRatio) => void
  onHome?: () => void
  allCharacters: Character[]
  user?: { email?: string } | null
  login?: () => void
  onAddCustom: (character: Character) => void
  onDeleteCustom?: (id: number) => void
}

const ASPECT_RATIO_OPTIONS: { value: AspectRatio; label: string; icon: string }[] = [
  { value: "9:16", label: "9:16", icon: "portrait" },
  { value: "1:1", label: "1:1", icon: "square" },
  { value: "16:9", label: "16:9", icon: "landscape" },
]

// Card pixel dimensions per aspect ratio [mobile, desktop]
const CARD_DIMS: Record<AspectRatio, { w: [number, number]; h: [number, number] }> = {
  "9:16": { w: [101, 135], h: [180, 240] },
  "1:1":  { w: [140, 190], h: [140, 190] },
  "16:9": { w: [180, 240], h: [101, 135] },
}

export function CharacterSelection({
  selectedId,
  onSelect,
  onNext,
  allCharacters,
  onAddCustom,
  onDeleteCustom,
  user,
  login,
}: CharacterSelectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  // Read device type — inline <script> in layout sets data-device before React hydrates
  const isDesktop = useSyncExternalStore(
    () => () => {},
    () => document.documentElement.dataset.device === "desktop",
    () => true,
  )
  // null = user hasn't picked yet → CSS handles sizing via data-device (zero flash)
  const [userRatio, setUserRatio] = useState<AspectRatio | null>(null)
  const aspectRatio: AspectRatio = userRatio ?? (isDesktop ? "16:9" : "9:16")
  // When user hasn't picked, cardStyle is undefined → CSS class handles sizing
  // When user picks, inline styles take over with transitions
  const scrollToIdxRef = useRef<number | null>(null)

  const cardStyle = useMemo(() => {
    if (userRatio === null) return undefined
    const dims = CARD_DIMS[userRatio]
    return {
      width: isDesktop ? dims.w[1] : dims.w[0],
      height: isDesktop ? dims.h[1] : dims.h[0],
      transition: "width 250ms ease, height 250ms ease",
      contain: "layout style" as const,
    }
  }, [userRatio, isDesktop])

  // After ratio change: instantly set scroll to correct position, then cards animate into place
  useEffect(() => {
    const idx = scrollToIdxRef.current
    if (idx === null || !userRatio) return
    scrollToIdxRef.current = null
    const el = scrollRef.current
    if (!el) return
    const dims = CARD_DIMS[userRatio]
    const cardW = isDesktop ? dims.w[1] : dims.w[0]
    const gap = isDesktop ? 16 : 12
    const pad = isDesktop ? 32 : 24
    const target = pad + idx * (cardW + gap) + cardW / 2 - el.clientWidth / 2
    // Set scroll immediately
    el.scrollLeft = target
    // Also keep adjusting during the 250ms transition as cards animate
    const start = performance.now()
    const tick = () => {
      el.scrollLeft = target
      if (performance.now() - start < 260) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [userRatio, isDesktop])

  // AI character generation state
  const [showCreateInput, setShowCreateInput] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generateError, setGenerateError] = useState<string | null>(null)

  const [showLoginModal, setShowLoginModal] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // Restore pending prompt after login and auto-submit
  const autoSubmittedRef = useRef(false)
  useEffect(() => {
    if (autoSubmittedRef.current) return
    const pending = sessionStorage.getItem("pendingCharacterPrompt")
    if (pending && user) {
      autoSubmittedRef.current = true
      sessionStorage.removeItem("pendingCharacterPrompt")
      setPrompt(pending)
      setShowCreateInput(true)
    }
  }, [user])

  const handleLoginAndGenerate = useCallback(() => {
    setIsLoggingIn(true)
    sessionStorage.setItem("pendingCharacterPrompt", prompt.trim())
    sessionStorage.setItem("loginReturnUrl", "/pick")
    login?.()
  }, [prompt, login])

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return

    // If not logged in, show login modal
    if (!user) {
      setShowLoginModal(true)
      return
    }

    setIsGenerating(true)
    setGenerationProgress(0)
    setGenerateError(null)

    const duration = 60000
    const startTime = Date.now()
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime
      setGenerationProgress(Math.min((elapsed / duration) * 95, 95))
    }, 100)

    try {
      // Start the workflow
      const response = await fetch("/api/generate-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      })
      const data = await response.json()
      if (!response.ok || !data.runId) {
        throw new Error(data.error || "Failed to start generation")
      }

      // Poll for result
      const runId = data.runId
      let result: { imageUrl: string; sources: { "9:16": string; "1:1": string; "16:9": string } } | null = null

      while (!result) {
        await new Promise(r => setTimeout(r, 2000))
        const statusRes = await fetch(`/api/generate-character/status?runId=${runId}`)
        const statusData = await statusRes.json()

        if (statusData.status === "completed" && statusData.result) {
          result = statusData.result
        } else if (statusData.status === "failed") {
          throw new Error(statusData.error || "Generation failed")
        }
        // else: still running, keep polling
      }

      clearInterval(progressInterval)
      setGenerationProgress(100)

      const charName = prompt.trim().slice(0, 20)
      const newId = Math.max(...allCharacters.map(c => c.id), 0) + 1
      const newChar = {
        id: newId,
        src: result.imageUrl,
        name: charName,
        sources: result.sources,
      }

      // Preload the image for the current aspect ratio before adding to carousel
      const imgUrl = charImageUrl(newChar, aspectRatio)
      await new Promise<void>((resolve) => {
        const img = new window.Image()
        img.onload = () => resolve()
        img.onerror = () => resolve() // still show even if preload fails
        img.src = imgUrl
      })

      onAddCustom(newChar)
      onSelect(newId)
      setPrompt("")

      // Scroll carousel to the new character (custom chars are at the end)
      requestAnimationFrame(() => {
        const el = scrollRef.current
        if (el) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" })
      })
    } catch (err) {
      clearInterval(progressInterval)
      setGenerateError(err instanceof Error ? err.message : "Failed to generate character. Please try again.")
    } finally {
      setTimeout(() => {
        setIsGenerating(false)
        setGenerationProgress(0)
      }, 300)
    }
  }, [prompt, isGenerating, user, allCharacters, onAddCustom, onSelect, aspectRatio])

  // Auto-submit after login restore
  useEffect(() => {
    if (autoSubmittedRef.current && prompt.trim() && user && !isGenerating) {
      autoSubmittedRef.current = false
      handleGenerate()
    }
  }, [prompt, user, isGenerating, handleGenerate])

  // Fetch generation videos for previews
  const { data } = useSWR<{ generations: GenerationVideo[] }>(
    "/api/generations/showcase",
    fetcher,
    { dedupingInterval: 60000 }
  )
  const generationVideos = data?.generations || []

  // One video per character name
  const videoByName = new Map<string, string>()
  generationVideos.forEach(g => {
    if (g.character_name && g.video_url && !videoByName.has(g.character_name)) {
      videoByName.set(g.character_name, g.video_url)
    }
  })

  // Defaults: dedup by name, always shown, not deletable
  // Custom: only show if NOT a duplicate of a default (same name + same image)
  const CUSTOM_OFFSET = 1000
  const seenNames = new Set<string>()
  const dedupedCharacters = allCharacters.filter(c => c.id < CUSTOM_OFFSET).filter(c => {
    if (seenNames.has(c.name)) return false
    seenNames.add(c.name)
    return true
  })
  const defaultNames = new Set(dedupedCharacters.map(c => c.name.toLowerCase()))
  const customChars = allCharacters.filter(c => c.id >= CUSTOM_OFFSET).filter(c => !defaultNames.has(c.name.toLowerCase()))

  const scrollRafRef = useRef(0)
  const updateScrollButtons = useCallback(() => {
    // Throttle to 1 update per frame — avoids re-rendering on every scroll pixel
    if (scrollRafRef.current) return
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0
      const el = scrollRef.current
      if (!el) return
      const left = el.scrollLeft > 10
      const right = el.scrollLeft < el.scrollWidth - el.clientWidth - 10
      // Only setState when values actually change
      setCanScrollLeft(prev => prev !== left ? left : prev)
      setCanScrollRight(prev => prev !== right ? right : prev)
    })
  }, [])

  // Forward vertical wheel events on the carousel to horizontal scroll
  // Forward any vertical/horizontal wheel on the page to horizontal carousel scroll
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handleWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (delta === 0) return
      e.preventDefault()
      el.scrollLeft += delta
    }
    window.addEventListener("wheel", handleWheel, { passive: false })
    return () => window.removeEventListener("wheel", handleWheel)
  }, [])

  // Preload first 7 characters in ALL 3 aspect ratios — switching feels instant
  useEffect(() => {
    dedupedCharacters.slice(0, 7).forEach(char => {
      if (!char.src.startsWith("http")) return
      ALL_RATIOS.forEach(ar => {
        const url = charImageUrl(char, ar)
        if (document.querySelector(`link[href="${CSS.escape(url)}"]`)) return
        const link = document.createElement("link")
        link.rel = "preload"
        link.as = "image"
        link.href = url
        document.head.appendChild(link)
      })
    })
  }, [dedupedCharacters])

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.7
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" })
  }

  // CSS class for initial card sizing (before user picks) — no flash
  const cardClass = userRatio === null ? "char-card" : undefined

  return (
    <div className="relative flex h-full w-full flex-col bg-white">
      {/* CSS-driven initial card sizes — reads data-device set by inline script before paint */}
      {userRatio === null && (
        <style dangerouslySetInnerHTML={{ __html: [
          // Desktop default: 16:9 cards
          `[data-device="desktop"] .char-card { width:240px; height:135px; contain:layout style }`,
          // Mobile default: 9:16 cards
          `[data-device="mobile"] .char-card { width:101px; height:180px; contain:layout style }`,
          // SSR fallback (no data-device yet): use desktop
          `.char-card { width:240px; height:135px; contain:layout style }`,
        ].join("\n") }} />
      )}
      {/* Logo — top-left, same position on mobile and desktop */}
      <a href="/" className="absolute left-4 top-4 z-10 flex items-center gap-1.5 transition-opacity hover:opacity-60 md:left-6 md:top-5 md:gap-2">
        <svg className="h-3.5 w-auto text-black md:h-4" viewBox="0 0 252 120" fill="currentColor">
          <path d="M96 86.0625V24H120V103.125C120 112.445 112.445 120 103.125 120C98.6751 120 94.2826 118.284 91.125 115.127L0 24H33.9375L96 86.0625Z" />
          <path d="M218.25 0C236.89 0 252 15.1104 252 33.75V96H228V41.0625L173.062 96H228V120H165.75C147.11 120 132 104.89 132 86.25V24H156V79.125L211.125 24H156V0H218.25Z" />
        </svg>
        <span className="text-lg font-pixel text-black md:text-2xl">FaceSwap</span>
      </a>

      {/* Content centered vertically */}
      <div className="flex flex-1 flex-col items-center justify-center">
        {/* Title */}
        <div className="mb-6 text-center md:mb-8">
          <h2 className="text-xl text-black md:text-2xl">Choose a character</h2>
          <p className="mt-1 text-sm text-black">or prompt your own</p>
        </div>

        {/* Horizontal carousel */}
        <div className="relative mx-auto w-full max-w-5xl">
          {/* Left arrow */}
          {canScrollLeft && (
            <button
              onClick={() => scroll("left")}
              className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-[calc(50%+16px)] items-center justify-center rounded-full bg-white/90 shadow-lg ring-1 ring-black/10 backdrop-blur-sm transition-all hover:bg-white hover:shadow-xl active:scale-95 md:left-4"
            >
              <svg className="h-5 w-5 text-black/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Right arrow */}
          {canScrollRight && (
            <button
              onClick={() => scroll("right")}
              className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-[calc(50%+16px)] items-center justify-center rounded-full bg-white/90 shadow-lg ring-1 ring-black/10 backdrop-blur-sm transition-all hover:bg-white hover:shadow-xl active:scale-95 md:right-4"
            >
              <svg className="h-5 w-5 text-black/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Left/right fade — only when there's overflow in that direction */}
          {canScrollLeft && (
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-white to-transparent md:w-16" />
          )}
          {canScrollRight && (
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-white to-transparent md:w-16" />
          )}

          {/* Scroll container */}
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto px-6 pt-2 pb-2 md:gap-4 md:px-8"
            style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
            onScroll={updateScrollButtons}
          >
            {dedupedCharacters.map((char, index) => {
              const isSelected = selectedId === char.id
              const videoUrl = videoByName.get(char.name)
              const isVisible = index < 7 // first ~7 are visible without scrolling

              return (
                <button
                  key={char.id}
                  onClick={() => onSelect(char.id)}
                  className="group flex shrink-0 flex-col items-center gap-2"                >
                  <div
                    style={cardStyle}
                    className={cn(
                      "relative overflow-hidden rounded-2xl bg-neutral-100",
                      cardClass,
                      isSelected
                        ? "outline outline-[3px] outline-black shadow-lg"
                        : "ring-1 ring-black/10 hover:ring-black/20 hover:shadow-md"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={charImageUrl(char, aspectRatio)}
                      alt={char.name}
                      className="h-full w-full object-cover object-top"
                      draggable={false}
                      loading={isVisible ? "eager" : "lazy"}
                      fetchPriority={isVisible ? "high" : "auto"}
                      onError={(e) => { e.currentTarget.src = char.src }}
                    />
                    {/* Video preview — hover on desktop, auto on select for mobile */}
                    {videoUrl && (
                      <video
                        className={cn(
                          "absolute inset-0 h-full w-full transition-opacity duration-300",
                          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        )}
                        style={{ objectFit: "cover", objectPosition: "center top" }}
                        poster={videoFrameUrl(videoUrl) || undefined}
                        muted
                        loop
                        playsInline
                        preload="none"
                        ref={(el) => {
                          if (!el) return
                          if (isSelected) {
                            if (!el.src) el.src = videoUrl
                            el.play().catch(() => {})
                          } else if (!el.paused && !el.matches(":hover")) {
                            el.pause()
                            el.currentTime = 0
                          }
                        }}
                        onMouseEnter={(e) => {
                          const v = e.currentTarget
                          if (!v.src) v.src = videoUrl
                          v.play().catch(() => {})
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.pause()
                            e.currentTarget.currentTime = 0
                          }
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                      />
                    )}

                    {/* Selected check */}
                    {isSelected && (
                      <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black shadow">
                        <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <span className={cn(
                    "text-[13px] transition-colors md:text-sm",
                    isSelected ? "text-black" : "text-black"
                  )}>
                    {char.name}
                  </span>
                </button>
              )
            })}

            {/* Custom (AI-generated) characters */}
            {customChars.map((char) => {
              const isSelected = selectedId === char.id
              return (
                <div
                  key={char.id}
                  className="group relative flex shrink-0 flex-col items-center gap-2"                >
                  <button
                    onClick={() => onSelect(char.id)}
                    className="flex shrink-0 flex-col items-center"
                  >
                    <div
                      style={cardStyle}
                      className={cn(
                        "relative overflow-hidden rounded-2xl bg-neutral-100",
                        cardClass,
                          isSelected
                          ? "outline outline-[3px] outline-black shadow-lg"
                          : "ring-1 ring-black/10 hover:ring-black/20 hover:shadow-md"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={charImageUrl(char, aspectRatio)}
                        alt={char.name}
                        className="h-full w-full object-cover object-top"
                        draggable={false}
                        loading="lazy"
                        onError={(e) => { e.currentTarget.src = char.src }}
                      />
                      {isSelected && (
                        <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black shadow">
                          <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                  <span className={cn(
                    "text-[13px] transition-colors md:text-sm",
                    "text-black"
                  )}>
                    {char.name}
                  </span>
                  {/* Delete button */}
                  {onDeleteCustom && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteCustom(char.id) }}
                      className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 text-black/60 opacity-0 shadow-md ring-1 ring-neutral-300 transition-all hover:bg-neutral-200 hover:text-black group-hover:opacity-100"
                      title="Delete character"
                    >
                      <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              )
            })}

            {/* Create with AI card */}
            <button
              onClick={() => {
                setShowCreateInput(true)
                setTimeout(() => document.getElementById("ai-prompt-input")?.focus(), 100)
              }}
              className="group flex shrink-0 flex-col items-center gap-2"
            >
              <div
                style={cardStyle}
                className={cn("flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 hover:border-neutral-400 hover:bg-neutral-100", cardClass)}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/5">
                  <svg className="h-6 w-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <span className="text-xs text-black">Create with AI</span>
              </div>
              <span className="text-[13px] text-black md:text-sm">Custom</span>
            </button>
          </div>
        </div>

        {/* Aspect ratio selector */}
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {ASPECT_RATIO_OPTIONS.map(({ value, label, icon }) => (
            <button
              key={value}
              onClick={() => {
                const el = scrollRef.current
                if (el) {
                  const viewCenter = el.scrollLeft + el.clientWidth / 2
                  let closestIdx = 0
                  let closestDist = Infinity
                  for (let i = 0; i < el.children.length; i++) {
                    const child = el.children[i] as HTMLElement
                    const d = Math.abs(child.offsetLeft + child.offsetWidth / 2 - viewCenter)
                    if (d < closestDist) { closestDist = d; closestIdx = i }
                  }
                  scrollToIdxRef.current = closestIdx
                }
                setUserRatio(value)
              }}
              onMouseEnter={() => {
                // Prefetch this ratio's images on hover so click feels instant
                if (value === aspectRatio) return
                dedupedCharacters.slice(0, 10).forEach(char => {
                  const img = new Image()
                  img.src = charImageUrl(char, value)
                })
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-all",
                aspectRatio === value
                  ? "bg-black text-white shadow-sm"
                  : "bg-neutral-100 text-black hover:bg-neutral-200"
              )}
            >
              {/* Aspect ratio icon */}
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={aspectRatio === value ? "2" : "1.5"}>
                {icon === "portrait" && <rect x="4" y="1" width="8" height="14" rx="1" />}
                {icon === "square" && <rect x="2" y="2" width="12" height="12" rx="1" />}
                {icon === "landscape" && <rect x="1" y="4" width="14" height="8" rx="1" />}
              </svg>
              {label}
            </button>
          ))}
        </div>

        {/* AI prompt input — below carousel */}
        {(showCreateInput || isGenerating) && (
          <div className="mx-auto mt-4 w-full max-w-md px-6">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-3">
              {isGenerating ? (
                <div className="space-y-2">
                  <p className="text-sm text-black">
                    Creating with <span className="font-medium text-black">Grok</span> via{" "}
                    <a href="https://vercel.com/ai-gateway" target="_blank" rel="noopener noreferrer" className="text-black underline underline-offset-2">AI Gateway</a>
                  </p>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-200">
                    <div
                      className="h-full bg-black transition-all duration-100 ease-linear"
                      style={{ width: `${generationProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    id="ai-prompt-input"
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); handleGenerate() }
                      if (e.key === "Escape") { setShowCreateInput(false); setPrompt("") }
                    }}
                    placeholder="e.g. a pirate cat with an eyepatch"
                    className="h-9 flex-1 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-black placeholder-neutral-400 outline-none transition-all focus:border-neutral-400 focus:ring-1 focus:ring-black/10"
                  />
                  <button
                    onClick={handleGenerate}
                    disabled={!prompt.trim()}
                    className="flex h-9 items-center justify-center rounded-lg bg-black px-3.5 text-sm text-white transition-colors hover:bg-gray-800 disabled:opacity-30"
                  >
                    go
                  </button>
                  <button
                    onClick={() => { setShowCreateInput(false); setPrompt("") }}
                    className="text-black"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            {generateError && (
              <div className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
                {generateError}
                <button onClick={() => setGenerateError(null)} className="ml-2 text-red-400 hover:text-red-300">dismiss</button>
              </div>
            )}
          </div>
        )}

        {/* Next button */}
        <div className="mt-6 w-full max-w-xs px-5 pb-20 md:mt-8 md:pb-4">
          <button
            onClick={() => onNext(aspectRatio)}
            disabled={!selectedId}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] transition-all active:scale-[0.98]",
              selectedId
                ? "bg-black text-white shadow-sm hover:bg-gray-800"
                : "cursor-not-allowed bg-neutral-100 text-black"
            )}
          >
            {selectedId ? (
              <>
                Next: Record video
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </>
            ) : (
              "Select a cartoon to continue"
            )}
          </button>
        </div>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg text-black">Sign in to generate</h2>
            <p className="mb-6 text-sm text-black">
              Create an account to generate custom characters. Your prompt will be saved.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleLoginAndGenerate}
                disabled={isLoggingIn}
                className="flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm text-white transition-colors hover:bg-gray-800 active:scale-[0.98] disabled:opacity-70"
              >
                {isLoggingIn ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 76 65" fill="currentColor">
                      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                    </svg>
                    Continue with Vercel
                  </>
                )}
              </button>
              <button
                onClick={() => setShowLoginModal(false)}
                disabled={isLoggingIn}
                className="rounded-xl px-4 py-3 text-sm text-black transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
