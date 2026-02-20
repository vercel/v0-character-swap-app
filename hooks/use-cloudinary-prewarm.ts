"use client"

import { useEffect, useRef } from "react"

interface PrewarmOptions {
  resultUrl: string | null
  pipVideoUrl: string | null
  showPip: boolean
}

/**
 * Fires a HEAD request to the Cloudinary composite URL when the user views
 * a result video. This triggers Cloudinary's auto-upload + transformation
 * pipeline in the background so the video is CDN-cached before they click
 * download.
 */
export function useCloudinaryPrewarm({ resultUrl, pipVideoUrl, showPip }: PrewarmOptions) {
  const warmedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!resultUrl) {
      warmedRef.current = null
      return
    }

    // Build a cache key so we don't re-warm the same combination
    const key = `${resultUrl}|${showPip ? pipVideoUrl : ""}`
    if (warmedRef.current === key) return
    warmedRef.current = key

    const params = new URLSearchParams({
      main: resultUrl,
      ...(pipVideoUrl ? { pip: pipVideoUrl } : {}),
      showPip: String(showPip),
    })

    // Get the Cloudinary URL from our API, then fire a HEAD to warm it
    fetch(`/api/download?${params}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.url) {
          fetch(data.url, { method: "HEAD" }).catch(() => {})
        }
      })
      .catch(() => {})
  }, [resultUrl, pipVideoUrl, showPip])
}
