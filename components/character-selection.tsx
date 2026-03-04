"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { cn } from "@/lib/utils"
import type { Character } from "@/lib/types"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then(res => res.json())

function optimizedUrl(src: string, width: number): string {
  if (src.startsWith("/")) return src
  // Don't optimize data: URLs, blob: URLs, or non-http URLs
  if (!src.startsWith("http")) return src
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`
}

interface GenerationVideo {
  video_url: string
  character_name: string | null
}

interface CharacterSelectionProps {
  selectedId: number | null
  onSelect: (id: number) => void
  onNext: () => void
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

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.7
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" })
  }

  return (
    <div className="relative flex h-full w-full flex-col bg-white">
      {/* Logo */}
      <h1 className="absolute left-6 top-5 z-10 hidden text-2xl font-pixel text-black md:block">v0 FaceSwap</h1>

      {/* Content centered vertically */}
      <div className="flex flex-1 flex-col items-center justify-center">
        {/* Title */}
        <div className="mb-6 text-center md:mb-8">
          <h1 className="mb-1 text-2xl font-pixel text-black md:hidden">v0 FaceSwap</h1>
          <h2 className="text-xl font-bold text-black md:text-2xl">Choose a character</h2>
          <p className="mt-1 text-sm text-black/40">or prompt your own</p>
        </div>

        {/* Horizontal carousel */}
        <div className="relative mx-auto w-full max-w-5xl px-12 md:px-16">
          {/* Left arrow */}
          {canScrollLeft && (
            <button
              onClick={() => scroll("left")}
              className="absolute left-1 top-1/2 z-20 flex h-10 w-10 -translate-y-[calc(50%+16px)] items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/10 transition-all hover:shadow-xl active:scale-95 md:left-3"
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
              className="absolute right-1 top-1/2 z-20 flex h-10 w-10 -translate-y-[calc(50%+16px)] items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/10 transition-all hover:shadow-xl active:scale-95 md:right-3"
            >
              <svg className="h-5 w-5 text-black/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Left/right fade */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-white via-white/70 to-transparent md:w-32" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-white via-white/70 to-transparent md:w-32" />

          {/* Scroll container */}
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto px-1 py-1 pb-2 md:gap-4"
            style={{ scrollbarWidth: "none" }}
            onScroll={updateScrollButtons}
          >
            {dedupedCharacters.map((char) => {
              const isSelected = selectedId === char.id
              const videoUrl = videoByName.get(char.name)

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
                    {/* Video or image */}
                    {videoUrl ? (
                      <video
                        src={videoUrl}
                        className="h-full w-full object-cover"
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                        onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0 }}
                      />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={optimizedUrl(char.src, 384)}
                        alt={char.name}
                        className="h-full w-full object-cover object-top"
                        loading="lazy"
                        draggable={false}
                        onError={(e) => { e.currentTarget.src = char.src }}
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
