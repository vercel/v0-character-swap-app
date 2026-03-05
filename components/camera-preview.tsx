"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { MAX_VIDEO_DURATION, MIN_VIDEO_DURATION } from "@/lib/constants"

interface CameraPreviewProps {
  onVideoRecorded: (videoBlob: Blob, aspectRatio: "9:16" | "16:9" | "fill") => void
  isProcessing: boolean
  progress?: number
  progressMessage?: string
  isError?: boolean
  onBack?: () => void
}

export function CameraPreview({ onVideoRecorded, isProcessing, progress, progressMessage, isError, onBack }: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const originalStreamRef = useRef<MediaStream | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [showFlash, setShowFlash] = useState(false)
  const [showTips, setShowTips] = useState(true)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user")
  // Always use fill aspect ratio
  const aspectRatio = "fill" as const
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isStartingRef = useRef(false)

  const startCamera = useCallback(async () => {
    try {
      // Stop existing stream if any
      if (originalStreamRef.current) {
        originalStreamRef.current.getTracks().forEach(track => track.stop())
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280, min: 340 },
          height: { ideal: 720, min: 340 },
        },
        audio: true,
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        originalStreamRef.current = stream
        setHasPermission(true)
      }
    } catch {
      setHasPermission(false)
    }
  }, [facingMode])

  useEffect(() => {
    startCamera()
    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach((track) => track.stop())
      }
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [startCamera])

  const beginRecording = useCallback(() => {
    if (!videoRef.current || !originalStreamRef.current) return
    
    // Clear any existing timer first
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    // Check if MediaRecorder is available
    if (typeof MediaRecorder === "undefined") {
      alert("Recording is not supported on this browser. Please use Chrome, Firefox, or Safari 14.5+")
      return
    }

    // Detect browser type
    const ua = navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua) || isIOS
    
    // Use canvas for ALL browsers to record mirrored "selfie" video
    // Safari also benefits from this since it produces WebM instead of problematic MP4
    let recordingStream: MediaStream
    
    // Create a canvas to capture mirrored video
    const video = videoRef.current
    const canvas = document.createElement("canvas")
    // Ensure canvas is at least 340px on each side (Kling minimum)
    canvas.width = Math.max(video.videoWidth || 1280, 340)
    canvas.height = Math.max(video.videoHeight || 720, 340)
    const ctx = canvas.getContext("2d")
    
    // Draw frames to canvas — mirror only for front camera (selfie)
    const mirror = facingMode === "user"
    const drawFrame = () => {
      if (ctx && video.readyState >= 2) {
        if (mirror) {
          ctx.save()
          ctx.scale(-1, 1)
          ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height)
          ctx.restore()
        } else {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        }
      }
      if (mediaRecorderRef.current?.state === "recording") {
        requestAnimationFrame(drawFrame)
      }
    }
    
    // Start drawing
    requestAnimationFrame(drawFrame)
    
    // Capture stream from canvas + audio from original stream
    const canvasStream = canvas.captureStream(30)
    const audioTracks = originalStreamRef.current.getAudioTracks()
    if (audioTracks.length > 0) {
      canvasStream.addTrack(audioTracks[0])
    }
    recordingStream = canvasStream

    chunksRef.current = []
    
    let mediaRecorder: MediaRecorder
    let mimeType: string
    
    // Find best supported type
    // Prefer MP4 — KlingAI requires MP4 and modern Chrome supports it natively,
    // avoiding the need for client-side FFmpeg transcoding
    const findSupportedType = () => {
      const preferredOrder = [
        "video/mp4",
        "video/mp4;codecs=avc1",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ]
      
      for (const type of preferredOrder) {
        if (MediaRecorder.isTypeSupported(type)) {
          return type
        }
      }
      return ""
    }
    
    const selectedType = findSupportedType()
    
    try {
      if (selectedType) {
        mimeType = selectedType.split(";")[0]
        mediaRecorder = new MediaRecorder(recordingStream, { 
          mimeType,
          videoBitsPerSecond: 5000000,
        })
      } else {
        mediaRecorder = new MediaRecorder(recordingStream)
        mimeType = mediaRecorder.mimeType || "video/webm"
      }
    } catch (err) {
      console.error("MediaRecorder creation failed:", err)
      try {
        mediaRecorder = new MediaRecorder(recordingStream)
        mimeType = mediaRecorder.mimeType || "video/webm"
      } catch (err2) {
        console.error("MediaRecorder fallback failed:", err2)
        alert("Unable to start recording. Please try a different browser.")
        return
      }
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data)
      }
    }

    mediaRecorder.onerror = (e) => {
      console.error("MediaRecorder error:", e)
    }

    mediaRecorder.onstop = () => {
      const blobType = mimeType.split(";")[0]
      const totalSize = chunksRef.current.reduce((acc, chunk) => acc + chunk.size, 0)
      
      if (chunksRef.current.length === 0 || totalSize === 0) {
        console.error("No data recorded!")
        alert("Recording failed - no data captured. Please try again.")
        return
      }
      
      const blob = new Blob(chunksRef.current, { type: blobType })
      onVideoRecorded(blob, aspectRatio)
    }

    mediaRecorderRef.current = mediaRecorder
    
    // Start recording
    try {
      // No timeslice — recording in one chunk avoids audio discontinuities
      // at chunk boundaries that cause desync/repeat around second 5-6
      mediaRecorder.start()
    } catch (err) {
      console.error("MediaRecorder.start() failed:", err)
      alert("Failed to start recording. Please try again.")
      return
    }
    
    setIsRecording(true)
    setRecordingTime(0)

    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => {
        if (prev >= MAX_VIDEO_DURATION - 1) {
          if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop()
          }
          setIsRecording(false)
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          return MAX_VIDEO_DURATION
        }
        return prev + 1
      })
    }, 1000)
  }, [onVideoRecorded, aspectRatio])

  const startRecording = useCallback(() => {
    if (!videoRef.current?.srcObject || isStartingRef.current) return

    isStartingRef.current = true

    // Flash effect then start recording immediately — no countdown
    setShowFlash(true)
    setTimeout(() => setShowFlash(false), 150)
    setTimeout(() => {
      beginRecording()
      isStartingRef.current = false
    }, 150)
  }, [beginRecording])

  const MIN_RECORDING_SECONDS = MIN_VIDEO_DURATION
  
  const stopRecording = useCallback(() => {
    // Prevent stopping too early - Kling AI requires at least 2s of continuous motion
    if (recordingTime < MIN_RECORDING_SECONDS) {
      return // Don't stop, need more recording time
    }
    
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [recordingTime])

  if (hasPermission === false) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-black/50">Camera access denied</p>
      </div>
    )
  }

  return (
    <div className="relative flex h-full w-full">


      <div className="relative h-full w-full overflow-hidden bg-white">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-contain md:object-cover"
          style={{ transform: facingMode === "user" ? "scaleX(-1)" : undefined }}
        />
        
        {/* Flash effect */}
        {showFlash && (
          <div className="absolute inset-0 z-50 bg-white animate-in fade-in duration-75" />
        )}

        {/* Tips overlay */}
        {showTips && hasPermission && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/90 px-6 backdrop-blur-sm">
            <div className="flex max-w-[300px] flex-col gap-5">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold text-black">
                  Record a short video
                </h2>
                <p className="text-sm text-black/50">
                  We&apos;ll use AI to transform you into your cartoon — move naturally, make expressions!
                </p>
              </div>

              <div className="flex flex-col gap-2.5 rounded-xl bg-black/5 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-black/40">Tips</p>
                <p className="text-sm leading-relaxed text-black">
                  <span className="text-black/30">1.</span> Frame your <span className="font-semibold">head + upper body</span>
                </p>
                <p className="text-sm leading-relaxed text-black">
                  <span className="text-black/30">2.</span> Find <span className="font-semibold">good lighting</span> on your face
                </p>
                <p className="text-sm leading-relaxed text-black">
                  <span className="text-black/30">3.</span> Record <span className="font-semibold">{MIN_VIDEO_DURATION}-{MAX_VIDEO_DURATION} seconds</span> of movement
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Flip camera button */}
        {!isRecording && !showTips && hasPermission && (
          <button
            onClick={() => setFacingMode(f => f === "user" ? "environment" : "user")}
            className="absolute right-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-colors active:bg-black/60 md:hidden"
            aria-label="Flip camera"
          >
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
            </svg>
          </button>
        )}

        {/* Change character button */}
        {onBack && !isRecording && !showTips && (
          <button
            onClick={onBack}
            className="absolute left-3 top-3 z-30 flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur-sm transition-colors active:bg-black/60"
          >
            <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm text-white">Change cartoon</span>
          </button>
        )}

        {isRecording && (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/40 px-2.5 py-1.5 backdrop-blur-sm md:left-4 md:top-4">
            <span className={`h-2 w-2 rounded-full ${recordingTime >= MAX_VIDEO_DURATION - 6 ? "bg-amber-500" : "bg-red-500"} animate-pulse`} />
            <span className={`text-[11px] tabular-nums md:text-xs ${recordingTime >= MAX_VIDEO_DURATION - 6 ? "text-amber-400" : "text-white"}`}>
              {recordingTime}/{MAX_VIDEO_DURATION}s
            </span>
          </div>
        )}
        
        {/* Minimum duration indicator - show for first 3 seconds */}
        {isRecording && recordingTime < MIN_RECORDING_SECONDS && (
          <div className="absolute inset-x-0 top-14 flex justify-center md:top-16">
            <div className="rounded-lg bg-neutral-100 px-4 py-2 shadow-lg backdrop-blur-sm">
              <span className="text-sm text-black">
                Min. <span className="font-semibold text-black">{MIN_RECORDING_SECONDS - recordingTime}s</span> more
              </span>
            </div>
          </div>
        )}
        
        {/* Warning when approaching max time - show last 6 seconds */}
        {isRecording && recordingTime >= MAX_VIDEO_DURATION - 6 && (
          <div className="absolute inset-x-0 top-14 flex justify-center md:top-16">
            <div className="animate-pulse rounded-lg bg-amber-500 px-4 py-2 shadow-lg">
              <span className="text-sm font-semibold text-black">
                {Math.max(1, MAX_VIDEO_DURATION - 1 - recordingTime)}s left
              </span>
            </div>
          </div>
        )}

        {/* Record button - positioned above mobile bottom sheet (100px peek) */}
        <div className="absolute bottom-24 left-1/2 z-40 -translate-x-1/2 md:bottom-6">
          {/* OK button to dismiss tips */}
          {showTips && hasPermission && (
            <button
              onClick={() => setShowTips(false)}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-black font-sans text-[15px] font-semibold text-white transition-all hover:scale-105 hover:bg-gray-800 active:scale-95 md:h-[72px] md:w-[72px] md:text-[16px]"
            >
              OK
            </button>
          )}
          
          {!isRecording && !isProcessing && !showTips && (
            <button
              onClick={startRecording}
              className="flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-neutral-300 bg-transparent transition-all hover:scale-105 active:scale-95 md:h-[72px] md:w-[72px]"
              aria-label="Start recording"
            >
              <span className="h-[52px] w-[52px] rounded-full bg-red-500 md:h-[58px] md:w-[58px]" />
            </button>
          )}

          {isRecording && (
            <button
              onClick={stopRecording}
              disabled={recordingTime < MIN_RECORDING_SECONDS}
              className={`flex h-16 w-16 items-center justify-center rounded-full border-[3px] transition-all md:h-[72px] md:w-[72px] ${
                recordingTime < MIN_RECORDING_SECONDS
                  ? "cursor-not-allowed border-neutral-200 opacity-50"
                  : "border-neutral-300 bg-transparent hover:scale-105 active:scale-95"
              }`}
              aria-label={recordingTime < MIN_RECORDING_SECONDS ? `Recording minimum ${MIN_RECORDING_SECONDS - recordingTime}s more` : "Stop recording"}
            >
              <span className={`h-6 w-6 rounded-[4px] md:h-7 md:w-7 ${recordingTime < MIN_RECORDING_SECONDS ? "bg-neutral-400" : "bg-white"}`} />
            </button>
          )}

          {isProcessing && !progress && (
            <div className="flex h-16 w-16 items-center justify-center md:h-[72px] md:w-[72px]">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-600 border-t-white md:h-9 md:w-9" />
            </div>
          )}
        </div>

  {/* Progress overlay */}
  {isProcessing && progress !== undefined && (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
  <div className="flex w-full max-w-[200px] flex-col items-center gap-4 px-6">
  {isError ? (
    <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ) : null}
  <p className={`font-sans text-[15px] font-medium ${isError ? "text-red-400" : "text-white"}`}>
  {progressMessage || "Generating..."}
  </p>
  
  {/* Progress bar */}
  {!isError && (
  <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-200">
  <div
  className="h-full rounded-full bg-black transition-all duration-500 ease-out"
  style={{ width: `${Math.round(progress)}%` }}
  />
              </div>
              )}
              {/* Percentage */}
              {!isError && (
              <p className="text-sm tabular-nums text-neutral-300">
                {Math.round(progress)}%
              </p>
              )}
            </div>
          </div>
        )}


      </div>
    </div>
  )
}
