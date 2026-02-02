"use client"

import { useState, useCallback } from "react"

interface ProcessingProgress {
  stage: "loading" | "processing" | "done" | "error"
  percent: number
  message: string
}

interface UseVideoProcessorReturn {
  processVideo: (inputBlob: Blob) => Promise<Blob>
  progress: ProcessingProgress | null
  isProcessing: boolean
}

/**
 * Hook to process video - currently bypassed to test if fal.ai handles raw videos
 * 
 * TESTING: Sending raw video directly to fal.ai without ffmpeg processing
 * If this works, we can remove ffmpeg.wasm entirely which will:
 * - Eliminate the "Processing video" wait time
 * - Reduce bundle size significantly
 * - Simplify the codebase
 */
export function useVideoProcessor(): UseVideoProcessorReturn {
  const [progress, setProgress] = useState<ProcessingProgress | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const processVideo = useCallback(async (inputBlob: Blob): Promise<Blob> => {
    // TESTING: Skip all processing, send raw video to fal.ai
    console.log("[v0] Skipping ffmpeg processing - testing raw video upload")
    console.log("[v0] Video type:", inputBlob.type, "Size:", (inputBlob.size / 1024 / 1024).toFixed(2), "MB")
    
    setProgress({ stage: "done", percent: 100, message: "Ready!" })
    return inputBlob
  }, [])

  return {
    processVideo,
    progress,
    isProcessing,
  }
}
