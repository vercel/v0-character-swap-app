"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import Image from "next/image"
import { CameraPreview } from "@/components/camera-preview"
import { CharacterGrid } from "@/components/character-grid"
import { CharacterSelection } from "@/components/character-selection"
import { SidebarStrip } from "@/components/sidebar-strip"
import { StepsIndicator } from "@/components/steps-indicator"
import { useAuth } from "@/components/auth-provider"
import { GenerationsPanel } from "@/components/generations-panel"
import { useCharacters } from "@/hooks/use-characters"
import { useVideoGeneration } from "@/hooks/use-video-generation"
import { useVideoRecording } from "@/hooks/use-video-recording"
import { useVideoDownload } from "@/hooks/use-video-download"
import { STORAGE_KEYS } from "@/lib/constants"
import { cn, detectImageAspectRatio } from "@/lib/utils"
import { useCloudinaryPrewarm } from "@/hooks/use-cloudinary-prewarm"
import { useCredits } from "@/hooks/use-credits"

// Convert a Vercel Blob video URL to MP4 via Cloudinary (for cross-browser playback)
function toMp4Url(url: string | null): string | null {
  if (!url) return null
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (!cloudName) return url
  // Only convert Vercel Blob URLs, skip blob: URLs and already-converted URLs
  if (!url.includes(".public.blob.vercel-storage.com")) return url
  return `https://res.cloudinary.com/${cloudName}/video/fetch/f_mp4,vc_h264,ac_aac/${encodeURIComponent(url)}`
}

// Helper to get character aspect ratio for generated video
async function getCharacterAspectRatio(src: string): Promise<"9:16" | "16:9" | "fill"> {
  const ratio = await detectImageAspectRatio(src)
  if (ratio === "9:16" || ratio === "3:4") return "9:16"
  if (ratio === "16:9" || ratio === "4:3") return "16:9"
  return "fill"
}

