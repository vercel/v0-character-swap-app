"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useVideoRecording } from "@/hooks/use-video-recording"

interface VideoContextValue {
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
  getVideoForUpload: () => Promise<Blob | null>
  waitForUpload: () => Promise<string | null>
}

const VideoContext = createContext<VideoContextValue | null>(null)

export function VideoProvider({ children }: { children: ReactNode }) {
  const video = useVideoRecording()
  return (
    <VideoContext.Provider value={video}>
      {children}
    </VideoContext.Provider>
  )
}

export function useVideo(): VideoContextValue {
  const ctx = useContext(VideoContext)
  if (!ctx) throw new Error("useVideo must be used within VideoProvider")
  return ctx
}
