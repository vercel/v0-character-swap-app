"use client"

/**
 * Process video on server to fix metadata issues (especially for Safari)
 * Returns the URL of the processed video
 */
export async function processVideoForUpload(
  blob: Blob,
  onProgress?: (progress: number) => void
): Promise<string> {
  console.log("[v0] Sending video to server for processing...")
  
  onProgress?.(10)
  
  const formData = new FormData()
  formData.append("video", blob, "recording.mp4")
  
  onProgress?.(30)
  
  const response = await fetch("/api/process-video", {
    method: "POST",
    body: formData,
  })
  
  onProgress?.(80)
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to process video")
  }
  
  const result = await response.json()
  
  onProgress?.(100)
  
  console.log("[v0] Video processed and uploaded:", result.url)
  
  return result.url
}

/**
 * Check if browser is Safari (needs video processing)
 */
export function needsVideoProcessing(): boolean {
  if (typeof navigator === "undefined") return false
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
}