export default function Home() {
  const { user, isLoading: authLoading, login, logout, hasApiKey } = useAuth()
  
  // State
  const [mounted, setMounted] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [isPlaying, setIsPlaying] = useState(true)
  const [videoProgress, setVideoProgress] = useState(0)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [sourceVideoUrl, setSourceVideoUrl] = useState<string | null>(null)
  // Aspect ratio of the source/PiP video (from DB when viewing generation, or from recording)
  const [sourceVideoAspectRatio, setSourceVideoAspectRatio] = useState<"9:16" | "16:9" | "fill">("fill")
  const [selectedGeneratedVideo, setSelectedGeneratedVideo] = useState<string | null>(null)
  const [selectedError, setSelectedError] = useState<{ message: string; characterName: string | null; characterImageUrl: string | null; createdAt: string } | null>(null)
  const [confirmedCharacter, setConfirmedCharacter] = useState(false)
  const [pendingAutoSubmit, setPendingAutoSubmit] = useState(false)
  // Detected aspect ratio of the generated video (from character image)
  const [generatedVideoAspectRatio, setGeneratedVideoAspectRatio] = useState<"9:16" | "16:9" | "fill">("fill")
  const [showPip, setShowPip] = useState(true)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showUploadingWarning, setShowUploadingWarning] = useState(false)
  const [sendEmailNotification, setSendEmailNotification] = useState(false)
  const [showBuyOptions, setShowBuyOptions] = useState(false)
  const [buyAmount, setBuyAmount] = useState("")
  const [purchasing, setPurchasing] = useState(false)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const [expandedCharacter, setExpandedCharacter] = useState<{
    imageUrl: string
    id: number
    isCustom: boolean
  } | null>(null)
  const [videoShared, setVideoShared] = useState(false)

  // Video refs for sync
  const mainVideoRef = useRef<HTMLVideoElement>(null)
  const pipVideoRef = useRef<HTMLVideoElement>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)

  // Custom hooks
  const {
    customCharacters,
    selectedCharacter,
    setSelectedCharacter,
    addCustomCharacter,
    deleteCustomCharacter,
    allCharacters,
    trackCharacterUsage,
    isReady: charactersReady,
  } = useCharacters({ user, authLoading })

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
    restoreFromSession,
    saveToSession,
    getVideoForUpload,
    waitForUpload,
  } = useVideoRecording()

  // Video download hook
  const pipAspectRatio = sourceVideoUrl ? sourceVideoAspectRatio : recordedAspectRatio
  const selectedCharacterName = allCharacters.find(c => c.id === selectedCharacter)?.name || null
  const { isDownloading, downloadProgress, handleDownload } = useVideoDownload({
    resultUrl,
    pipVideoUrl: sourceVideoUrl || recordedVideoUrl,
    showPip,
    pipAspectRatio,
    characterName: selectedCharacterName,
  })

  // Pre-warm Cloudinary URL when viewing a result (triggers server-side processing before download)
  useCloudinaryPrewarm({
    resultUrl,
    pipVideoUrl: sourceVideoUrl || recordedVideoUrl,
    showPip,
  })

  const [errorToast, setErrorToast] = useState<string | null>(null)

  // Credits / wallet
  const { balance, creditsLoading, error: creditsError, refresh: refreshCredits } = useCredits()

  const handleBuyCredits = useCallback(async (amount: number) => {
    if (!amount || amount <= 0) return
    setPurchasing(true)
    setPurchaseError(null)
    try {
      const res = await fetch("/api/credits/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPurchaseError(data.error || `Purchase failed (${res.status})`)
        return
      }
      if (data.checkoutSessionUrl) {
        window.location.href = data.checkoutSessionUrl
        return
      }
      // Success without redirect — refresh balance and collapse
      refreshCredits()
      setShowBuyOptions(false)
      setBuyAmount("")
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setPurchasing(false)
    }
  }, [refreshCredits])
  
  const {
    processVideo,
  } = useVideoGeneration({
    user,
    onLoginRequired: () => setShowLoginModal(true),
    onSuccess: () => {
      // Don't clear recording - allow user to generate with another character
      setSelectedCharacter(null)
      setConfirmedCharacter(false)
      setResultUrl(null)
    },
    onError: (message) => {
      setErrorToast(message)
      setTimeout(() => setErrorToast(null), 5000)
    },
  })

  // Initialize and restore session state
  useEffect(() => {
    setMounted(true)

    const savedCharacter = sessionStorage.getItem(STORAGE_KEYS.PENDING_CHARACTER)
    if (savedCharacter) {
      setSelectedCharacter(Number(savedCharacter))
      sessionStorage.removeItem(STORAGE_KEYS.PENDING_CHARACTER)
    }

    restoreFromSession().then(({ shouldAutoSubmit }) => {
      if (shouldAutoSubmit) {
        setPendingAutoSubmit(true)
      }
    })
  }, [restoreFromSession, setSelectedCharacter])

  // After login, restore pending character that was generated without auth
  const restoredPendingChar = useRef(false)
  useEffect(() => {
    if (restoredPendingChar.current || !user || !charactersReady) return
    const raw = sessionStorage.getItem("pendingCharacterData")
    if (!raw) return
    restoredPendingChar.current = true
    sessionStorage.removeItem("pendingCharacterData")
    try {
      const { src, name } = JSON.parse(raw)
      if (src) {
        addCustomCharacter({ id: Date.now(), src, name: name || "Generated" })
      }
    } catch {}
  }, [user, charactersReady, addCustomCharacter])

  // Auto-submit generation after login
  useEffect(() => {
    if (pendingAutoSubmit && user && recordedVideo) {
      // Find the selected character, or fall back to the most recently added custom character
      // (the pending character was re-created with a new ID after login)
      let character = selectedCharacter ? allCharacters.find(c => c.id === selectedCharacter) : null
      if (!character && customCharacters.length > 0) {
        character = customCharacters[customCharacters.length - 1]
        setSelectedCharacter(character.id)
      }
      if (!character) return // Wait for characters to load
      setPendingAutoSubmit(false)
      // Use character image aspect ratio, not recorded video aspect ratio
      getCharacterAspectRatio(character.src).then(characterAspectRatio => {
        setTimeout(() => {
          processVideo(getVideoForUpload, character, sendEmailNotification, uploadedVideoUrl, characterAspectRatio, recordedAspectRatio, waitForUpload)
        }, 100)
      })
    }
  }, [pendingAutoSubmit, user, recordedVideo, selectedCharacter, allCharacters, customCharacters, setSelectedCharacter, processVideo, uploadedVideoUrl, getVideoForUpload, recordedAspectRatio, sendEmailNotification])

  // Simulate upload progress over ~20 seconds
  useEffect(() => {
    if (isUploading) {
      setUploadProgress(0)
      const duration = 20000 // 20 seconds
      const interval = 200 // Update every 200ms
      const increment = 100 / (duration / interval)
      
      const timer = setInterval(() => {
        setUploadProgress(prev => {
          const next = prev + increment
          // Cap at 95% - the final 5% happens when upload actually completes
          return next >= 95 ? 95 : next
        })
      }, interval)
      
      return () => clearInterval(timer)
    } else {
      // When upload completes, briefly show 100% then reset
      if (uploadProgress > 0) {
        setUploadProgress(100)
        setTimeout(() => setUploadProgress(0), 300)
      }
    }
  }, [isUploading])

  // Warn before closing tab while video is uploading
  useEffect(() => {
    if (!isUploading) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = "Your video is still uploading — hang tight!"
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isUploading])

  // Handlers
  const handleProcess = useCallback(async () => {
    if (!recordedVideo || !selectedCharacter) return
    const character = allCharacters.find(c => c.id === selectedCharacter)
    if (character) {
      // Pause/mute the preview video so it doesn't play in the background
      if (previewVideoRef.current) {
        previewVideoRef.current.pause()
        previewVideoRef.current.muted = true
      }
      // Track character usage for popularity
      trackCharacterUsage(character.id)
      // Use character image aspect ratio for generated video, but also pass recorded video aspect ratio
      const characterAspectRatio = await getCharacterAspectRatio(character.src)
      // Pass a function that will get the video when needed (allows immediate UI feedback)
      processVideo(getVideoForUpload, character, sendEmailNotification, uploadedVideoUrl, characterAspectRatio, recordedAspectRatio, waitForUpload)
    }
  }, [recordedVideo, selectedCharacter, allCharacters, processVideo, uploadedVideoUrl, recordedAspectRatio, getVideoForUpload, trackCharacterUsage, sendEmailNotification])

  const handleReset = useCallback(() => {
    clearRecording()
    setResultUrl(null)
    setSourceVideoUrl(null)
    setSelectedCharacter(null)
    setConfirmedCharacter(false)
    setSelectedGeneratedVideo(null)
    setGeneratedVideoAspectRatio("fill")
    setSelectedError(null)
    setVideoShared(false)
  }, [clearRecording, setSelectedCharacter])

  // Handle Escape key — use refs for stable listener (no re-registration)
  const selectedErrorRef = useRef(selectedError)
  const resultUrlRef = useRef(resultUrl)
  const recordedVideoUrlRef = useRef(recordedVideoUrl)
  const isUploadingRef = useRef(isUploading)
  const handleResetRef = useRef(handleReset)
  const showBuyOptionsRef = useRef(showBuyOptions)
  selectedErrorRef.current = selectedError
  resultUrlRef.current = resultUrl
  recordedVideoUrlRef.current = recordedVideoUrl
  isUploadingRef.current = isUploading
  handleResetRef.current = handleReset
  showBuyOptionsRef.current = showBuyOptions

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showBuyOptionsRef.current) {
          e.preventDefault()
          setShowBuyOptions(false)
          setBuyAmount("")
          setPurchaseError(null)
          return
        }
        if (selectedErrorRef.current) {
          e.preventDefault()
          setSelectedError(null)
        } else if (isUploadingRef.current) {
          e.preventDefault()
          setShowUploadingWarning(true)
          setTimeout(() => setShowUploadingWarning(false), 2000)
        } else if (resultUrlRef.current || recordedVideoUrlRef.current) {
          e.preventDefault()
          handleResetRef.current()
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Close user menu on click outside
  const handleLoginAndContinue = useCallback(async () => {
    setIsLoggingIn(true)
    // Save the selected character's full data so we can restore it after login
    // (AI-generated characters aren't in DB yet if user wasn't authenticated)
    if (selectedCharacter) {
      const char = allCharacters.find(c => c.id === selectedCharacter)
      if (char) {
        sessionStorage.setItem("pendingCharacterData", JSON.stringify({ src: char.src, name: char.name }))
      }
    }
    if (recordedVideo) {
      await saveToSession(recordedVideo, selectedCharacter)
    }
    login()
  }, [recordedVideo, selectedCharacter, allCharacters, saveToSession, login])

  // Step state machine: character first (1), then record (2), then generate (3)
  // Step 1 stays until user clicks "Next" (confirmedCharacter)
  const currentStep: 1 | 2 | 3 = resultUrl
    ? 3
    : (recordedVideo && selectedCharacter)
      ? 3
      : (selectedCharacter && confirmedCharacter)
        ? 2
        : 1

  // Sync step to URL hash for browser back/forward navigation
  const stepNames = { 1: "", 2: "record", 3: "generate" } as const
  const prevStepRef = useRef(currentStep)

  useEffect(() => {
    // Push hash when step changes forward (not on initial mount)
    if (currentStep !== prevStepRef.current) {
      const target = currentStep === 1 ? window.location.pathname : `#${stepNames[currentStep]}`
      const currentHash = window.location.hash.replace("#", "")
      const targetHash = currentStep === 1 ? "" : stepNames[currentStep]
      if (currentHash !== targetHash) {
        window.history.pushState(null, "", target)
      }
      prevStepRef.current = currentStep
    }
  }, [currentStep])

  useEffect(() => {
    // Set initial hash on mount
    if (!window.location.hash && currentStep > 1) {
      window.history.replaceState(null, "", `#${stepNames[currentStep]}`)
    }

    const handlePopState = () => {
      const hash = window.location.hash.replace("#", "")
      if ((!hash || hash === "/") && currentStep > 1) {
        // Go back to step 1
        setSelectedCharacter(null)
        setConfirmedCharacter(false)
        setShowPreview(false)
      } else if (hash === "record" && currentStep > 2) {
        // Go back to step 2
        setShowPreview(false)
        clearRecording()
      }
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [currentStep, setSelectedCharacter, clearRecording, setShowPreview])

  // Render helpers
  const parsedBuyAmount = Number.parseFloat(buyAmount)
  const isValidBuyAmount = buyAmount !== "" && Number.isFinite(parsedBuyAmount) && parsedBuyAmount > 0




  return (
    <main className="relative flex h-[100dvh] flex-row overflow-hidden bg-white">
      {/* Main Preview Area — fullscreen step content */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-hidden">
        {selectedError ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-5 px-8">
            {selectedError.characterImageUrl && (
              <div className="h-20 w-20 overflow-hidden rounded-xl bg-neutral-100 ring-1 ring-neutral-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedError.characterImageUrl} alt="" className="h-full w-full object-cover object-top" />
              </div>
            )}
            <div className="max-w-xs text-center">
              <p className="mb-3 text-xl font-pixel text-black">
                Generation Failed
              </p>
              <p className="text-sm leading-relaxed text-black/50">
                {selectedError.message}
              </p>
            </div>
            <button
              onClick={() => setSelectedError(null)}
              className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
            >
              try again
            </button>
          </div>
        ) : resultUrl ? (
          <div className="relative h-full w-full bg-black">
            <video
              ref={mainVideoRef}
              src={resultUrl}
              muted
              loop
              playsInline
              preload="auto"
              poster={allCharacters.find(c => c.id === selectedCharacter)?.src || undefined}
              className="h-full w-full cursor-pointer object-contain md:object-cover"
              onClick={(e) => {
                const v = e.currentTarget
                if (v.paused) v.play(); else v.pause()
              }}
              onLoadedData={(e) => {
                e.currentTarget.muted = false
                const hasPip = !!(sourceVideoUrl || recordedVideoUrl) && showPip
                if (!hasPip) {
                  e.currentTarget.play()
                  return
                }
                const pip = pipVideoRef.current
                if (pip && pip.readyState >= 2) {
                  pip.currentTime = 0
                  e.currentTarget.currentTime = 0
                  e.currentTarget.play()
                  pip.play()
                }
              }}
              onPlay={() => {
                setIsPlaying(true)
                const pip = pipVideoRef.current
                if (pip) {
                  pip.currentTime = mainVideoRef.current?.currentTime || 0
                  pip.play()
                }
              }}
              onPause={() => {
                setIsPlaying(false)
                pipVideoRef.current?.pause()
              }}
              onSeeked={() => {
                if (pipVideoRef.current && mainVideoRef.current) {
                  pipVideoRef.current.currentTime = mainVideoRef.current.currentTime
                }
              }}
              onTimeUpdate={(e) => {
                const v = e.currentTarget
                if (v.duration) setVideoProgress(v.currentTime / v.duration)
                const pip = pipVideoRef.current
                if (pip && v) {
                  const diff = Math.abs(pip.currentTime - v.currentTime)
                  if (diff > 0.15) {
                    pip.currentTime = v.currentTime
                  }
                }
              }}
            />
            {/* PiP video overlay */}
            {(sourceVideoUrl || recordedVideoUrl) && showPip && (
              <div className={cn(
                "absolute bottom-20 right-4 overflow-hidden rounded-lg border-2 border-black/20 shadow-lg",
                pipAspectRatio === "9:16" && "aspect-[9/16] h-28 md:h-40",
                pipAspectRatio !== "9:16" && "aspect-video w-28 md:w-48"
              )}>
                <video
                  ref={pipVideoRef}
                  src={toMp4Url(sourceVideoUrl) || recordedVideoUrl || ""}
                  muted
                  loop
                  playsInline
                  preload="auto"
                  className="h-full w-full object-cover"
                  onLoadedData={() => {
                    const main = mainVideoRef.current
                    const pip = pipVideoRef.current
                    if (main && pip && main.readyState >= 2) {
                      pip.currentTime = 0
                      main.currentTime = 0
                      main.muted = false
                      main.play()
                      pip.play()
                    }
                  }}
                />
              </div>
            )}
            {/* Overlaid controls at bottom */}
            <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-4 pb-4 pt-10">
              {/* Progress bar */}
              <div
                className="h-1 w-full cursor-pointer rounded-full bg-white/20"
                onClick={(e) => {
                  if (!mainVideoRef.current) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const pct = (e.clientX - rect.left) / rect.width
                  mainVideoRef.current.currentTime = pct * mainVideoRef.current.duration
                }}
              >
                <div
                  className="h-full rounded-full bg-white"
                  style={{ width: `${videoProgress * 100}%` }}
                />
              </div>
              {/* Buttons */}
              <div className="flex items-center justify-center gap-2.5">
                <button
                  disabled={isDownloading}
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-1.5 text-[13px] font-medium text-white backdrop-blur-sm transition-all hover:bg-white/25 active:scale-95 disabled:opacity-70"
                >
                  {isDownloading ? (
                    <>
                      <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {Math.round(downloadProgress * 100)}%
                    </>
                  ) : (
                    <>
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      download
                    </>
                  )}
                </button>
                <button
                  onClick={handleReset}
                  className="rounded-full bg-white/15 px-4 py-1.5 text-[13px] font-medium text-white backdrop-blur-sm transition-all hover:bg-white/25 active:scale-95"
                >
                  new video
                </button>
                {resultUrl && (
                  <button
                    disabled={videoShared}
                    onClick={async () => {
                      const char = allCharacters.find(c => c.id === selectedCharacter)
                      await fetch("/api/submit-video", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          videoUrl: resultUrl,
                          characterImageUrl: char?.src || null,
                          characterName: char?.name || null,
                        }),
                      })
                      setVideoShared(true)
                    }}
                    title={videoShared ? "Submitted for community review" : "Submit this video to the community gallery for others to see"}
                    className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-medium text-white backdrop-blur-sm transition-all hover:bg-white/25 active:scale-95 disabled:opacity-50"
                  >
                    {videoShared ? (
                      <>
                        <svg className="h-3 w-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        shared!
                      </>
                    ) : (
                      <>
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                        share to community
                      </>
                    )}
                  </button>
                )}
                {(sourceVideoUrl || recordedVideoUrl) && (
                  <button
                    onClick={() => setShowPip(!showPip)}
                    className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-medium text-white backdrop-blur-sm transition-all hover:bg-white/25 active:scale-95"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <rect x="12" y="10" width="8" height="5" rx="1" />
                    </svg>
                    {showPip ? "pip" : "pip"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (recordedVideoUrl && showPreview) ? (
          <div className="relative flex h-full w-full items-center justify-center bg-black">
            {/* Back to character selection */}
            <button
              onClick={() => { setSelectedCharacter(null); setConfirmedCharacter(false); setShowPreview(false) }}
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
                  // Skip slightly past first frame to avoid low-quality keyframe in Chrome
                  if (video.currentTime === 0) {
                    video.currentTime = 0.1
                  }
                  // Unmute after autoplay starts
                  video.muted = false
                }}
                onEnded={(e) => {
                  // Manual loop: MediaRecorder blobs have mismatched audio/video durations
                  // which causes audio to desync or repeat when using the loop attribute
                  const video = e.currentTarget
                  video.currentTime = 0
                  video.play()
                }}
              />
              {/* Bottom action bar */}
              <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-6 pb-[max(4rem,calc(env(safe-area-inset-bottom,1rem)+3rem))] pt-12 md:pb-8">
                {selectedCharacter ? (
                  /* Has character — show Generate / Retake */
                  <>
                    {(() => {
                      const char = allCharacters.find(c => c.id === selectedCharacter)
                      return char ? (
                        <div className="flex items-center gap-2.5">
                          <div className="h-10 w-10 overflow-hidden rounded-lg ring-2 ring-white/30">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={char.src} alt={char.name} className="h-full w-full object-cover object-top" />
                          </div>
                          <span className="text-sm text-white/70">{char.name}</span>
                        </div>
                      ) : null
                    })()}
                    <div className="flex flex-col items-center gap-2.5">
                      <button
                        onClick={handleProcess}
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
                      {!isUploading && (
                        <button
                          onClick={() => { setShowPreview(false); clearRecording() }}
                          className="flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-5 text-sm font-medium text-white/70 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white active:scale-95"
                        >
                          Retake video
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  /* No character — just generated, offer next actions */
                  <>
                    <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm">
                      <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm font-medium text-white">Generating your video...</span>
                    </div>
                    <p className="text-center text-xs text-white/40">
                      Generating with <span className="text-white/60">Kling Motion Control</span> via{" "}
                      <a
                        href="https://vercel.com/ai-gateway"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/60 underline underline-offset-2 hover:text-white/80"
                      >
                        AI Gateway
                      </a>
                    </p>
                    <button
                      onClick={handleReset}
                      className="flex h-12 items-center gap-2.5 rounded-full bg-white px-7 text-[15px] font-bold text-black shadow-lg transition-all hover:bg-neutral-100 active:scale-95"
                    >
                      Generate a new video
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : currentStep === 1 ? (
          /* Step 1: Choose character — fullscreen in preview area */
          <CharacterSelection
            selectedId={selectedCharacter}
            onSelect={setSelectedCharacter}
            onNext={() => setConfirmedCharacter(true)}
            customCharacters={charactersReady ? customCharacters : []}
            onAddCustom={addCustomCharacter}
            onDeleteCustom={deleteCustomCharacter}
            onExpand={(imageUrl, id, isCustom) => setExpandedCharacter({ imageUrl, id, isCustom })}
          />
        ) : currentStep === 2 ? (
          /* Step 2: Record — camera with back button */
          <CameraPreview
            onVideoRecorded={handleVideoRecorded}
            isProcessing={false}
            onBack={() => { setSelectedCharacter(null); setConfirmedCharacter(false) }}
          />
        ) : (
          /* Step 3 without result yet — shouldn't normally reach here */
          <CameraPreview
            onVideoRecorded={handleVideoRecorded}
            isProcessing={false}
            onBack={() => { setSelectedCharacter(null); setConfirmedCharacter(false) }}
          />
        )}
      </div>

      {/* Sidebar Strip — vertical on desktop, horizontal bottom bar on mobile */}
      <SidebarStrip
        onSelectVideo={(url, sourceUrl, sourceAR, genAR) => {
          setSelectedError(null)
          setSelectedGeneratedVideo(url)
          setResultUrl(url)
          setSourceVideoUrl(sourceUrl)
          setSourceVideoAspectRatio(sourceAR)
          setGeneratedVideoAspectRatio(genAR)
        }}
        onSelectError={(error) => {
          setResultUrl(null)
          setSelectedError(error)
        }}
        onBuyCredits={() => { setShowBuyOptions(true); setPurchaseError(null); setBuyAmount("") }}
      />


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
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
                className="rounded-xl px-4 py-3 text-sm text-black/50 transition-colors hover:text-black disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Buy Credits Modal */}
      {showBuyOptions && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => { setShowBuyOptions(false); setBuyAmount(""); setPurchaseError(null) }}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-semibold text-black">Buy Credits</h2>
            <p className="mb-4 text-sm text-black/50">
              {!creditsLoading && !creditsError && (
                <>Current balance: <span className="tabular-nums font-medium text-black">${Number.parseFloat(balance).toFixed(2)}</span></>
              )}
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 25, 50].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setBuyAmount(String(amount))}
                    disabled={purchasing}
                    className={`rounded-xl border py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      buyAmount === String(amount)
                        ? "border-black bg-black text-white"
                        : "border-neutral-200 text-black hover:border-neutral-400 hover:text-black"
                    }`}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-black/40">$</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    placeholder="Custom amount"
                    value={buyAmount}
                    onChange={(e) => { setBuyAmount(e.target.value); setPurchaseError(null) }}
                    disabled={purchasing}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 pl-7 pr-3 text-sm tabular-nums text-black placeholder:text-black/40 focus:border-neutral-400 focus:outline-none disabled:opacity-40"
                  />
                </div>
              </div>
              {purchaseError && (
                <p className="text-xs text-red-500">{purchaseError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setShowBuyOptions(false); setBuyAmount(""); setPurchaseError(null) }}
                  disabled={purchasing}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm text-black/50 transition-colors hover:text-black disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleBuyCredits(parsedBuyAmount)}
                  disabled={!isValidBuyAmount || purchasing}
                  className="flex-1 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {purchasing ? "Processing..." : "Purchase"}
                </button>
              </div>
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

      {/* Expanded Character Image Overlay */}
      {expandedCharacter && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setExpandedCharacter(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setExpandedCharacter(null)
          }}
          tabIndex={0}
          ref={(el) => el?.focus()}
        >
          {/* Top-right actions */}
          <div className="absolute right-4 top-4 flex items-center gap-2">
            <button
              onClick={async (e) => {
                e.stopPropagation()
                try {
                  const res = await fetch(expandedCharacter.imageUrl)
                  const blob = await res.blob()
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url
                  const char = allCharacters.find(c => c.id === expandedCharacter.id)
                  a.download = `${char?.name || "character"}.png`
                  a.click()
                  URL.revokeObjectURL(url)
                } catch {
                  window.open(expandedCharacter.imageUrl, "_blank")
                }
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              title="Download image"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            <button
              onClick={() => setExpandedCharacter(null)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <img
            src={expandedCharacter.imageUrl}
            alt="Character preview"
            className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </main>
  )
}
