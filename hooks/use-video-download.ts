"use client"

import { useState, useCallback } from "react"

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

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
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
    const filename = `faceswap-${slug}${pipSuffix}.mp4`

    try {
      setIsDownloading(true)
      setDownloadProgress(0.1)

      // Ask server for Cloudinary composite URL
      const params = new URLSearchParams({
        main: resultUrl,
        ...(pipVideoUrl ? { pip: pipVideoUrl } : {}),
        showPip: String(showPip),
      })
      const apiRes = await fetch(`/api/download?${params}`)

      if (!apiRes.ok) throw new Error("API returned " + apiRes.status)

      const { url: cloudinaryUrl } = await apiRes.json()
      console.log("[download] Cloudinary URL:", cloudinaryUrl)
      setDownloadProgress(0.2)

      // Stream the video from Cloudinary with progress
      const videoRes = await fetch(cloudinaryUrl)
      if (!videoRes.ok) {
        const errText = videoRes.headers.get("x-cld-error") || videoRes.statusText
        throw new Error(`Cloudinary returned ${videoRes.status}: ${errText}`)
      }

      const contentLength = videoRes.headers.get("content-length")
      const total = contentLength ? parseInt(contentLength, 10) : 0

      if (!videoRes.body || !total) {
        // No streaming support or unknown size — download directly
        const blob = await videoRes.blob()
        const blobUrl = URL.createObjectURL(blob)
        triggerDownload(blobUrl, filename)
        URL.revokeObjectURL(blobUrl)
        setDownloadProgress(1)
        return
      }

      // Stream with progress tracking
      const reader = videoRes.body.getReader()
      const chunks: BlobPart[] = []
      let received = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.length
        setDownloadProgress(0.2 + (received / total) * 0.8)
      }

      const blob = new Blob(chunks, { type: "video/mp4" })
      const blobUrl = URL.createObjectURL(blob)
      triggerDownload(blobUrl, filename)
      URL.revokeObjectURL(blobUrl)
      setDownloadProgress(1)
    } catch (error) {
      console.error("Cloudinary download failed, fetching original:", error)
      // Fallback: download original video directly (has audio, no PiP/watermark)
      try {
        const response = await fetch(resultUrl)
        const blob = await response.blob()
        const blobUrl = URL.createObjectURL(blob)
        triggerDownload(blobUrl, `faceswap-${slug}.mp4`)
        URL.revokeObjectURL(blobUrl)
      } catch (fallbackError) {
        console.error("Fallback download also failed:", fallbackError)
      }
    } finally {
      setIsDownloading(false)
      setDownloadProgress(0)
    }
  }, [resultUrl, pipVideoUrl, showPip, pipAspectRatio, characterName])

  return {
    isDownloading,
    downloadProgress,
    handleDownload,
  }
}
