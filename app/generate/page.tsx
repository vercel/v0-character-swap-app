"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, useCallback, useEffect, useRef, Suspense } from "react"
import { useVideo } from "@/providers/video-context"
import { useAuth } from "@/components/auth-provider"
import { useCharacters } from "@/hooks/use-characters"
import { useVideoGeneration } from "@/hooks/use-video-generation"
import { detectImageAspectRatio } from "@/lib/utils"

async function getCharacterAspectRatio(src: string): Promise<"9:16" | "16:9" | "fill"> {
  const ratio = await detectImageAspectRatio(src)
  if (ratio === "9:16" || ratio === "3:4") return "9:16"
  if (ratio === "16:9" || ratio === "4:3") return "16:9"
  return "fill"
}

function GenerateContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const charId = searchParams.get("char") ? Number(searchParams.get("char")) : null

  const { user, isLoading: authLoading, login } = useAuth()
  const { allCharacters, selectedCharacter, setSelectedCharacter, trackCharacterUsage, customCharacters, addCustomCharacter, isReady: charactersReady } = useCharacters({ user, authLoading })
  const {
    recordedVideo,
    recordedVideoUrl,
    uploadedVideoUrl,
    recordedAspectRatio,
    getVideoForUpload,
    waitForUpload,
    clearRecording,
    saveToSession,
    restoreFromSession,
  } = useVideo()

  const [sessionRestored, setSessionRestored] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [sendEmailNotification, setSendEmailNotification] = useState(false)
  const [errorToast, setErrorToast] = useState<string | null>(null)
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

  // Sync charId from URL to useCharacters
  useEffect(() => {
    if (charId && charId !== selectedCharacter) {
      setSelectedCharacter(charId)
    }
  }, [charId, selectedCharacter, setSelectedCharacter])

  const character = charId ? allCharacters.find(c => c.id === charId) : null

  // Redirect to /pick if no video (wait for session restore first)
  useEffect(() => {
    if (!sessionRestored) return
    if (!recordedVideo && !recordedVideoUrl) {
      router.replace("/pick")
    }
  }, [sessionRestored, recordedVideo, recordedVideoUrl, router])

  const { processVideo } = useVideoGeneration({
    user,
    onLoginRequired: () => setShowLoginModal(true),
    onSuccess: () => setShowSuccess(true),
    onError: (message) => {
      setErrorToast(message)
      setTimeout(() => setErrorToast(null), 5000)
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
    if (pendingAutoSubmit && user && recordedVideo) {
      let char = charId ? allCharacters.find(c => c.id === charId) : null
      if (!char && customCharacters.length > 0) {
        char = customCharacters[customCharacters.length - 1]
        setSelectedCharacter(char.id)
      }
      if (!char) return
      setPendingAutoSubmit(false)
      getCharacterAspectRatio(char.src).then(characterAspectRatio => {
        setTimeout(() => {
          processVideo(getVideoForUpload, char!, sendEmailNotification, uploadedVideoUrl, characterAspectRatio, recordedAspectRatio, waitForUpload)
        }, 100)
      })
    }
  }, [pendingAutoSubmit, user, recordedVideo, charId, allCharacters, customCharacters, setSelectedCharacter, processVideo, uploadedVideoUrl, getVideoForUpload, recordedAspectRatio, sendEmailNotification, waitForUpload])

  // Auto-generate on mount (coming from record page with video ready)
  // Don't gate on `user` — processVideo will show login modal if needed
  // Skip if pendingAutoSubmit — that path handles its own submission after login
  const hasTriggered = useRef(false)
  useEffect(() => {
    if (hasTriggered.current || pendingAutoSubmit || !recordedVideo || !character) return
    hasTriggered.current = true
    getCharacterAspectRatio(character.src).then(characterAspectRatio => {
      trackCharacterUsage(character.id)
      processVideo(getVideoForUpload, character, sendEmailNotification, uploadedVideoUrl, characterAspectRatio, recordedAspectRatio, waitForUpload)
    })
  }, [pendingAutoSubmit, recordedVideo, character, processVideo, uploadedVideoUrl, recordedAspectRatio, getVideoForUpload, trackCharacterUsage, sendEmailNotification, waitForUpload])

  const handleReset = useCallback(() => {
    clearRecording()
    setShowSuccess(false)
    router.push("/")
  }, [clearRecording, router])

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
    sessionStorage.setItem("loginReturnUrl", `/generate?char=${charId}`)
    login()
  }, [recordedVideo, charId, allCharacters, saveToSession, login])

  // Success screen
  if (showSuccess) {
    return (
      <div className="relative flex h-full w-full items-center justify-center">
        {recordedVideoUrl && (
          <video src={recordedVideoUrl} className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline />
        )}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative z-10 flex flex-col items-center gap-5 px-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20 backdrop-blur-sm">
            <svg className="h-10 w-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-2xl font-bold text-white">Video is generating!</p>
            <p className="text-center text-sm text-white/50">
              Using <span className="text-white/70">Kling Motion Control</span> via{" "}
              <a href="https://vercel.com/ai-gateway" target="_blank" rel="noopener noreferrer" className="text-white/70 underline underline-offset-2 hover:text-white">AI Gateway</a>
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 pt-4">
            <button
              onClick={handleReset}
              className="flex h-12 w-72 items-center justify-center gap-2 rounded-xl bg-white text-[15px] font-semibold text-black shadow-lg transition-all hover:bg-neutral-100 active:scale-[0.98]"
            >
              Create new video
            </button>
            <button
              onClick={() => {
                setShowSuccess(false)
                router.push("/pick")
              }}
              className="flex h-11 w-72 items-center justify-center gap-2 rounded-xl bg-white/15 text-sm font-medium text-white/70 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white active:scale-[0.98]"
            >
              Try another character
            </button>
            <a
              href="https://v0.app/templates/face-swap-template-1Nu0E0eAo9q"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 w-72 items-center justify-center gap-2.5 rounded-xl bg-white/10 text-sm font-medium text-white/50 backdrop-blur-sm transition-all hover:bg-white/15 hover:text-white/70 active:scale-[0.98]"
            >
              Make my own FaceSwap with
              <svg className="h-3 w-auto" viewBox="0 0 252 120" fill="currentColor">
                <path d="M96 86.0625V24H120V103.125C120 112.445 112.445 120 103.125 120C98.6751 120 94.2826 118.284 91.125 115.127L0 24H33.9375L96 86.0625Z" />
                <path d="M218.25 0C236.89 0 252 15.1104 252 33.75V96H228V41.0625L173.062 96H228V120H165.75C147.11 120 132 104.89 132 86.25V24H156V79.125L211.125 24H156V0H218.25Z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    )
  }

  // Waiting state (generation triggered, no result yet)
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-4 px-8">
      {recordedVideoUrl && (
        <video src={recordedVideoUrl} className="absolute inset-0 h-full w-full object-cover opacity-30" autoPlay muted loop playsInline />
      )}
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/20 border-t-black" />
        <p className="text-sm text-black/50">Starting generation...</p>
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

      {/* Error Toast */}
      {errorToast && (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-lg bg-red-900 px-4 py-2 shadow-lg">
          <p className="text-sm font-medium text-white">{errorToast}</p>
        </div>
      )}
    </div>
  )
}

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-white" />}>
      <GenerateContent />
    </Suspense>
  )
}
