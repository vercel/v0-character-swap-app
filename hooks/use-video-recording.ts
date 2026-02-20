"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { upload } from "@vercel/blob/client"
import { MAX_VIDEO_SIZE, MAX_VIDEO_DURATION, STORAGE_KEYS } from "@/lib/constants"
import { detectVideoAspectRatio } from "@/lib/utils"

interface UseVideoRecordingReturn {
  recordedVideo: Blob | null
  recordedVideoUrl: string | null
  uploadedVideoUrl: string | null
  recordedAspectRatio: "9:16" | "16:9" | "fill"
  isUploading: boolean
  showPreview: boolean
  setShowPreview: (show: boolean) => void
  handleVideoRecorded: (blob: Blob, aspectRatio: "9:16" | "16:9" | "fill") => void
  clearRecording: () => void
  restoreFromSession: () => Promise<{ shouldAutoSubmit: boolean }>
  saveToSession: (video: Blob, characterId: number | null) => Promise<void>
  /** Get the raw video blob for upload */
  getVideoForUpload: () => Promise<Blob | null>
}

export function useVideoRecording(): UseVideoRecordingReturn {
  const [recordedVideo, setRecordedVideo] = useState<Blob | null>(null)
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null)
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null)
  const [recordedAspectRatio, setRecordedAspectRatio] = useState<"9:16" | "16:9" | "fill">("fill")
  const [isUploading, setIsUploading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const uploadingRef = useRef(false)

  // Create object URL when video changes
  useEffect(() => {
    if (recordedVideo) {
      const url = URL.createObjectURL(recordedVideo)
      setRecordedVideoUrl(url)
      return () => URL.revokeObjectURL(url)
    } else {
      setRecordedVideoUrl(null)
    }
  }, [recordedVideo])

  // Upload raw video to Vercel Blob
  const uploadVideo = useCallback(async (blob: Blob) => {
    if (uploadingRef.current) return
    uploadingRef.current = true

    setIsUploading(true)
    try {
      // Use the original extension based on mime type
      const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("quicktime") ? "mov" : "webm"
      const videoBlob = await upload(`videos/${Date.now()}-recording.${ext}`, blob, {
        access: "public",
        handleUploadUrl: "/api/upload",
      })
      setUploadedVideoUrl(videoBlob.url)
    } catch (error) {
      console.error("[v0] Failed to upload video:", error)
    } finally {
      setIsUploading(false)
      uploadingRef.current = false
    }
  }, [])

  // Get raw video blob for generation
  const getVideoForUpload = useCallback(async (): Promise<Blob | null> => {
    return recordedVideo
  }, [recordedVideo])

  const handleVideoRecorded = useCallback((blob: Blob, _aspectRatio: "9:16" | "16:9" | "fill") => {
    // Validate file size
    if (blob.size > MAX_VIDEO_SIZE) {
      alert("Video is too large. Please record a shorter video (max 50MB).")
      return
    }

    // Create a video element to check duration and detect actual aspect ratio
    const video = document.createElement("video")
    video.preload = "metadata"

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src)

      const duration = video.duration
      const hasValidDuration = isFinite(duration) && !isNaN(duration) && duration > 0

      if (hasValidDuration && duration > MAX_VIDEO_DURATION + 1) {
        const durationSeconds = Math.round(duration)
        alert(`Video is too long (${durationSeconds}s). Please record up to ${MAX_VIDEO_DURATION} seconds.`)
        return
      }

      // Detect actual aspect ratio from video dimensions
      const { videoWidth, videoHeight } = video
      const detectedAspectRatio = detectVideoAspectRatio(videoWidth, videoHeight)

      // Set video state immediately so user can see preview
      setRecordedVideo(blob)
      setRecordedAspectRatio(detectedAspectRatio)
      setShowPreview(true)

      // Upload raw blob immediately (Cloudinary will convert to MP4 server-side)
      uploadVideo(blob)
    }

    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      // Still accept the video if we can't validate
      setRecordedVideo(blob)
      setRecordedAspectRatio("fill")
      setShowPreview(true)
      uploadVideo(blob)
    }

    video.src = URL.createObjectURL(blob)
  }, [uploadVideo])

  const clearRecording = useCallback(() => {
    setRecordedVideo(null)
    setRecordedVideoUrl(null)
    setUploadedVideoUrl(null)
    setRecordedAspectRatio("fill")
    setShowPreview(false)
    uploadingRef.current = false
  }, [])

  const saveToSession = useCallback(async (video: Blob, characterId: number | null) => {
    if (characterId) {
      sessionStorage.setItem(STORAGE_KEYS.PENDING_CHARACTER, String(characterId))
    }
    sessionStorage.setItem(STORAGE_KEYS.PENDING_ASPECT_RATIO, recordedAspectRatio)

    if (uploadedVideoUrl) {
      sessionStorage.setItem(STORAGE_KEYS.PENDING_VIDEO_URL, uploadedVideoUrl)
      sessionStorage.setItem(STORAGE_KEYS.PENDING_UPLOADED, "true")
    } else {
      try {
        const dataUrl = await blobToDataUrl(video)
        sessionStorage.setItem(STORAGE_KEYS.PENDING_VIDEO_URL, dataUrl)
        sessionStorage.setItem(STORAGE_KEYS.PENDING_UPLOADED, "false")
      } catch (e) {
        console.error("[v0] Failed to save video:", e)
      }
    }
    sessionStorage.setItem(STORAGE_KEYS.PENDING_AUTO_SUBMIT, "true")
  }, [uploadedVideoUrl, recordedAspectRatio])

  const restoreFromSession = useCallback(async (): Promise<{ shouldAutoSubmit: boolean }> => {
    const savedVideoUrl = sessionStorage.getItem(STORAGE_KEYS.PENDING_VIDEO_URL)
    const wasUploaded = sessionStorage.getItem(STORAGE_KEYS.PENDING_UPLOADED) === "true"
    const shouldAutoSubmit = sessionStorage.getItem(STORAGE_KEYS.PENDING_AUTO_SUBMIT) === "true"
    const savedAspectRatio = sessionStorage.getItem(STORAGE_KEYS.PENDING_ASPECT_RATIO) as "9:16" | "16:9" | "fill" | null

    if (savedVideoUrl) {
      try {
        if (wasUploaded) {
          setUploadedVideoUrl(savedVideoUrl)
          const response = await fetch(savedVideoUrl)
          const blob = await response.blob()
          setRecordedVideo(blob)
        } else {
          const response = await fetch(savedVideoUrl)
          const blob = await response.blob()
          setRecordedVideo(blob)
          // Upload raw blob immediately
          uploadVideo(blob)
        }
        if (savedAspectRatio) {
          setRecordedAspectRatio(savedAspectRatio)
        }
        setShowPreview(true)
        sessionStorage.removeItem(STORAGE_KEYS.PENDING_VIDEO_URL)
        sessionStorage.removeItem(STORAGE_KEYS.PENDING_UPLOADED)
        sessionStorage.removeItem(STORAGE_KEYS.PENDING_AUTO_SUBMIT)
        sessionStorage.removeItem(STORAGE_KEYS.PENDING_ASPECT_RATIO)
        return { shouldAutoSubmit }
      } catch {
        sessionStorage.removeItem(STORAGE_KEYS.PENDING_VIDEO_URL)
        sessionStorage.removeItem(STORAGE_KEYS.PENDING_UPLOADED)
        sessionStorage.removeItem(STORAGE_KEYS.PENDING_AUTO_SUBMIT)
        sessionStorage.removeItem(STORAGE_KEYS.PENDING_ASPECT_RATIO)
      }
    }
    return { shouldAutoSubmit: false }
  }, [uploadVideo])

  return {
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
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
