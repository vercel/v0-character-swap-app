"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { upload } from "@vercel/blob/client"
import { MAX_VIDEO_SIZE, MAX_VIDEO_DURATION, STORAGE_KEYS } from "@/lib/constants"
import { detectVideoAspectRatio } from "@/lib/utils"
import { useVideoProcessor } from "./use-video-processor"

interface UseVideoRecordingReturn {
  recordedVideo: Blob | null
  recordedVideoUrl: string | null
  uploadedVideoUrl: string | null
  recordedAspectRatio: "9:16" | "16:9" | "fill"
  isUploading: boolean
  isProcessing: boolean
  processingProgress: { stage: string; percent: number; message: string } | null
  showPreview: boolean
  setShowPreview: (show: boolean) => void
  handleVideoRecorded: (blob: Blob, aspectRatio: "9:16" | "16:9" | "fill") => void
  clearRecording: () => void
  restoreFromSession: () => Promise<{ shouldAutoSubmit: boolean }>
  saveToSession: (video: Blob, characterId: number | null) => Promise<void>
  /** Get the video blob ready for upload (processed if ready, original otherwise) */
  getVideoForUpload: () => Promise<Blob | null>
}

export function useVideoRecording(): UseVideoRecordingReturn {
  const [recordedVideo, setRecordedVideo] = useState<Blob | null>(null)
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null)
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null)
  const [recordedAspectRatio, setRecordedAspectRatio] = useState<"9:16" | "16:9" | "fill">("fill")
  const [isUploading, setIsUploading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  
  // Video processor for background transcoding
  const { 
    startProcessing, 
    awaitProcessedVideo, 
    getProcessedVideo,
    progress: processingProgress, 
    isProcessing,
    isComplete: processingComplete,
    reset: resetProcessor,
  } = useVideoProcessor()
  
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

  // Auto-upload when processing completes
  useEffect(() => {
    if (processingComplete && !uploadedVideoUrl && !uploadingRef.current) {
      const processedVideo = getProcessedVideo()
      if (processedVideo) {
        uploadVideo(processedVideo)
      }
    }
  }, [processingComplete, uploadedVideoUrl, getProcessedVideo])

  // Upload video to Vercel Blob
  const uploadVideo = useCallback(async (blob: Blob) => {
    if (uploadingRef.current) return
    uploadingRef.current = true
    
    setIsUploading(true)
    try {
      const videoBlob = await upload(`videos/${Date.now()}-recording.mp4`, blob, {
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

  // Get video ready for generation (waits for processing if needed)
  const getVideoForUpload = useCallback(async (): Promise<Blob | null> => {
    if (!recordedVideo) return null
    
    // Always use awaitProcessedVideo - it handles all the logic:
    // - Returns processed video if complete
    // - Waits for processing if in progress
    // - Falls back to original if processing never started or failed
    try {
      return await awaitProcessedVideo()
    } catch (error) {
      console.error("[v0] Failed to get processed video:", error)
      return recordedVideo // Fallback to original
    }
  }, [recordedVideo, awaitProcessedVideo])

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
      
      // Start processing in background - doesn't block UI
      startProcessing(blob)
    }
    
    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      // Still accept the video if we can't validate
      setRecordedVideo(blob)
      setRecordedAspectRatio("fill")
      setShowPreview(true)
      startProcessing(blob)
    }
    
    video.src = URL.createObjectURL(blob)
  }, [startProcessing])

  const clearRecording = useCallback(() => {
    setRecordedVideo(null)
    setRecordedVideoUrl(null)
    setUploadedVideoUrl(null)
    setRecordedAspectRatio("fill")
    setShowPreview(false)
    resetProcessor()
    uploadingRef.current = false
  }, [resetProcessor])

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
          // Start processing in background
          startProcessing(blob)
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
  }, [startProcessing])

  return {
    recordedVideo,
    recordedVideoUrl,
    uploadedVideoUrl,
    recordedAspectRatio,
    isUploading,
    isProcessing,
    processingProgress,
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
