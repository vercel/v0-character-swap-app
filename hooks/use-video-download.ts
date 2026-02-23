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

function isMobile(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  if (url.startsWith("blob:")) {
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
}

/**
 * Stream-fetch a video with progress tracking.
 * Returns the video as a Blob. Falls back to .blob() if streaming
 * isn't available or content-length is unknown.
 */
async function fetchWithProgress(
  url: string,
  onProgress: (progress: number) => void,
): Promise<Blob> {
  const res = await fetch(url)
  if (!res.ok) {
    const errText = res.headers.get("x-cld-error") || res.statusText
    throw new Error(`Download failed: ${res.status} ${errText}`)
  }

  const contentLength = res.headers.get("content-length")
  const total = contentLength ? parseInt(contentLength, 10) : 0

  if (!res.body || !total) {
    // Can't stream — download all at once
    onProgress(0.5)
    const blob = await res.blob()
    onProgress(1)
    return blob
  }

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    onProgress(received / total)
  }

  return new Blob(chunks, { type: "video/mp4" })
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
    const mobile = isMobile()

    try {
      setIsDownloading(true)
      setDownloadProgress(0.05)

      // Phase 1 (0-10%): get Cloudinary composite URL from API
      const params = new URLSearchParams({
        main: resultUrl,
        ...(pipVideoUrl ? { pip: pipVideoUrl } : {}),
        showPip: String(showPip),
        pipAspectRatio,
      })
      const apiRes = await fetch(`/api/download?${params}`)
      if (!apiRes.ok) throw new Error("API returned " + apiRes.status)

      const { url: cloudinaryUrl } = await apiRes.json()
      setDownloadProgress(0.1)

      // Phase 2 (10-95%): stream the video with progress
      const blob = await fetchWithProgress(cloudinaryUrl, (p) => {
        setDownloadProgress(0.1 + p * 0.85)
      })
      setDownloadProgress(0.95)

      // Phase 3 (95-100%): deliver to user
      if (mobile) {
        const file = new File([blob], filename, { type: "video/mp4" })
        if (navigator.canShare?.({ files: [file] })) {
          setDownloadProgress(1)
          await navigator.share({ files: [file] })
          return
        }
      }

      const blobUrl = URL.createObjectURL(blob)
      triggerDownload(blobUrl, filename)
      setDownloadProgress(1)
    } catch (error) {
      console.error("Download failed:", error)
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
