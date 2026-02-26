"use client"

import { useCallback, useRef } from "react"
import { upload } from "@vercel/blob/client"
import type { Character, User } from "@/lib/types"
import { MIN_IMAGE_DIMENSION, MIN_VIDEO_DURATION } from "@/lib/constants"

interface UseVideoGenerationOptions {
  user: User | null
  onLoginRequired: () => void
  onSuccess: () => void
  onError: (message: string) => void
}

interface UseVideoGenerationReturn {
  processVideo: (
    getVideo: () => Promise<Blob | null>,
    character: Character,
    sendEmail: boolean,
    preUploadedVideoUrl?: string | null,
    aspectRatio?: "9:16" | "16:9" | "fill",
    sourceVideoAspectRatio?: "9:16" | "16:9" | "fill",
    waitForUpload?: () => Promise<string | null>
  ) => void
}

function getApiErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error
  }

  if (typeof error === "object" && error !== null) {
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === "string") {
      return maybeMessage
    }
  }

  return "Failed to start generation"
}

// Helper to validate video duration from a Blob
async function validateVideoDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const video = document.createElement("video")
    video.preload = "metadata"
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(video.duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Failed to read video metadata"))
    }
    video.src = url
  })
}

// Helper to validate image dimensions
async function validateImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error("Failed to load image"))
    img.src = src
  })
}

export function useVideoGeneration({
  user,
  onLoginRequired,
  onSuccess,
  onError,
}: UseVideoGenerationOptions): UseVideoGenerationReturn {
  const processingRef = useRef(false)

  const processVideo = useCallback((
    getVideo: () => Promise<Blob | null>,
    character: Character,
    sendEmail: boolean,
    preUploadedVideoUrl?: string | null,
    aspectRatio: "9:16" | "16:9" | "fill" = "fill",
    sourceVideoAspectRatio: "9:16" | "16:9" | "fill" = "fill",
    waitForUpload?: () => Promise<string | null>
  ) => {
    if (!user) {
      onLoginRequired()
      return
    }

    // Prevent double-submit
    if (processingRef.current) return
    processingRef.current = true

    // Run everything in background - don't await
    ;(async () => {
      let generationId: number | null = null
      
      try {
        // Quick validation first
        try {
          const dimensions = await validateImageDimensions(character.src)
          if (dimensions.width < MIN_IMAGE_DIMENSION || dimensions.height < MIN_IMAGE_DIMENSION) {
            throw new Error(
              `Character image is too small (${dimensions.width}x${dimensions.height}). ` +
              `Minimum size is ${MIN_IMAGE_DIMENSION}x${MIN_IMAGE_DIMENSION} pixels.`
            )
          }
        } catch (dimError) {
          if (dimError instanceof Error && dimError.message.includes("too small")) {
            throw dimError
          }
        }

        // 1. Create pending generation in DB immediately
        const pendingResponse = await fetch("/api/generations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            characterName: character.name,
            characterImageUrl: character.src,
            aspectRatio,
            sourceVideoAspectRatio,
          }),
        })
        
        if (!pendingResponse.ok) {
          throw new Error("Failed to create generation")
        }
        
        const { generationId: id } = await pendingResponse.json()
        generationId = id

        // 2. Trigger refresh so it appears in "My Videos" immediately
        window.dispatchEvent(new CustomEvent("refresh-generations"))

        // 3. Get the video (waits for processing if still in progress)
        const video = await getVideo()
        if (!video) {
          throw new Error("No video available")
        }

        // 3b. Validate video duration — KlingAI requires at least 3s
        try {
          const duration = await validateVideoDuration(video)
          if (duration < MIN_VIDEO_DURATION) {
            throw new Error(
              `Video is too short (${Math.round(duration * 10) / 10}s). ` +
              `Please record at least ${MIN_VIDEO_DURATION} seconds.`
            )
          }
        } catch (durError) {
          if (durError instanceof Error && durError.message.includes("too short")) {
            throw durError
          }
          // If metadata read fails, proceed anyway — server will validate
        }

        // 4. Upload video (wait for in-progress upload, or upload now)
        let videoUrl = preUploadedVideoUrl
        if (!videoUrl && waitForUpload) {
          videoUrl = await waitForUpload()
        }
        if (!videoUrl) {
          const videoBlob = await upload(`videos/${Date.now()}-recording.webm`, video, {
            access: "public",
            handleUploadUrl: "/api/upload",
          })
          videoUrl = videoBlob.url
        }

        // 5. Upload character image
        const characterResponse = await fetch(character.src)
        const characterBlob = await characterResponse.blob()

        const characterBlobResult = await upload(`characters/${Date.now()}-character.jpg`, characterBlob, {
          access: "public",
          handleUploadUrl: "/api/upload",
        })

        // 6. Start generation (use generate-direct on localhost, workflow on prod)
        const isDev = window.location.hostname === "localhost"
        const startResponse = await fetch(isDev ? "/api/generate-direct" : "/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generationId,
            videoUrl,
            characterImageUrl: characterBlobResult.url,
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            characterName: character.name,
            sourceVideoAspectRatio,
            sendEmail: sendEmail && user.email ? true : false,
          }),
        })

        if (!startResponse.ok) {
          const errorData = await startResponse.json()
          throw new Error(getApiErrorMessage(errorData.error))
        }

        // Refresh to show "processing" status and updated credit balance
        window.dispatchEvent(new CustomEvent("refresh-generations"))
        window.dispatchEvent(new CustomEvent("refresh-credits"))
        
      } catch (error) {
        console.error("Background processing failed:", error)
        const errorMessage = error instanceof Error ? error.message : "Something went wrong"
        
        // If we created a generation, mark it as failed
        if (generationId) {
          try {
            await fetch(`/api/generations/${generationId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "failed", errorMessage }),
            })
            window.dispatchEvent(new CustomEvent("refresh-generations"))
          } catch {
            // Ignore cleanup errors
          }
        }
        
        onError(errorMessage)
      } finally {
        processingRef.current = false
      }
    })()

    // Return immediately - don't wait for the async work
    onSuccess()
  }, [user, onLoginRequired, onSuccess, onError])

  return {
    processVideo,
  }
}
