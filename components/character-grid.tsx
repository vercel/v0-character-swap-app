"use client"

import React, { useState } from "react"
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
}: CharacterGridProps) {
  const [prompt, setPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [showHowItWorks, setShowHowItWorks] = useState(false)

  const displayCharacters = [...DEFAULT_CHARACTERS, ...customCharacters]

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

        const newId = Math.max(...displayCharacters.map(c => c.id), 0) + 1
        onAddCustom({ id: newId, src: finalUrl, name: prompt.trim().slice(0, 20) })
        setPrompt("")
        onSelect(newId)
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
        <p className="mb-2 font-mono text-[10px] lowercase text-neutral-500 md:mb-3 md:text-[11px]">
          select character
        </p>

        {/* Grid container */}
        <div className="py-1">
          <div className="flex flex-wrap gap-1.5 md:gap-2">
          {displayCharacters.length === 0 && !isGenerating && (
            <p className="w-full py-2 text-center font-mono text-[11px] text-neutral-600">
              create a cartoon character below
            </p>
          )}
          {displayCharacters.map((char) => {
            const isSelected = selectedId === char.id
            const isCustom = customCharacters.some(c => c.id === char.id)

            return (
              <div key={char.id} className="group relative">
                <button
                  onClick={() => {
                    if (!isSelected) {
                      onSelect(char.id)
                    }
                  }}
                  disabled={disabled}
                  data-selected={isSelected}
                  className="relative h-[50px] w-[50px] overflow-hidden rounded-lg border border-neutral-800 transition-all hover:border-neutral-600 data-[selected=true]:border-[2px] data-[selected=true]:border-white disabled:cursor-not-allowed disabled:opacity-50 md:h-[56px] md:w-[56px]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={char.src ? gridThumbUrl(char.src) : "/placeholder.svg"}
                    alt={char.name}
                    className="h-full w-full object-cover object-top"
                    loading="eager"
                    draggable={false}
                  />
                </button>

                {/* Delete button */}
                {isCustom && onDeleteCustom && !disabled && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteCustom(char.id)
                    }}
                    className="absolute -right-1 -top-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-neutral-800/90 text-neutral-500 opacity-0 ring-1 ring-neutral-700 transition-all hover:bg-neutral-700 hover:text-white group-hover:opacity-100"
                    title="Delete character"
                  >
                    <svg className="h-2 w-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}

                {/* Selected overlay: expand + download */}
                {isSelected && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center gap-1.5 rounded-lg bg-black/50">
                    {onExpand && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onExpand(char.src, char.id, true)
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
                        title="View full image"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        try {
                          const res = await fetch(char.src)
                          const blob = await res.blob()
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement("a")
                          a.href = url
                          a.download = `${char.name || "character"}.png`
                          a.click()
                          URL.revokeObjectURL(url)
                        } catch {
                          window.open(char.src, "_blank")
                        }
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
                      title="Download image"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )
          })}
          </div>
        </div>

        {/* AI Prompt Bar - always visible */}
        <p className="mb-1 mt-3 font-mono text-[10px] lowercase text-neutral-500">
          prompt and generate your cartoon!
        </p>
        <div className="rounded-lg bg-neutral-900 p-3">
          {isGenerating ? (
            <div className="space-y-2">
              <p className="font-mono text-[11px] text-neutral-400">
                Generating with <span className="text-white">Nano Banana Pro</span>...
              </p>
              <div className="h-px w-full overflow-hidden bg-neutral-800">
                <div
                  className="h-full bg-white transition-all duration-100 ease-linear"
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
                className="h-8 flex-1 rounded-lg border-0 bg-neutral-800 px-3 font-mono text-[12px] text-white placeholder-neutral-500 outline-none transition-colors focus:ring-1 focus:ring-neutral-600 disabled:opacity-50"
              />
              <button
                onClick={handleGenerate}
                disabled={disabled || !prompt.trim()}
                className="flex h-8 items-center justify-center rounded-lg bg-white px-3 font-mono text-[11px] text-black transition-opacity hover:opacity-80 disabled:opacity-30"
              >
                go
              </button>
            </div>
          )}
        </div>

        {/* Generate error message */}
        {generateError && (
          <div className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-400">
            {generateError}
            <button
              onClick={() => setGenerateError(null)}
              className="ml-2 text-red-300 hover:text-red-200"
            >
              Dismiss
            </button>
          </div>
        )}

      </div>

      {/* Children slot for My Videos panel */}
      {children && <div className="shrink-0">{children}</div>}

      {/* Generate Video CTA */}
      {onGenerate && (
        <div className="shrink-0 pt-2 md:pt-4">
          <div className="flex flex-col gap-1.5 md:gap-4">
            {generateError && (
              <p className="font-mono text-[10px] text-amber-400 md:text-[11px]">
                {generateError}
              </p>
            )}
            {userEmail && onSendEmailChange && (
              <label className="flex cursor-pointer items-center gap-2" onClick={() => onSendEmailChange(!sendEmail)}>
                <div className={cn(
                  "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors",
                  sendEmail
                    ? "border-white bg-white"
                    : "border-neutral-600 bg-neutral-800"
                )}>
                  {sendEmail && (
                    <svg className="h-2.5 w-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="font-mono text-[10px] text-neutral-500 md:text-[11px]">
                  email me when ready
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
                "flex h-9 w-full items-center justify-center rounded-lg font-mono text-[12px] font-medium transition-all active:scale-[0.98] md:h-10 md:text-[13px]",
                canGenerate
                  ? "bg-white text-black hover:bg-neutral-200"
                  : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
              )}
            >
              Generate video
            </button>
            {hasVideo && onRetake && (
              <button
                onClick={onRetake}
                className="flex h-9 w-full items-center justify-center rounded-lg font-mono text-[12px] font-medium text-neutral-400 transition-all hover:text-white active:scale-[0.98] md:h-10 md:text-[13px]"
              >
                Retake video
              </button>
            )}
            <div className="hidden items-center justify-center gap-3 font-mono text-[10px] text-neutral-500 md:flex">
              <a
                href="https://v0.app/templates/1Nu0E0eAo9q"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-white"
              >
                template in v0
              </a>
              <span className="text-neutral-700">·</span>
              <button
                onClick={() => setShowHowItWorks(true)}
                className="cursor-pointer transition-colors hover:text-white"
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
            className="relative max-h-[80vh] w-full max-w-md overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-950 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowHowItWorks(false)}
              className="absolute right-3 top-3 text-neutral-500 transition-colors hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="mb-6 font-mono text-[13px] font-medium text-white">how it works</h2>

            <div className="space-y-6 font-mono text-[11px] text-neutral-400">
              <div>
                <p className="mb-2 text-neutral-500">// the flow</p>
                <p>
                  record yourself → your video is uploaded to {" "}
                  <a href="https://vercel.com/docs/storage/vercel-blob" target="_blank" rel="noopener noreferrer" className="text-neutral-300 hover:text-white">vercel blob</a>
                  {" "} → pick a character → a {" "}
                  <a href="https://vercel.com/docs/workflow" target="_blank" rel="noopener noreferrer" className="text-neutral-300 hover:text-white">vercel workflow</a>
                  {" "} kicks off the generation → download with picture-in-picture and watermark via cloudinary.
                </p>
              </div>

              <div>
                <p className="mb-2 text-neutral-500">// ai generation</p>
                <p>
                  <a href="https://vercel.com/docs/ai-gateway" target="_blank" rel="noopener noreferrer" className="text-neutral-300 hover:text-white">ai gateway</a>
                  {" "} routes the request to klingai/kling-v2.6-motion-control. the model analyzes your facial landmarks, expressions, and head pose frame-by-frame, then transfers that motion onto the character image. the {" "}
                  <a href="https://sdk.vercel.ai" target="_blank" rel="noopener noreferrer" className="text-neutral-300 hover:text-white">ai sdk</a>
                  {" "} handles polling until the video is ready.
                </p>
              </div>

              <div>
                <p className="mb-2 text-neutral-500">// infrastructure</p>
                <div className="mt-2 space-y-2">
                  <p>
                    <a href="https://vercel.com/docs/workflow" target="_blank" rel="noopener noreferrer" className="text-neutral-300 hover:text-white">workflow</a>
                    <span className="text-neutral-500"> — </span>
                    durable execution that survives serverless timeouts. orchestrates: convert video → call ai gateway → save result → update db → send email.
                  </p>
                  <p>
                    <a href="https://vercel.com/docs/storage/vercel-blob" target="_blank" rel="noopener noreferrer" className="text-neutral-300 hover:text-white">blob</a>
                    <span className="text-neutral-500"> — </span>
                    stores raw recordings, character images, and generated videos. serves everything via edge cdn.
                  </p>
                  <p>
                    <a href="https://vercel.com/docs/ai-gateway" target="_blank" rel="noopener noreferrer" className="text-neutral-300 hover:text-white">ai gateway</a>
                    <span className="text-neutral-500"> — </span>
                    unified routing for ai model requests. handles auth, rate limiting, and provider abstraction for klingai.
                  </p>
                  <p>
                    <a href="https://neon.tech" target="_blank" rel="noopener noreferrer" className="text-neutral-300 hover:text-white">neon postgres</a>
                    <span className="text-neutral-500"> — </span>
                    tracks generation state (pending → processing → completed/failed), users, and character library.
                  </p>
                  <p>
                    <span className="text-neutral-300">cloudinary</span>
                    <span className="text-neutral-500"> — </span>
                    server-side video conversion (webm/mov → mp4 for cross-browser compat) and compositing (pip overlay + watermark) on download.
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-neutral-500">// built with</p>
                <p>
                  <a href="https://nextjs.org" target="_blank" rel="noopener noreferrer" className="text-neutral-300 hover:text-white">next.js 16</a>
                  <span className="text-neutral-500"> + </span>
                  <a href="https://sdk.vercel.ai" target="_blank" rel="noopener noreferrer" className="text-neutral-300 hover:text-white">ai sdk</a>
                  <span className="text-neutral-500"> + </span>
                  <a href="https://v0.dev" target="_blank" rel="noopener noreferrer" className="text-neutral-300 hover:text-white">v0</a>
                  <span className="text-neutral-500"> + </span>
                  <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-neutral-300 hover:text-white">vercel</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
