"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, useRef, Suspense } from "react"
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

/**
 * This page only exists for the post-login auto-submit flow:
 * 1. User records video → clicks Generate → login modal → OAuth redirect
 * 2. After login, callback redirects to / → detects loginReturnUrl → redirects here
 * 3. This page restores video from sessionStorage and auto-submits
 * 4. Then redirects to /pick
 *
 * Normal generation flow goes: record page → processVideo() → /pick directly
 */
function GenerateContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const charId = searchParams.get("char") ? Number(searchParams.get("char")) : null

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
    onSuccess: () => router.replace("/pick"),
    onError: () => router.replace("/pick"),
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

  // Auto-submit after login restore → then go to /pick
  useEffect(() => {
    if (!pendingAutoSubmit || !user || !recordedVideo) return
    let char = charId ? allCharacters.find(c => c.id === charId) : null
    if (!char && customCharacters.length > 0) {
      char = customCharacters[customCharacters.length - 1]
      setSelectedCharacter(char.id)
    }
    if (!char) return
    setPendingAutoSubmit(false)
    getCharacterAspectRatio(char.src).then(characterAspectRatio => {
      processVideo(getVideoForUpload, char!, false, uploadedVideoUrl, characterAspectRatio, recordedAspectRatio, waitForUpload)
      router.replace("/pick")
    })
  }, [pendingAutoSubmit, user, recordedVideo, charId, allCharacters, customCharacters, setSelectedCharacter, processVideo, uploadedVideoUrl, getVideoForUpload, recordedAspectRatio, waitForUpload, router])

  // Show a minimal loading state while restoring
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/20 border-t-black" />
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
