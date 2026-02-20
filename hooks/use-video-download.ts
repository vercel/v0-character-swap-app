"use client"

import { useState, useCallback } from "react"
import { createPipVideoClient, downloadBlob } from "@/lib/video-pip-client"

interface UseVideoDownloadOptions {
  resultUrl: string | null
  pipVideoUrl: string | null
  showPip: boolean
  pipAspectRatio: "9:16" | "16:9" | "fill"
  characterName?: string | null
}

interface UseVideoDownloadReturn {
  isDownloading: boolean
  downloadProgress: number
  handleDownload: () => Promise<void>
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export function useVideoDownload({
  resultUrl,
  pipVideoUrl,
  showPip,
  pipAspectRatio,
  characterName,
}: UseVideoDownloadOptions): UseVideoDownloadReturn {
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)

  const handleDownload = useCallback(async () => {
    if (!resultUrl) return

    const slug = characterName ? slugify(characterName) : "video"
    const pipSuffix = showPip && pipVideoUrl ? "-pip" : ""

    if (showPip && pipVideoUrl) {
      try {
        setIsDownloading(true)
        setDownloadProgress(0)

        const { blob, extension } = await createPipVideoClient({
          mainVideoUrl: resultUrl,
          pipVideoUrl: pipVideoUrl,
          pipPosition: "bottom-right",
          pipScale: 0.25,
          pipAspectRatio,
          addWatermark: true,
          onProgress: setDownloadProgress,
        })

        downloadBlob(blob, `faceswap-${slug}${pipSuffix}.${extension}`)
      } catch (error) {
        console.error("PiP download failed:", error)
        const response = await fetch(resultUrl)
        const blob = await response.blob()
        downloadBlob(blob, `faceswap-${slug}.mp4`)
      } finally {
        setIsDownloading(false)
        setDownloadProgress(0)
      }
    } else {
      try {
        setIsDownloading(true)
        setDownloadProgress(0)

        const { blob, extension } = await createPipVideoClient({
          mainVideoUrl: resultUrl,
          pipVideoUrl: null,
          addWatermark: true,
          onProgress: setDownloadProgress,
        })

        downloadBlob(blob, `faceswap-${slug}.${extension}`)
      } catch (error) {
        console.error("Watermark failed, downloading original:", error)
        const response = await fetch(resultUrl)
        const blob = await response.blob()
        downloadBlob(blob, `faceswap-${slug}.mp4`)
      } finally {
        setIsDownloading(false)
        setDownloadProgress(0)
      }
    }
  }, [resultUrl, pipVideoUrl, showPip, pipAspectRatio, characterName])

  return {
    isDownloading,
    downloadProgress,
    handleDownload,
  }
}
