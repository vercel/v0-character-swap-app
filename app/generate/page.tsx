"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, useRef, Suspense } from "react"
import { useVideo } from "@/providers/video-context"
import { useAuth } from "@/components/auth-provider"
import { useCharacters } from "@/hooks/use-characters"
import { useVideoGeneration } from "@/hooks/use-video-generation"
import { OngoingGenerationView } from "@/components/ongoing-generation-view"

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
    onGenerationCreated: (_id, uuid) => {
      router.replace(`/${uuid}`)
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
