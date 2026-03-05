"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useRef, useEffect, useState, Suspense } from "react"
import Image from "next/image"
import { CameraPreview } from "@/components/camera-preview"
import { useVideo } from "@/providers/video-context"
import { useCharacters } from "@/hooks/use-characters"
import { useAuth } from "@/components/auth-provider"

function RecordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const charId = searchParams.get("char") ? Number(searchParams.get("char")) : null

  const { user, isLoading: authLoading } = useAuth()
  const { allCharacters } = useCharacters({ user, authLoading })
  const {
    recordedVideo,
    recordedVideoUrl,
    isUploading,
    showPreview,
    setShowPreview,
    handleVideoRecorded,
    clearRecording,
  } = useVideo()

  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  const character = charId ? allCharacters.find(c => c.id === charId) : null

  // Redirect to /pick if no character selected
  useEffect(() => {
    if (!charId) {
      router.replace("/pick")
    }
  }, [charId, router])

  // Simulate upload progress
  useEffect(() => {
    if (isUploading) {
      setUploadProgress(0)
      const duration = 20000
      const interval = 200
      const increment = 100 / (duration / interval)
      const timer = setInterval(() => {
        setUploadProgress(prev => {
          const next = prev + increment
          return next >= 95 ? 95 : next
        })
      }, interval)
      return () => clearInterval(timer)
    } else {
      if (uploadProgress > 0) {
        setUploadProgress(100)
        setTimeout(() => setUploadProgress(0), 300)
      }
    }
  }, [isUploading])

  // Warn before closing tab while uploading
  useEffect(() => {
    if (!isUploading) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = "Your video is still uploading — hang tight!"
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isUploading])

  if (!charId) return null

  // After recording, show preview with actions
  if (recordedVideoUrl && showPreview) {
    return (
      <div className="relative flex h-full w-full items-center justify-center bg-black">
        {/* Back to character selection */}
        <button
          onClick={() => {
            clearRecording()
            router.push("/pick")
          }}
          className="absolute left-4 top-4 z-30 flex items-center gap-1.5 rounded-full bg-black/50 px-3.5 py-2 backdrop-blur-sm transition-colors hover:bg-black/70 active:bg-black/80"
        >
          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium text-white">Change cartoon</span>
        </button>

        <div className="relative h-full w-full overflow-hidden">
          <video
            ref={previewVideoRef}
            src={recordedVideoUrl}
            controls={false}
            autoPlay
            muted
            playsInline
            preload="auto"
            className="h-full w-full object-cover"
            onLoadedData={(e) => {
              const video = e.currentTarget
              if (video.currentTime === 0) video.currentTime = 0.1
              video.muted = false
            }}
            onEnded={(e) => {
              const video = e.currentTarget
              video.currentTime = 0
              video.play()
            }}
          />

          {/* Bottom action bar */}
          <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-6 pb-24 pt-12 md:pb-8">
            {character && (
              <div className="flex items-center gap-2.5">
                <div className="relative h-10 w-10 overflow-hidden rounded-lg ring-2 ring-white/30">
                  <Image src={character.src} alt={character.name} fill className="object-cover object-top" sizes="40px" />
                </div>
                <span className="text-sm text-white/70">{character.name}</span>
              </div>
            )}
            <div className="flex flex-col items-center gap-2.5">
              {!isUploading && (
                <button
                  onClick={() => { setShowPreview(false); clearRecording() }}
                  className="flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-5 text-sm font-medium text-white/70 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white active:scale-95"
                >
                  Retake video
                </button>
              )}
              <button
                onClick={() => {
                  if (previewVideoRef.current) {
                    previewVideoRef.current.pause()
                    previewVideoRef.current.muted = true
                  }
                  router.push(`/generate?char=${charId}`)
                }}
                disabled={!recordedVideo || isUploading}
                className="flex h-12 items-center gap-2.5 rounded-full bg-white px-7 text-[15px] font-bold text-black shadow-lg transition-all hover:bg-neutral-100 active:scale-95 disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                    Uploading video...
                  </>
                ) : (
                  "Generate cartoon video"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Camera recording view
  return (
    <CameraPreview
      onVideoRecorded={handleVideoRecorded}
      isProcessing={false}
      onBack={() => router.push("/pick")}
    />
  )
}

export default function RecordPage() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-white" />}>
      <RecordContent />
    </Suspense>
  )
}
