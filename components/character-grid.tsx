"use client"

import React, { useState, useRef } from "react"
import { cn } from "@/lib/utils"
import { upload } from "@vercel/blob/client"
import type { Character } from "@/lib/types"
import { DEFAULT_CHARACTERS } from "@/lib/constants"

export type { Character }

// Optimize images via Next.js image API for grid thumbnails
function gridThumbUrl(src: string): string {
  if (src.startsWith("/")) return src
  return `/_next/image?url=${encodeURIComponent(src)}&w=128&q=75`
}

interface CharacterGridProps {
  selectedId: number | null
  onSelect: (id: number) => void
  disabled?: boolean
  customCharacters: Character[]
  onAddCustom: (character: Character) => void
  onDeleteCustom?: (id: number) => void
  onExpand?: (imageUrl: string, characterId: number, isCustom: boolean) => void
  children?: React.ReactNode
  // Generate video CTA props
  canGenerate?: boolean
  hasVideo?: boolean
  hasCharacter?: boolean
  onGenerate?: () => void
  onRetake?: () => void
  // Email notification
  sendEmail?: boolean
  onSendEmailChange?: (value: boolean) => void
  userEmail?: string | null
  // Hide generate button section (for step 1 character selection)
  showGenerateButton?: boolean
  // Hide the "Select Cartoon" title (parent provides its own)
  showTitle?: boolean
}

