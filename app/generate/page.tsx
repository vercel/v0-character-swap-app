"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, useRef, useCallback, Suspense } from "react"
import Image from "next/image"
import useSWR from "swr"
import { useVideo } from "@/providers/video-context"
import { useAuth } from "@/components/auth-provider"
import { useCharacters } from "@/hooks/use-characters"
import { useVideoGeneration } from "@/hooks/use-video-generation"
import { useViewer } from "@/providers/viewer-context"
import { computeProgress, fetchMedianDuration, _cachedMedian } from "@/components/generation-progress"

const fetcher = (url: string) => fetch(url).then(res => res.json())

// --- Educational chapters ---
const chapters = [
  {
    title: "Recording",
    content: (
      <>
        The browser's MediaRecorder API captures a short video clip directly on your device — no uploads until you're ready.
        Once you pick a character, the recording is sent to{" "}
        <a href="https://vercel.com/docs/storage/vercel-blob" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-black">Vercel Blob</a>
        {" "}in the background so it's available for processing without blocking the UI.
      </>
    ),
  },
  {
    title: "Character generation",
    content: (
      <>
        Default characters are pre-made illustrations. Custom characters are generated with{" "}
        <a href="https://x.ai" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-black">Grok</a>
        {" "}via the{" "}
        <a href="https://sdk.vercel.ai" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-black">AI SDK</a>
        {" "}through{" "}
        <a href="https://vercel.com/ai-gateway" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-black">AI Gateway</a>
        . A single 16:9 image is generated with a crop-safe composition, then served at different aspect ratios via Cloudinary so the same character works in portrait, landscape, and square.
      </>
    ),
  },
  {
    title: "Video generation",
    content: (
      <>
        The{" "}
        <a href="https://sdk.vercel.ai" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-black">AI SDK</a>
        {" "}sends the request through{" "}
        <a href="https://vercel.com/ai-gateway" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-black">AI Gateway</a>
        {" "}to Kling AI's Motion Control model. It analyzes facial landmarks, expressions, and head pose frame-by-frame from your recording, then transfers that motion onto the character image to produce the final video.
      </>
    ),
  },
  {
    title: "Orchestration",
    content: (
      <>
        A{" "}
        <a href="https://vercel.com/docs/workflow" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-black">Vercel Workflow</a>
        {" "}coordinates the entire pipeline: video conversion, AI Gateway calls, result storage, and email notification.
        Workflows are durable — they survive serverless timeouts and browser closes, so your video keeps processing even if you leave the page.
      </>
    ),
  },
]

