"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { cn } from "@/lib/utils"
import type { Character } from "@/lib/types"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then(res => res.json())

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

// Generate a video poster via Cloudinary (first frame, tiny)
function videoFrameUrl(videoUrl: string): string | null {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (!cloudName || !videoUrl.includes(".public.blob.vercel-storage.com")) return null
  return `https://res.cloudinary.com/${cloudName}/video/fetch/w_320,h_480,c_fill,so_1,f_jpg,q_60/${encodeURIComponent(videoUrl)}`
}

interface GenerationVideo {
  video_url: string
  character_name: string | null
}

interface CharacterSelectionProps {
  selectedId: number | null
  onSelect: (id: number) => void
  onNext: () => void
  onHome?: () => void
  allCharacters: Character[]
  customCharacters: Character[]
  onAddCustom: (character: Character) => void
  onDeleteCustom?: (id: number) => void
  onExpand?: (imageUrl: string, characterId: number, isCustom: boolean) => void
}

export function CharacterSelection({
  selectedId,
  onSelect,
  onNext,
  onHome,
  allCharacters,
}: CharacterSelectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

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

  // Dedup characters by name
  const seenNames = new Set<string>()
  const dedupedCharacters = allCharacters.filter(c => {
    if (seenNames.has(c.name)) return false
    seenNames.add(c.name)
    return true
  })

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 10)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10)
  }, [])

  // Forward vertical wheel events on the page to horizontal scroll on the carousel
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const el = scrollRef.current
      if (!el) return
      // If there's meaningful horizontal or vertical scroll delta, forward it
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (delta === 0) return
      e.preventDefault()
      el.scrollLeft += delta
    }
    window.addEventListener("wheel", handleWheel, { passive: false })
    return () => window.removeEventListener("wheel", handleWheel)
  }, [])

  // Preload first 7 character images immediately via <link rel="preload">
  useEffect(() => {
    dedupedCharacters.slice(0, 7).forEach(char => {
      if (!char.src.startsWith("http")) return
      const url = optimizedUrl(char.src, 640)
      // Avoid duplicates
      if (document.querySelector(`link[href="${url}"]`)) return
      const link = document.createElement("link")
      link.rel = "preload"
      link.as = "image"
      link.href = url
      document.head.appendChild(link)
    })
  }, [dedupedCharacters])

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.7
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" })
  }

  return (
    <div className="relative flex h-full w-full flex-col bg-white">
      {/* Logo */}
      <button onClick={onHome} className="absolute left-6 top-5 z-10 hidden items-center gap-2 transition-opacity hover:opacity-60 md:flex">
        <svg className="h-4 w-auto text-black" viewBox="0 0 252 120" fill="currentColor">
          <path d="M96 86.0625V24H120V103.125C120 112.445 112.445 120 103.125 120C98.6751 120 94.2826 118.284 91.125 115.127L0 24H33.9375L96 86.0625Z" />
          <path d="M218.25 0C236.89 0 252 15.1104 252 33.75V96H228V41.0625L173.062 96H228V120H165.75C147.11 120 132 104.89 132 86.25V24H156V79.125L211.125 24H156V0H218.25Z" />
        </svg>
        <span className="text-2xl font-pixel text-black">FaceSwap</span>
      </button>

      {/* Content centered vertically */}
      <div className="flex flex-1 flex-col items-center justify-center">
        {/* Title */}
        <div className="mb-6 text-center md:mb-8">
          <div className="mb-1 flex items-center justify-center gap-2 md:hidden">
            <svg className="h-4 w-auto text-black" viewBox="0 0 252 120" fill="currentColor">
              <path d="M96 86.0625V24H120V103.125C120 112.445 112.445 120 103.125 120C98.6751 120 94.2826 118.284 91.125 115.127L0 24H33.9375L96 86.0625Z" />
              <path d="M218.25 0C236.89 0 252 15.1104 252 33.75V96H228V41.0625L173.062 96H228V120H165.75C147.11 120 132 104.89 132 86.25V24H156V79.125L211.125 24H156V0H218.25Z" />
            </svg>
            <span className="text-2xl font-pixel text-black">FaceSwap</span>
          </div>
          <h2 className="text-xl font-bold text-black md:text-2xl">Choose a character</h2>
          <p className="mt-1 text-sm text-black/40">or prompt your own</p>
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
            className="flex gap-3 overflow-x-auto px-6 py-1 pb-2 md:gap-4 md:px-8"
            style={{ scrollbarWidth: "none" }}
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
                  className="group flex shrink-0 flex-col items-center gap-2"
                >
                  <div
                    className={cn(
                      "relative h-[160px] w-[110px] overflow-hidden rounded-2xl bg-neutral-100 transition-all duration-200 md:h-[220px] md:w-[155px]",
                      isSelected
                        ? "outline outline-[3px] outline-black shadow-lg"
                        : "ring-1 ring-black/10 hover:ring-black/20 hover:shadow-md"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={optimizedUrl(char.src, 640)}
                      alt={char.name}
                      className="h-full w-full object-cover object-top"
                      draggable={false}
                      loading={isVisible ? "eager" : "lazy"}
                      fetchPriority={isVisible ? "high" : "auto"}
                      onLoad={(e) => {
                        const img = e.currentTarget
                        const entry = performance.getEntriesByName(img.src).pop() as PerformanceResourceTiming | undefined
                        const cached = entry ? entry.transferSize === 0 : "unknown"
                        const duration = entry ? Math.round(entry.duration) : "?"
                        const size = entry ? Math.round(entry.encodedBodySize / 1024) : "?"
                        console.log(`[img] ${char.name} | ${duration}ms | ${size}KB | cached=${cached} | visible=${isVisible} | ${img.src.slice(0, 80)}...`)
                      }}
                      onError={(e) => {
                        console.error(`[img] FAILED: ${char.name} | ${e.currentTarget.src.slice(0, 80)}`)
                        e.currentTarget.src = char.src
                      }}
                    />
                    {/* Video loads ONLY on hover */}
                    {videoUrl && (
                      <video
                        className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                        poster={videoFrameUrl(videoUrl) || undefined}
                        muted
                        loop
                        playsInline
                        preload="none"
                        onMouseEnter={(e) => {
                          const v = e.currentTarget
                          if (!v.src) v.src = videoUrl
                          v.play().catch(() => {})
                        }}
                        onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0 }}
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
                    isSelected ? "font-semibold text-black" : "text-black/50 group-hover:text-black/70"
                  )}>
                    {char.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Next button */}
        <div className="mt-6 w-full max-w-xs px-5 pb-20 md:mt-8 md:pb-4">
          <button
            onClick={onNext}
            disabled={!selectedId}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition-all active:scale-[0.98]",
              selectedId
                ? "bg-black text-white shadow-sm hover:bg-gray-800"
                : "cursor-not-allowed bg-neutral-100 text-black/25"
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
    </div>
  )
}