export function CharacterGrid({
  selectedId,
  onSelect,
  disabled = false,
  customCharacters,
  onAddCustom,
  onDeleteCustom,
  onExpand,
  children,
  canGenerate = false,
  hasVideo = false,
  hasCharacter = false,
  onGenerate,
  onRetake,
  sendEmail = false,
  onSendEmailChange,
  userEmail,
  showGenerateButton = true,
  showTitle = true,
}: CharacterGridProps) {
  const prefetchedFullRef = useRef(new Set<string>())
  const [prompt, setPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [sharePrompt, setSharePrompt] = useState<{ url: string; name: string } | null>(null)
  const [shareSubmitted, setShareSubmitted] = useState(false)

  // Deduplicate by image URL — custom characters override defaults with same image
  const seen = new Set<string>()
  const displayCharacters = [...DEFAULT_CHARACTERS, ...customCharacters].filter(c => {
    if (seen.has(c.src)) return false
    seen.add(c.src)
    return true
  })

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return

    setIsGenerating(true)
    setGenerationProgress(0)

    const duration = 20000
    const startTime = Date.now()
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min((elapsed / duration) * 95, 95)
      setGenerationProgress(progress)
    }, 100)

    try {
      const response = await fetch("/api/generate-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      })

      const data = await response.json()

      clearInterval(progressInterval)
      setGenerationProgress(100)

      if (data.imageUrl) {
        let finalUrl = data.imageUrl
        try {
          if (data.imageUrl.startsWith("data:")) {
            const res = await fetch(data.imageUrl)
            const blob = await res.blob()
            const uploaded = await upload(`reference-images/${Date.now()}-generated.png`, blob, {
              access: "public",
              handleUploadUrl: "/api/upload",
            })
            finalUrl = uploaded.url
          }
        } catch {
          // Use original URL if upload fails
        }

        const charName = prompt.trim().slice(0, 20)
        const newId = Math.max(...displayCharacters.map(c => c.id), 0) + 1
        onAddCustom({ id: newId, src: finalUrl, name: charName })
        setPrompt("")
        // Offer to share to community
        setSharePrompt({ url: finalUrl, name: charName })
        setShareSubmitted(false)
      }
    } catch (error) {
      console.error("Failed to generate:", error)
      clearInterval(progressInterval)
      setGenerateError("Failed to generate character. Please try again.")
    } finally {
      setTimeout(() => {
        setIsGenerating(false)
        setGenerationProgress(0)
      }, 300)
    }
  }

  return (
    <div className="relative flex max-h-full flex-col">
      <div className="shrink overflow-y-auto md:min-h-0 md:flex-1">
        {showTitle && (
          <p className="mb-2 text-xl font-pixel text-black md:mb-3">
            Select Cartoon
          </p>
        )}

        {/* Grid container */}
        <div className="overflow-visible pl-1.5 pt-2">
          <div className="flex flex-wrap justify-center gap-2 md:gap-2.5">
          {displayCharacters.length === 0 && !isGenerating && (
            <p className="w-full py-2 text-center text-sm text-black/50">
              Create your first cartoon below
            </p>
          )}
          {displayCharacters.map((char) => {
            const isSelected = selectedId === char.id
            const isCustom = customCharacters.some(c => c.id === char.id)

            return (
              <div key={char.id} className="group relative"
                onMouseEnter={() => {
                  // Prefetch full-size image on hover so lightbox is instant
                  if (onExpand && char.src && !char.src.startsWith("/") && !prefetchedFullRef.current.has(char.src)) {
                    prefetchedFullRef.current.add(char.src)
                    const img = new window.Image()
                    img.src = char.src
                  }
                }}
              >
                <button
                  onClick={() => onSelect(char.id)}
                  disabled={disabled}
                  data-selected={isSelected}
                  className="relative h-[54px] w-[54px] overflow-hidden rounded-xl border border-neutral-200 bg-white transition-all hover:border-neutral-400 hover:shadow-sm data-[selected=true]:border-[2px] data-[selected=true]:border-black data-[selected=true]:shadow-md disabled:cursor-not-allowed disabled:opacity-50 md:h-[60px] md:w-[60px]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={char.src ? gridThumbUrl(char.src) : "/placeholder.svg"}
                    alt={char.name}
                    className="h-full w-full object-cover object-top"
                    loading="eager"
                    draggable={false}
                  />
                  {/* Selected checkmark */}
                  {isSelected && (
                    <div className="absolute bottom-1 right-1 z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-black shadow-sm">
                      <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>

                {/* Expand button — appears on hover */}
                {onExpand && !disabled && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onExpand(char.src, char.id, !!isCustom)
                    }}
                    className="absolute -left-1 -top-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-neutral-100 text-black/50 opacity-0 ring-1 ring-neutral-200 transition-all hover:bg-neutral-200 hover:text-black group-hover:opacity-100"
                    title="View full image"
                  >
                    <svg className="h-2 w-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m6 6v-6m0 6h-6M3 3l6 6M3 3v6m0-6h6" />
                    </svg>
                  </button>
                )}

                {/* Delete button */}
                {isCustom && onDeleteCustom && !disabled && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteCustom(char.id)
                    }}
                    className="absolute -right-1 -top-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-neutral-100 text-black/50 opacity-0 ring-1 ring-neutral-200 transition-all hover:bg-neutral-200 hover:text-black group-hover:opacity-100"
                    title="Delete character"
                  >
                    <svg className="h-2 w-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )
          })}
          </div>
        </div>

        {/* AI Prompt Bar */}
        <div className="mb-1.5 mt-5 flex items-center gap-2">
          <p className="text-[15px] font-semibold text-black">Create your own</p>
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium text-black/40">AI</span>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-3">
          {isGenerating ? (
            <div className="space-y-2">
              <p className="text-sm text-black/70">
                Generating with <span className="font-medium text-black">Nano Banana Pro</span> via{" "}
                <a href="https://vercel.com/ai-gateway" target="_blank" rel="noopener noreferrer" className="font-medium text-black underline underline-offset-2 hover:text-black/60">AI Gateway</a>
              </p>
              <div className="h-px w-full overflow-hidden rounded-full bg-neutral-200">
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
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleGenerate()
                  }
                }}
                placeholder="e.g. a pirate cat with an eyepatch"
                disabled={disabled}
                className="h-10 flex-1 rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-black placeholder-neutral-400 outline-none transition-all focus:border-neutral-400 focus:ring-1 focus:ring-black/10 disabled:opacity-50"
              />
              <button
                onClick={handleGenerate}
                disabled={disabled || !prompt.trim()}
                className="flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-30"
              >
                go
              </button>
            </div>
          )}
        </div>

        {/* Share to community prompt */}
        {sharePrompt && !shareSubmitted && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sharePrompt.url} alt="" className="h-9 w-9 rounded-lg object-cover" />
            <div className="flex-1">
              <p className="text-xs font-medium text-black">Share to community?</p>
              <p className="text-[10px] text-black/40">Others can use your cartoon</p>
            </div>
            <button
              onClick={async () => {
                await fetch("/api/submit-character", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ imageUrl: sharePrompt.url, name: sharePrompt.name }),
                })
                setShareSubmitted(true)
                setTimeout(() => setSharePrompt(null), 2000)
              }}
              className="rounded-lg bg-black px-3 py-1.5 text-[11px] font-medium text-white hover:bg-gray-800"
            >
              Share
            </button>
            <button
              onClick={() => setSharePrompt(null)}
              className="text-black/30 hover:text-black"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {shareSubmitted && (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2.5 text-xs text-green-700">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Submitted for review — thanks!
          </div>
        )}

        {/* Generate error message */}
        {generateError && (
          <div className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
            {generateError}
            <button
              onClick={() => setGenerateError(null)}
              className="ml-2 text-red-400 hover:text-red-300"
            >
              Dismiss
            </button>
          </div>
        )}

      </div>

      {/* Children slot for My Videos panel */}
      {children && <div className="shrink-0">{children}</div>}

      {/* Generate Video CTA */}
      {onGenerate && showGenerateButton && (
        <div className="shrink-0 pt-2 md:pt-4">
          <div className="flex flex-col gap-1.5 md:gap-4">
            {generateError && (
              <p className="text-xs text-yellow-500 md:text-sm">
                {generateError}
              </p>
            )}
            {userEmail && onSendEmailChange && (
              <label className="flex cursor-pointer items-center gap-2" onClick={() => onSendEmailChange(!sendEmail)}>
                <div className={cn(
                  "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors",
                  sendEmail
                    ? "border-black bg-black"
                    : "border-neutral-300 bg-neutral-100"
                )}>
                  {sendEmail && (
                    <svg className="h-2.5 w-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-black/50 md:text-sm">
                  Email me when ready
                </span>
              </label>
            )}
            <button
              onClick={() => {
                if (canGenerate) {
                  setGenerateError(null)
                  onGenerate()
                } else if (!hasVideo && !hasCharacter) {
                  setGenerateError("record a video and select a character first")
                } else if (!hasVideo) {
                  setGenerateError("record a video first")
                } else if (!hasCharacter) {
                  setGenerateError("select a character first")
                }
              }}
              className={cn(
                "flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold transition-all active:scale-[0.98] md:h-11 md:text-base",
                canGenerate
                  ? "bg-black text-white hover:bg-gray-800"
                  : "bg-neutral-100 text-black/50 hover:bg-neutral-200"
              )}
            >
              Generate video
            </button>
            {hasVideo && onRetake && (
              <button
                onClick={onRetake}
                className="flex h-10 w-full items-center justify-center rounded-lg text-sm font-medium text-black/50 transition-all hover:text-black active:scale-[0.98] md:h-11 md:text-base"
              >
                Retake video
              </button>
            )}
            <div className="hidden items-center justify-center gap-3 text-xs text-black/40 md:flex">
              <a
                href="https://v0.app/templates/1Nu0E0eAo9q"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-black"
              >
                template in v0
              </a>
              <span className="text-black/30">·</span>
              <button
                onClick={() => setShowHowItWorks(true)}
                className="cursor-pointer transition-colors hover:text-black"
              >
                How it works
              </button>
            </div>
          </div>
        </div>
      )}

      {/* How it works modal */}
      {showHowItWorks && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setShowHowItWorks(false)}
          onKeyDown={(e) => e.key === "Escape" && setShowHowItWorks(false)}
          tabIndex={0}
          ref={(el) => el?.focus()}
        >
          <div
            className="relative max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowHowItWorks(false)}
              className="absolute right-3 top-3 text-black/50 transition-colors hover:text-black"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="mb-6 text-xl font-pixel text-black">How It Works</h2>

            <div className="space-y-6 text-sm text-black/70">
              <div>
                <p className="mb-2 text-black/40">// the flow</p>
                <p>
                  record yourself → your video is uploaded to {" "}
                  <a href="https://vercel.com/docs/storage/vercel-blob" target="_blank" rel="noopener noreferrer" className="text-black underline hover:text-black/60">vercel blob</a>
                  {" "} → pick a character → a {" "}
                  <a href="https://vercel.com/docs/workflow" target="_blank" rel="noopener noreferrer" className="text-black underline hover:text-black/60">vercel workflow</a>
                  {" "} kicks off the generation → download with picture-in-picture and watermark via cloudinary.
                </p>
              </div>

              <div>
                <p className="mb-2 text-black/40">// ai generation</p>
                <p>
                  <a href="https://vercel.com/docs/ai-gateway" target="_blank" rel="noopener noreferrer" className="text-black underline hover:text-black/60">ai gateway</a>
                  {" "} routes the request to klingai/kling-v2.6-motion-control. the model analyzes your facial landmarks, expressions, and head pose frame-by-frame, then transfers that motion onto the character image. the {" "}
                  <a href="https://sdk.vercel.ai" target="_blank" rel="noopener noreferrer" className="text-black underline hover:text-black/60">ai sdk</a>
                  {" "} handles polling until the video is ready.
                </p>
              </div>

              <div>
                <p className="mb-2 text-black/40">// infrastructure</p>
                <div className="mt-2 space-y-2">
                  <p>
                    <a href="https://vercel.com/docs/workflow" target="_blank" rel="noopener noreferrer" className="text-black underline hover:text-black/60">workflow</a>
                    <span className="text-black/40"> — </span>
                    durable execution that survives serverless timeouts. orchestrates: convert video → call ai gateway → save result → update db → send email.
                  </p>
                  <p>
                    <a href="https://vercel.com/docs/storage/vercel-blob" target="_blank" rel="noopener noreferrer" className="text-black underline hover:text-black/60">blob</a>
                    <span className="text-black/40"> — </span>
                    stores raw recordings, character images, and generated videos. serves everything via edge cdn.
                  </p>
                  <p>
                    <a href="https://vercel.com/docs/ai-gateway" target="_blank" rel="noopener noreferrer" className="text-black underline hover:text-black/60">ai gateway</a>
                    <span className="text-black/40"> — </span>
                    unified routing for ai model requests. handles auth, rate limiting, and provider abstraction for klingai.
                  </p>
                  <p>
                    <a href="https://neon.tech" target="_blank" rel="noopener noreferrer" className="text-black underline hover:text-black/60">neon postgres</a>
                    <span className="text-black/40"> — </span>
                    tracks generation state (pending → processing → completed/failed), users, and character library.
                  </p>
                  <p>
                    <span className="text-black underline">cloudinary</span>
                    <span className="text-black/40"> — </span>
                    server-side video conversion (webm/mov → mp4 for cross-browser compat) and compositing (pip overlay + watermark) on download.
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-black/40">// built with</p>
                <p>
                  <a href="https://nextjs.org" target="_blank" rel="noopener noreferrer" className="text-black underline hover:text-black/60">next.js 16</a>
                  <span className="text-black/40"> + </span>
                  <a href="https://sdk.vercel.ai" target="_blank" rel="noopener noreferrer" className="text-black underline hover:text-black/60">ai sdk</a>
                  <span className="text-black/40"> + </span>
                  <a href="https://v0.dev" target="_blank" rel="noopener noreferrer" className="text-black underline hover:text-black/60">v0</a>
                  <span className="text-black/40"> + </span>
                  <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-black underline hover:text-black/60">vercel</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
