"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useRef, useEffect, useState, useCallback, Suspense } from "react"
import Image from "next/image"
import { CameraPreview } from "@/components/camera-preview"
import { useVideo } from "@/providers/video-context"
import { useCharacters } from "@/hooks/use-characters"
import { useVideoGeneration } from "@/hooks/use-video-generation"
import { useAuth } from "@/components/auth-provider"
import { characterImageForAspectRatio, type AspectRatio } from "@/lib/utils"

function RecordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const charId = searchParams.get("char") ? Number(searchParams.get("char")) : null
  const arParam = searchParams.get("ar")
  const selectedAspectRatio: AspectRatio = (arParam === "9:16" || arParam === "1:1" || arParam === "16:9") ? arParam : "16:9"

  const { user, isLoading: authLoading, login } = useAuth()
  const { allCharacters, trackCharacterUsage } = useCharacters({ user, authLoading })
  const {
    recordedVideo,
    recordedVideoUrl,
    uploadedVideoUrl,
    recordedAspectRatio,
    isUploading,
    showPreview,
    setShowPreview,
    handleVideoRecorded,
    clearRecording,
    getVideoForUpload,
    waitForUpload,
    saveToSession,
  } = useVideo()

  const [showLoginModal, setShowLoginModal] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [errorToast, setErrorToast] = useState<string | null>(null)

  const { processVideo } = useVideoGeneration({
    user,
    onLoginRequired: () => setShowLoginModal(true),
    onSuccess: () => {
      // onGenerationCreated handles navigation now
    },
    onError: (message) => {
      setErrorToast(message)
      setTimeout(() => setErrorToast(null), 5000)
    },
    onGenerationCreated: (_id, uuid) => {
      router.push(`/${uuid}`)
    },
  })

  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  const character = charId ? allCharacters.find(c => c.id === charId) : null

  // Build a character with the Cloudinary-cropped image for the selected aspect ratio
  const croppedCharacter = character ? {
    ...character,
    src: characterImageForAspectRatio(character.src, selectedAspectRatio, character.sources),
  } : null

  const handleGenerate = useCallback(async () => {
    if (!recordedVideo || !croppedCharacter) return
    // Request notification permission on user gesture (required by Safari)
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission()
    }
    // Map aspect ratio to the format processVideo expects
    const klingAspectRatio = selectedAspectRatio === "1:1" ? "fill" as const : selectedAspectRatio
    // If not logged in, processVideo will show login modal — don't navigate
    if (!user) {
      processVideo(getVideoForUpload, croppedCharacter, true, uploadedVideoUrl, klingAspectRatio, recordedAspectRatio, waitForUpload)
      return
    }
    if (previewVideoRef.current) {
      previewVideoRef.current.pause()
      previewVideoRef.current.muted = true
    }
    trackCharacterUsage(croppedCharacter.id)
    processVideo(getVideoForUpload, croppedCharacter, true, uploadedVideoUrl, klingAspectRatio, recordedAspectRatio, waitForUpload)
  }, [user, recordedVideo, croppedCharacter, selectedAspectRatio, trackCharacterUsage, processVideo, getVideoForUpload, uploadedVideoUrl, recordedAspectRatio, waitForUpload])

  const handleLoginAndContinue = useCallback(async () => {
    setIsLoggingIn(true)
    if (charId) {
      const char = allCharacters.find(c => c.id === charId)
      if (char) {
        sessionStorage.setItem("pendingCharacterData", JSON.stringify({ src: char.src, name: char.name }))
      }
    }
    if (recordedVideo) {
      await saveToSession(recordedVideo, charId)
    }
    sessionStorage.setItem("loginReturnUrl", `/generate?char=${charId}&ar=${encodeURIComponent(selectedAspectRatio)}`)
    login()
  }, [recordedVideo, charId, allCharacters, saveToSession, login])

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
                onClick={handleGenerate}
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

        {/* Login Modal */}
        {showLoginModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
              <h2 className="mb-2 text-lg font-semibold text-black">Sign in to generate</h2>
              <p className="mb-6 text-sm text-black/70">
                Create an account to generate your video. Your recording and character selection will be saved.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleLoginAndContinue}
                  disabled={isLoggingIn}
                  className="flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 active:scale-[0.98] disabled:opacity-70"
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
                  className="rounded-xl px-4 py-3 text-sm text-black/70 transition-colors hover:text-black disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Toast */}
        {errorToast && (
          <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-lg bg-red-900 px-4 py-2 shadow-lg">
            <p className="text-sm font-medium text-white">{errorToast}</p>
          </div>
        )}
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
