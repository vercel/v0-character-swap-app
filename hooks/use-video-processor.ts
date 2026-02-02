"use client"

import { useState, useCallback, useRef, useEffect } from "react"

interface ProcessingProgress {
  stage: "loading" | "processing" | "done" | "error"
  percent: number
  message: string
}

interface UseVideoProcessorReturn {
  /** Start processing a video in the background. Returns immediately. */
  startProcessing: (inputBlob: Blob) => void
  /** Wait for the processed video. Returns the processed blob or original if failed. */
  awaitProcessedVideo: () => Promise<Blob>
  /** Get the processed video if ready, or null if still processing */
  getProcessedVideo: () => Blob | null
  /** Current processing progress */
  progress: ProcessingProgress | null
  /** Whether processing is in progress */
  isProcessing: boolean
  /** Whether processing is complete (success or error) */
  isComplete: boolean
  /** Reset the processor state */
  reset: () => void
}

/**
 * Hook to process video using ffmpeg.wasm in a Web Worker
 * This allows the user to continue interacting while the video processes in the background
 */
export function useVideoProcessor(): UseVideoProcessorReturn {
  const [progress, setProgress] = useState<ProcessingProgress | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  
  const workerRef = useRef<Worker | null>(null)
  const processedBlobRef = useRef<Blob | null>(null)
  const originalBlobRef = useRef<Blob | null>(null)
  const resolveRef = useRef<((blob: Blob) => void) | null>(null)
  const rejectRef = useRef<((error: Error) => void) | null>(null)
  const processingStartedRef = useRef(false) // Track if processing was initiated

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [])

  const reset = useCallback(() => {
    setProgress(null)
    setIsProcessing(false)
    setIsComplete(false)
    processedBlobRef.current = null
    originalBlobRef.current = null
    resolveRef.current = null
    rejectRef.current = null
    processingStartedRef.current = false
  }, [])

  const startProcessing = useCallback((inputBlob: Blob) => {
    // Reset state
    reset()
    processingStartedRef.current = true // Mark that processing has been initiated
    setIsProcessing(true)
    originalBlobRef.current = inputBlob
    processedBlobRef.current = null

    // Create worker if it doesn't exist
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../lib/video-processor.worker.ts", import.meta.url),
        { type: "module" }
      )

      workerRef.current.onmessage = (e) => {
        const data = e.data

        if (data.type === "progress") {
          setProgress({
            stage: data.stage,
            percent: data.percent,
            message: data.message,
          })
        } else if (data.type === "result") {
          // Processing complete
          const processedBlob = new Blob([data.blob], { type: "video/mp4" })
          processedBlobRef.current = processedBlob
          setIsProcessing(false)
          setIsComplete(true)
          
          // Resolve any waiting promise
          if (resolveRef.current) {
            resolveRef.current(processedBlob)
            resolveRef.current = null
            rejectRef.current = null
          }
        } else if (data.type === "error") {
          console.error("[v0] Video processing failed:", data.message)
          // Use original blob as fallback
          const originalBlob = originalBlobRef.current || new Blob([data.originalBlob], { type: "video/mp4" })
          processedBlobRef.current = originalBlob
          setProgress({
            stage: "error",
            percent: 0,
            message: data.message,
          })
          setIsProcessing(false)
          setIsComplete(true)
          
          // Resolve with original blob
          if (resolveRef.current) {
            resolveRef.current(originalBlob)
            resolveRef.current = null
            rejectRef.current = null
          }
        }
      }

      workerRef.current.onerror = (error) => {
        console.error("[v0] Worker error:", error)
        const originalBlob = originalBlobRef.current
        if (originalBlob) {
          processedBlobRef.current = originalBlob
        }
        setIsProcessing(false)
        setIsComplete(true)
        
        if (resolveRef.current && originalBlob) {
          resolveRef.current(originalBlob)
          resolveRef.current = null
          rejectRef.current = null
        }
      }
    }

    // Send blob to worker for processing
    inputBlob.arrayBuffer().then((buffer) => {
      workerRef.current?.postMessage(
        {
          type: "process",
          blob: buffer,
          mimeType: inputBlob.type,
        },
        [buffer]
      )
    })
  }, [reset])

  const awaitProcessedVideo = useCallback((): Promise<Blob> => {
    // If already complete, return immediately
    if (isComplete && processedBlobRef.current) {
      return Promise.resolve(processedBlobRef.current)
    }

    // If processing was never started and we have an original, return that
    if (!processingStartedRef.current && originalBlobRef.current) {
      return Promise.resolve(originalBlobRef.current)
    }

    // If processing was started (or is in progress), wait for it to complete
    if (processingStartedRef.current || isProcessing) {
      return new Promise((resolve, reject) => {
        resolveRef.current = resolve
        rejectRef.current = reject
        
        // Timeout after 60 seconds
        setTimeout(() => {
          if (resolveRef.current) {
            console.warn("[v0] Processing timeout, using original video")
            const fallback = originalBlobRef.current || processedBlobRef.current
            if (fallback) {
              resolveRef.current(fallback)
            } else {
              rejectRef.current?.(new Error("Processing timeout and no fallback available"))
            }
            resolveRef.current = null
            rejectRef.current = null
          }
        }, 60000)
      })
    }

    // Fallback to original if available
    if (originalBlobRef.current) {
      return Promise.resolve(originalBlobRef.current)
    }

    return Promise.reject(new Error("No video available"))
  }, [isComplete, isProcessing])

  const getProcessedVideo = useCallback((): Blob | null => {
    return processedBlobRef.current
  }, [])

  return {
    startProcessing,
    awaitProcessedVideo,
    getProcessedVideo,
    progress,
    isProcessing,
    isComplete,
    reset,
  }
}
