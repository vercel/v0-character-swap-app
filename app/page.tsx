"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import Image from "next/image"
import { CameraPreview } from "@/components/camera-preview"
import { CharacterGrid } from "@/components/character-grid"
import { useAuth } from "@/components/auth-provider"
import { BottomSheet } from "@/components/bottom-sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import { GenerationsPanel } from "@/components/generations-panel"
import { useCharacters } from "@/hooks/use-characters"
import { useVideoGeneration } from "@/hooks/use-video-generation"
import { useVideoRecording } from "@/hooks/use-video-recording"
import { useVideoDownload } from "@/hooks/use-video-download"
import { STORAGE_KEYS } from "@/lib/constants"
import { cn, detectImageAspectRatio } from "@/lib/utils"
import { useCloudinaryPrewarm } from "@/hooks/use-cloudinary-prewarm"
import { useCredits } from "@/hooks/use-credits"
import { Coins } from "lucide-react"

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
  const isMobile = useIsMobile()
  
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
  const [bottomSheetExpanded, setBottomSheetExpanded] = useState(false)
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

  // Auto-expand bottom sheet when video is recorded
  useEffect(() => {
    if (isMobile && recordedVideo && !resultUrl) {
      setBottomSheetExpanded(true)
    }
  }, [isMobile, recordedVideo, resultUrl])

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
    setSelectedGeneratedVideo(null)
    setGeneratedVideoAspectRatio("fill")
    setSelectedError(null)
  }, [clearRecording, setSelectedCharacter])

  // Handle Escape key — use refs for stable listener (no re-registration)
  const selectedErrorRef = useRef(selectedError)
  const resultUrlRef = useRef(resultUrl)
  const recordedVideoUrlRef = useRef(recordedVideoUrl)
  const isUploadingRef = useRef(isUploading)
  const handleResetRef = useRef(handleReset)
  selectedErrorRef.current = selectedError
  resultUrlRef.current = resultUrl
  recordedVideoUrlRef.current = recordedVideoUrl
  isUploadingRef.current = isUploading
  handleResetRef.current = handleReset

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
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

  // Render helpers
  const parsedBuyAmount = Number.parseFloat(buyAmount)
  const isValidBuyAmount = buyAmount !== "" && Number.isFinite(parsedBuyAmount) && parsedBuyAmount > 0

  const renderAuthSection = (size: "desktop" | "mobile") => {
    // Invisible placeholder while auth resolves — same height, no flash
    if (!mounted || authLoading) {
      return <div className="mb-4 h-[17px]" />
    }

    if (user) {
      return (
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-neutral-500">{user.name?.toLowerCase()}</span>
            <button
              onClick={logout}
              className="font-mono text-[11px] text-neutral-600 transition-colors hover:text-white"
            >
              sign out
            </button>
          </div>
          {/* Credits row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Coins className="h-3 w-3 text-yellow-500" />
              {creditsLoading ? (
                <span className="font-mono text-[11px] text-neutral-600">loading...</span>
              ) : creditsError ? (
                <span className="font-mono text-[11px] text-neutral-600">unavailable</span>
              ) : (
                <span className="font-mono text-[11px] tabular-nums text-neutral-400">
                  ${Number.parseFloat(balance).toFixed(2)}
                </span>
              )}
            </div>
            <button
              onClick={() => { setShowBuyOptions(!showBuyOptions); setPurchaseError(null); setBuyAmount("") }}
              className="font-mono text-[11px] text-neutral-600 transition-colors hover:text-white"
            >
              {showBuyOptions ? "cancel" : "buy"}
            </button>
          </div>
          {/* Expandable buy presets + custom input */}
          {showBuyOptions && (
            <div className="space-y-2">
              <div className="flex gap-1.5">
                {[5, 10, 25, 50].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setBuyAmount(String(amount))}
                    disabled={purchasing}
                    className={`flex-1 rounded border py-1 font-mono text-[10px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      buyAmount === String(amount)
                        ? "border-neutral-500 text-white"
                        : "border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white"
                    }`}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-neutral-600">$</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    placeholder="0.00"
                    value={buyAmount}
                    onChange={(e) => { setBuyAmount(e.target.value); setPurchaseError(null) }}
                    disabled={purchasing}
                    className="w-full rounded border border-neutral-800 bg-transparent py-1 pl-5 pr-2 font-mono text-[10px] tabular-nums text-neutral-300 placeholder:text-neutral-700 focus:border-neutral-600 focus:outline-none disabled:opacity-40"
                  />
                </div>
                <button
                  onClick={() => handleBuyCredits(parsedBuyAmount)}
                  disabled={!isValidBuyAmount || purchasing}
                  className="rounded border border-neutral-800 px-3 py-1 font-mono text-[10px] text-neutral-400 transition-colors hover:border-neutral-600 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {purchasing ? "..." : "purchase"}
                </button>
              </div>
              {purchaseError && (
                <p className="font-mono text-[10px] text-red-400">{purchaseError}</p>
              )}
            </div>
          )}
        </div>
      )
    }

    return (
      <button
        onClick={login}
        className="mb-4 flex items-center gap-2 font-mono text-[11px] text-neutral-500 transition-colors hover:text-white"
      >
        <svg className="h-3 w-3" viewBox="0 0 76 65" fill="currentColor">
          <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
        </svg>
        sign in with vercel
      </button>
    )
  }

  

  return (
    <main className="relative flex h-[100dvh] flex-row overflow-hidden bg-black">
      {/* Camera/Video Section */}
      <div className="flex flex-1 items-center justify-center" onClick={() => { if (isMobile && bottomSheetExpanded) setBottomSheetExpanded(false) }}>
        {selectedError ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-5 px-8">
            {selectedError.characterImageUrl && (
              <div className="h-20 w-20 overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-neutral-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedError.characterImageUrl} alt="" className="h-full w-full object-cover object-top" />
              </div>
            )}
            <div className="max-w-xs text-center">
              <p className="mb-3 font-mono text-[13px] font-medium text-white">
                generation failed
              </p>
              <p className="font-mono text-[11px] leading-relaxed text-neutral-500">
                {selectedError.message}
              </p>
            </div>
            <button
              onClick={() => setSelectedError(null)}
              className="rounded-lg bg-white px-5 py-2.5 font-mono text-[12px] font-medium text-black transition-colors hover:bg-neutral-200"
            >
              try again
            </button>
          </div>
        ) : resultUrl ? (
          <div className="relative flex h-full w-full flex-col">
            <div className="relative min-h-0 flex-1 bg-black">
              <video
                ref={mainVideoRef}
                src={resultUrl}
                muted
                loop
                playsInline
                preload="auto"
                poster={allCharacters.find(c => c.id === selectedCharacter)?.src || undefined}
                className="h-full w-full cursor-pointer object-contain object-center"
                onClick={(e) => {
                  const v = e.currentTarget
                  if (v.paused) v.play(); else v.pause()
                }}
                onLoadedData={(e) => {
                  e.currentTarget.muted = false
                  // If no PiP needed, play immediately
                  const hasPip = !!(sourceVideoUrl || recordedVideoUrl) && showPip
                  if (!hasPip) {
                    e.currentTarget.play()
                    return
                  }
                  // If PiP is also ready, start both together
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
              {/* PiP video overlay - positioned at bottom right */}
              {(sourceVideoUrl || recordedVideoUrl) && showPip && (
                <div className={cn(
                  "absolute bottom-4 right-4 overflow-hidden rounded-lg border-2 border-white/20 shadow-lg md:bottom-20",
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
                      // If main is also ready, start both together
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
              {/* Bottom fade gradient */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black to-transparent" />
            </div>
            {/* Playback controls + action buttons */}
            <div className="flex shrink-0 flex-col gap-4 pb-28 pt-3 md:pb-4">
              {/* Progress bar — full width */}
              <div
                className="h-1 w-full cursor-pointer bg-neutral-800"
                onClick={(e) => {
                  if (!mainVideoRef.current) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const pct = (e.clientX - rect.left) / rect.width
                  mainVideoRef.current.currentTime = pct * mainVideoRef.current.duration
                }}
              >
                <div
                  className="h-full bg-white"
                  style={{ width: `${videoProgress * 100}%` }}
                />
              </div>
              {/* Buttons */}
              <div className="flex items-center justify-center gap-3">
              <button
                disabled={isDownloading}
                onClick={handleDownload}
                className="flex items-center gap-2 rounded-full bg-white px-5 py-2 font-mono text-[12px] font-medium text-black transition-all hover:bg-neutral-200 active:scale-95 disabled:opacity-70"
              >
                {isDownloading ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {Math.round(downloadProgress * 100)}%
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    download
                  </>
                )}
              </button>
              <button
                onClick={handleReset}
                className="rounded-full bg-white px-5 py-2 font-mono text-[12px] font-medium text-black transition-all hover:bg-neutral-200 active:scale-95"
              >
                new video
              </button>
              {(sourceVideoUrl || recordedVideoUrl) && (
                <button
                  onClick={() => setShowPip(!showPip)}
                  className="flex items-center gap-2 rounded-full bg-white px-4 py-2 font-mono text-[12px] font-medium text-black transition-all hover:bg-neutral-200 active:scale-95"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <rect x="12" y="10" width="8" height="5" rx="1" />
                  </svg>
                  {showPip ? "pip on" : "pip off"}
                </button>
              )}
              </div>
            </div>
          </div>
        ) : (recordedVideoUrl && showPreview) ? (
          <div 
            className="relative flex h-full w-full items-center justify-center bg-black"
            onClick={(e) => {
              // If clicked outside the video container, go back to recording
              if (e.target === e.currentTarget) {
                if (isUploading) {
                  setShowUploadingWarning(true)
                  setTimeout(() => setShowUploadingWarning(false), 2000)
                  return
                }
                setShowPreview(false)
                clearRecording()
              }
            }}
          >
            <div className="relative h-full w-full overflow-hidden">
              <video
                ref={previewVideoRef}
                src={recordedVideoUrl}
                controls={!isUploading}
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
              {/* Upload indicator */}
              {isUploading && (
                <div className={cn(
                  "absolute left-4 top-4 flex items-center gap-2 rounded-full px-3 py-1.5 backdrop-blur-sm transition-all duration-300",
                  showUploadingWarning ? "bg-white/90" : "bg-black/70"
                )}>
                  <div className={cn(
                    "h-2 w-2 animate-pulse rounded-full",
                    showUploadingWarning ? "bg-black" : "bg-white"
                  )} />
                  <span className={cn(
                    "font-mono text-[11px]",
                    showUploadingWarning ? "text-black" : "text-white/80"
                  )}>
                    {showUploadingWarning ? "Hold on, uploading your video..." : "Uploading"}
                  </span>
                </div>
              )}
              {/* Retake button */}
              {!isUploading && (
                <button
                  onClick={() => { setShowPreview(false); clearRecording() }}
                  className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-sm transition-colors active:bg-black/80"
                >
                  <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="font-mono text-[11px] text-white">Retake</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <CameraPreview
            onVideoRecorded={handleVideoRecorded}
            isProcessing={false}
          />
        )}
      </div>

      {/* Desktop Sidebar */}
      {!isMobile && (
        <div className="flex h-full w-96 flex-col border-l border-neutral-800 bg-neutral-950 p-5">
          {renderAuthSection("desktop")}
          <div className="min-h-0 flex-1">
                <CharacterGrid
                  selectedId={selectedCharacter}
                  onSelect={setSelectedCharacter}
                  customCharacters={charactersReady ? customCharacters : []}
                  onAddCustom={addCustomCharacter}
                  onDeleteCustom={deleteCustomCharacter}
                  onExpand={(imageUrl, id, isCustom) => setExpandedCharacter({ imageUrl, id, isCustom })}
                  canGenerate={!!recordedVideo && !!selectedCharacter && !resultUrl}
                  hasVideo={!!recordedVideo}
                  hasCharacter={!!selectedCharacter}
                  onGenerate={handleProcess}
                  onRetake={() => { setShowPreview(false); clearRecording() }}
                  sendEmail={sendEmailNotification}
                  onSendEmailChange={setSendEmailNotification}
                  userEmail={user?.email}
                >
                <GenerationsPanel
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
                  className="mt-4"
                />
              </CharacterGrid>
          </div>
        </div>
      )}

      {/* Mobile Bottom Sheet */}
      {isMobile && (
        <BottomSheet
          isExpanded={bottomSheetExpanded}
          onExpandedChange={setBottomSheetExpanded}
          peekHeight={100}
          peek={
            resultUrl ? (
              <>
                <p className="mb-1.5 font-sans text-[9px] font-medium uppercase tracking-wider text-neutral-500">
                  My Videos
                </p>
                <GenerationsPanel
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
                  variant="compact"
                />
              </>
            ) : (
              <>
                <p className="mb-1.5 font-sans text-[9px] font-medium uppercase tracking-wider text-neutral-500">
                  Select Character
                </p>
                <div className="flex gap-1 overflow-x-auto pb-1">
                    {allCharacters.slice(0, 8).map((char) => (
                      <button
                        key={char.id}
                        onClick={() => {
                          setSelectedCharacter(char.id)
                          if (recordedVideo) setBottomSheetExpanded(true)
                        }}
                        className={cn(
                          "relative h-12 w-9 shrink-0 overflow-hidden rounded",
                          selectedCharacter === char.id ? "ring-2 ring-white" : "ring-1 ring-neutral-800"
                        )}
                      >
                        <Image src={char.src || "/placeholder.svg"} alt={char.name} fill className="object-cover" sizes="36px" />
                      </button>
                    ))}
                    <button
                      onClick={() => setBottomSheetExpanded(true)}
                      className="flex h-12 w-9 shrink-0 items-center justify-center rounded border border-dashed border-neutral-700"
                    >
                      <svg className="h-3 w-3 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </button>
                  </div>
              </>
            )
          }
        >
          {renderAuthSection("mobile")}
          {resultUrl ? (
            <>
              <GenerationsPanel
                onSelectVideo={(url, sourceUrl, sourceAR, genAR) => {
                  setSelectedError(null)
                  setSelectedGeneratedVideo(url)
                  setResultUrl(url)
                  setSourceVideoUrl(sourceUrl)
                  setSourceVideoAspectRatio(sourceAR)
                  setGeneratedVideoAspectRatio(genAR)
                  setBottomSheetExpanded(false)
                }}
                onSelectError={(error) => {
                  setResultUrl(null)
                  setSelectedError(error)
                  setBottomSheetExpanded(false)
                }}
                className="mb-6"
              />
              <p className="mb-3 font-sans text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                Create New
              </p>
              <CharacterGrid
                selectedId={selectedCharacter}
                onSelect={setSelectedCharacter}
                customCharacters={charactersReady ? customCharacters : []}
                onAddCustom={addCustomCharacter}
                onDeleteCustom={deleteCustomCharacter}
                onExpand={(imageUrl, id, isCustom) => setExpandedCharacter({ imageUrl, id, isCustom })}
                canGenerate={!!recordedVideo && !!selectedCharacter && !resultUrl}
                hasVideo={!!recordedVideo}
                hasCharacter={!!selectedCharacter}
                onGenerate={handleProcess}
                onRetake={() => { setShowPreview(false); clearRecording() }}
                sendEmail={sendEmailNotification}
                onSendEmailChange={setSendEmailNotification}
                userEmail={user?.email}
              />
            </>
          ) : (
            <CharacterGrid
              selectedId={selectedCharacter}
              onSelect={setSelectedCharacter}
              customCharacters={charactersReady ? customCharacters : []}
              onAddCustom={addCustomCharacter}
              onDeleteCustom={deleteCustomCharacter}
              onExpand={(imageUrl, id, isCustom) => setExpandedCharacter({ imageUrl, id, isCustom })}
              canGenerate={!!recordedVideo && !!selectedCharacter && !resultUrl}
              hasVideo={!!recordedVideo}
              hasCharacter={!!selectedCharacter}
              onGenerate={handleProcess}
              onRetake={() => { setShowPreview(false); clearRecording() }}
              sendEmail={sendEmailNotification}
              onSendEmailChange={setSendEmailNotification}
              userEmail={user?.email}
            >
              <GenerationsPanel
                onSelectVideo={(url, sourceUrl, sourceAR, genAR) => {
                  setSelectedError(null)
                  setSelectedGeneratedVideo(url)
                  setResultUrl(url)
                  setSourceVideoUrl(sourceUrl)
                  setSourceVideoAspectRatio(sourceAR)
                  setGeneratedVideoAspectRatio(genAR)
                  setBottomSheetExpanded(false)
                }}
                onSelectError={(error) => {
                  setResultUrl(null)
                  setSelectedError(error)
                  setBottomSheetExpanded(false)
                }}
                className="mt-4"
              />
            </CharacterGrid>
          )}
        </BottomSheet>
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-neutral-900 p-6">
            <h2 className="mb-2 font-sans text-lg font-semibold text-white">Sign in to generate</h2>
            <p className="mb-6 font-sans text-[13px] text-neutral-400">
              Create an account to generate your video. Your recording and character selection will be saved.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleLoginAndContinue}
                disabled={isLoggingIn}
                className="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 font-sans text-[13px] font-medium text-black transition-all hover:bg-neutral-200 active:scale-[0.98] disabled:opacity-70"
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
                className="rounded-lg px-4 py-3 font-sans text-[13px] text-neutral-400 transition-colors hover:text-white disabled:opacity-50"
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
          <p className="font-sans text-[13px] text-white">{errorToast}</p>
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
          {/* Close button */}
          <button
            onClick={() => setExpandedCharacter(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

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