function getStatusMessage(status: string, progress: number): string {
  if (status === "uploading") return "Uploading video..."
  if (status === "pending") return "In queue..."
  if (progress < 10) return "Starting AI model..."
  if (progress < 30) return "Analyzing motion..."
  if (progress < 60) return "Processing frames..."
  if (progress < 85) return "Generating video..."
  return "Rendering final..."
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

// --- Ongoing generation view ---
function OngoingGenerationView({ generationId }: { generationId: number }) {
  const router = useRouter()
  const { user } = useAuth()
  const { viewVideo } = useViewer()
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const completedRef = useRef(false)

  const { data, mutate } = useSWR(
    `/api/generations`,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 500 }
  )

  const generations = data?.generations || []
  const generation = generations.find((g: any) => g.id === generationId)

  const isPending = generation && (
    generation.status === "uploading" ||
    generation.status === "pending" ||
    generation.status === "processing"
  )

  // Poll while pending
  useSWR(
    isPending ? `/api/generations` : null,
    fetcher,
    { refreshInterval: 5000, dedupingInterval: 3000 }
  )

  // Listen for refresh events
  useEffect(() => {
    const handleRefresh = () => mutate()
    window.addEventListener("refresh-generations", handleRefresh)
    return () => window.removeEventListener("refresh-generations", handleRefresh)
  }, [mutate])

  // Fetch median duration
  useEffect(() => {
    fetchMedianDuration()
  }, [])

  // Elapsed time counter
  useEffect(() => {
    if (!generation?.created_at) return
    const startTime = new Date(generation.created_at).getTime()
    const update = () => setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [generation?.created_at])

  // Auto-open viewer on completion
  useEffect(() => {
    if (!generation || completedRef.current) return
    if (generation.status === "completed" && generation.video_url) {
      completedRef.current = true
      viewVideo({
        videoUrl: generation.video_url,
        sourceVideoUrl: generation.source_video_url || null,
        sourceAspectRatio: generation.source_video_aspect_ratio || "fill",
        generatedAspectRatio: generation.aspect_ratio || "fill",
        characterName: generation.character_name,
        characterImageUrl: generation.character_image_url,
      })
      router.replace("/pick")
    }
  }, [generation, viewVideo, router])

  // Escape key → close modal or /pick
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showHowItWorks) {
          setShowHowItWorks(false)
        } else {
          router.push("/pick")
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [router, showHowItWorks])

  // Generation not found yet (still loading)
  if (!generation) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/20 border-t-black" />
      </div>
    )
  }

  // Failed
  if (generation.status === "failed" || generation.status === "cancelled") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6">
        <div className="text-center">
          <p className="mb-2 text-lg font-semibold text-black">Generation failed</p>
          <p className="text-sm text-black/60">
            {generation.error?.summary || generation.error_message || "Something went wrong"}
          </p>
        </div>
        <button
          onClick={() => router.push("/pick")}
          className="rounded-xl bg-black px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          Back to characters
        </button>
      </div>
    )
  }

  const progress = computeProgress(elapsedSeconds, _cachedMedian)
  const statusMessage = getStatusMessage(generation.status, progress)

  return (
    <div className="flex h-full w-full flex-col items-center overflow-y-auto bg-white px-6 py-10 md:justify-center md:py-6">
      <div className="w-full max-w-md">
        {/* Character image + name */}
        <div className="mb-6 flex flex-col items-center">
          {generation.character_image_url && (
            <div className="relative mb-3 h-24 w-20 overflow-hidden rounded-xl shadow-md ring-1 ring-black/5">
              <Image
                src={generation.character_image_url}
                alt={generation.character_name || ""}
                fill
                className="object-cover"
                sizes="80px"
              />
            </div>
          )}
          {generation.character_name && (
            <p className="text-sm font-medium text-black/70">{generation.character_name}</p>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-medium text-black">{statusMessage}</span>
            <span className="text-sm tabular-nums text-black/50">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-black transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Elapsed time */}
        <p className="mb-8 text-right text-xs tabular-nums text-black/40">
          Elapsed: {formatTime(elapsedSeconds)}
        </p>

        {/* Email notification notice */}
        {user?.email && (
          <div className="mb-6 flex items-center gap-2.5 rounded-xl bg-black/[0.03] px-4 py-3">
            <svg className="h-4 w-4 shrink-0 text-black/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75" />
            </svg>
            <p className="text-[13px] text-black/50">
              We'll email you at <span className="font-medium text-black/70">{user.email}</span> when it's ready
            </p>
          </div>
        )}

        {/* While you wait */}
        <div className="mb-8">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-black/40">While you wait</p>
          <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-100">
            {/* See how it works — opens modal */}
            <button
              onClick={() => setShowHowItWorks(true)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-black/80 transition-colors hover:text-black"
            >
              See how it works
              <svg className="h-4 w-4 shrink-0 text-black/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Build your own */}
            <a
              href="https://v0.app/templates/face-swap-template-1Nu0E0eAo9q"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-4 py-3 text-sm font-medium text-black/80 transition-colors hover:text-black"
            >
              Build your own FaceSwap app
              {/* v0 logo */}
              <svg className="h-3 w-auto shrink-0 text-black/30" viewBox="0 0 252 120" fill="currentColor">
                <path d="M96 86.0625V24H120V103.125C120 112.445 112.445 120 103.125 120C98.6751 120 94.2826 118.284 91.125 115.127L0 24H33.9375L96 86.0625Z" />
                <path d="M218.25 0C236.89 0 252 15.1104 252 33.75V96H228V41.0625L173.062 96H228V120H165.75C147.11 120 132 104.89 132 86.25V24H156V79.125L211.125 24H156V0H218.25Z" />
              </svg>
            </a>

            {/* Generate new video */}
            <button
              onClick={() => router.push("/pick")}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-black/80 transition-colors hover:text-black"
            >
              Generate new video
              <svg className="h-4 w-4 shrink-0 text-black/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </button>
          </div>
        </div>

        {/* How it works modal */}
        {showHowItWorks && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setShowHowItWorks(false)}
          >
            <div
              className="relative mx-4 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setShowHowItWorks(false)}
                className="absolute right-4 top-4 rounded-lg p-1 text-black/40 transition-colors hover:text-black"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <h2 className="mb-6 text-lg font-semibold text-black">How it works</h2>

              <div className="space-y-5">
                {chapters.map((chapter, i) => (
                  <div key={i} className="flex gap-3.5">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-xs font-semibold text-black/50">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="mb-1 text-sm font-medium text-black">{chapter.title}</p>
                      <p className="text-[13px] leading-relaxed text-black/50">{chapter.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* OSS template + feedback */}
              <div className="mt-6 border-t border-neutral-100 pt-5 space-y-3">
                <p className="text-[13px] leading-relaxed text-black/50">
                  This is an open-source template — you can{" "}
                  <a href="https://v0.app/templates/face-swap-template-1Nu0E0eAo9q" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-black">fork it on v0</a>
                  {" "}and prompt your way into your own app built on top of it.
                </p>
                <p className="text-[13px] leading-relaxed text-black/50">
                  Got feedback? Reach out to{" "}
                  <a href="https://x.com/estebansuarez" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-black">@estebansuarez</a>
                  {" "}on X.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Post-login auto-submit flow (existing) ---
function AutoSubmitContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const charId = searchParams.get("char") ? Number(searchParams.get("char")) : null
  const arParam = searchParams.get("ar")
  const selectedAR: "9:16" | "16:9" | "fill" = arParam === "9:16" ? "9:16" : arParam === "1:1" ? "fill" : "16:9"

  const { user, isLoading: authLoading } = useAuth()
  const { allCharacters, selectedCharacter, setSelectedCharacter, customCharacters, addCustomCharacter, isReady: charactersReady } = useCharacters({ user, authLoading })
  const {
    recordedVideo,
    uploadedVideoUrl,
    recordedAspectRatio,
    getVideoForUpload,
    waitForUpload,
    restoreFromSession,
  } = useVideo()

  const [sessionRestored, setSessionRestored] = useState(false)
  const [pendingAutoSubmit, setPendingAutoSubmit] = useState(false)

  // Restore video from sessionStorage (after login redirect)
  useEffect(() => {
    if (recordedVideo) {
      setSessionRestored(true)
      return
    }
    restoreFromSession().then(({ shouldAutoSubmit }) => {
      setSessionRestored(true)
      if (shouldAutoSubmit) {
        setPendingAutoSubmit(true)
      }
    })
  }, [recordedVideo, restoreFromSession])

  // Sync charId from URL
  useEffect(() => {
    if (charId && charId !== selectedCharacter) {
      setSelectedCharacter(charId)
    }
  }, [charId, selectedCharacter, setSelectedCharacter])

  // Redirect to /pick if no video (wait for session restore)
  useEffect(() => {
    if (!sessionRestored) return
    if (!recordedVideo && !pendingAutoSubmit) {
      router.replace("/pick")
    }
  }, [sessionRestored, recordedVideo, pendingAutoSubmit, router])

  const { processVideo } = useVideoGeneration({
    user,
    onLoginRequired: () => router.replace("/pick"),
    onSuccess: () => {},
    onError: () => router.replace("/pick"),
    onGenerationCreated: (id) => {
      router.replace(`/generate?id=${id}`)
    },
  })

  // Restore pending character after login
  const restoredPendingChar = useRef(false)
  useEffect(() => {
    if (restoredPendingChar.current || !user || !charactersReady) return
    const raw = sessionStorage.getItem("pendingCharacterData")
    if (!raw) return
    restoredPendingChar.current = true
    sessionStorage.removeItem("pendingCharacterData")
    try {
      const { src, name } = JSON.parse(raw)
      if (src) addCustomCharacter({ id: Date.now(), src, name: name || "Generated" })
    } catch {}
  }, [user, charactersReady, addCustomCharacter])

  // Auto-submit after login restore
  useEffect(() => {
    if (!pendingAutoSubmit || !user || !recordedVideo) return
    let char = charId ? allCharacters.find(c => c.id === charId) : null
    if (!char && customCharacters.length > 0) {
      char = customCharacters[customCharacters.length - 1]
      setSelectedCharacter(char.id)
    }
    if (!char) return
    setPendingAutoSubmit(false)
    // Use the aspect ratio from URL param, and pick the matching source image
    const arKey = arParam === "9:16" ? "9:16" : arParam === "1:1" ? "1:1" : "16:9"
    const charWithSource = {
      ...char,
      src: char.sources?.[arKey as keyof typeof char.sources] || char.src,
    }
    processVideo(getVideoForUpload, charWithSource, false, uploadedVideoUrl, selectedAR, recordedAspectRatio, waitForUpload)
  }, [pendingAutoSubmit, user, recordedVideo, charId, allCharacters, customCharacters, setSelectedCharacter, processVideo, uploadedVideoUrl, getVideoForUpload, recordedAspectRatio, waitForUpload])

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/20 border-t-black" />
    </div>
  )
}

// --- Router: pick mode based on URL params ---
function GenerateContent() {
  const searchParams = useSearchParams()
  const generationId = searchParams.get("id") ? Number(searchParams.get("id")) : null
  const charId = searchParams.get("char")

  if (generationId) {
    return <OngoingGenerationView generationId={generationId} />
  }

  if (charId) {
    return <AutoSubmitContent />
  }

  // No params — redirect handled by AutoSubmitContent
  return <AutoSubmitContent />
}

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-white" />}>
      <GenerateContent />
    </Suspense>
  )
}
