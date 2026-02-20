"use client"

export interface PipOptions {
  mainVideoUrl: string
  pipVideoUrl?: string | null
  pipPosition?: "bottom-right" | "bottom-left" | "top-right" | "top-left"
  pipScale?: number // 0.0 to 1.0, default 0.25
  pipAspectRatio?: "9:16" | "16:9" | "fill" // aspect ratio of pip video
  onProgress?: (progress: number) => void
  addWatermark?: boolean
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    video.crossOrigin = "anonymous"
    video.muted = true
    video.playsInline = true
    video.preload = "auto"
    video.onloadeddata = () => resolve(video)
    video.onerror = () => reject(new Error(`Failed to load video: ${url}`))
    video.src = url
  })
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export interface PipResult {
  blob: Blob
  extension: string
}

export async function createPipVideoClient({
  mainVideoUrl,
  pipVideoUrl,
  pipPosition = "bottom-right",
  pipScale = 0.25,
  onProgress,
  addWatermark = true,
}: PipOptions): Promise<PipResult> {
  onProgress?.(0.05)

  // Load videos
  const mainVideo = await loadVideo(mainVideoUrl)
  onProgress?.(0.2)

  const pipVideo = pipVideoUrl ? await loadVideo(pipVideoUrl) : null
  onProgress?.(0.3)

  // Set up canvas at the main video's native resolution
  const canvas = document.createElement("canvas")
  canvas.width = mainVideo.videoWidth
  canvas.height = mainVideo.videoHeight
  const ctx = canvas.getContext("2d")!

  // Calculate PiP dimensions and position
  const padding = 20
  const cornerRadius = 12
  let pipW = 0
  let pipH = 0
  let pipX = 0
  let pipY = 0

  if (pipVideo) {
    // PiP height is pipScale of main video height
    pipH = Math.round(canvas.height * pipScale)
    pipW = Math.round(pipH * (pipVideo.videoWidth / pipVideo.videoHeight))

    const positions = {
      "bottom-right": { x: canvas.width - pipW - padding, y: canvas.height - pipH - padding },
      "bottom-left": { x: padding, y: canvas.height - pipH - padding },
      "top-right": { x: canvas.width - pipW - padding, y: padding },
      "top-left": { x: padding, y: padding },
    }
    const pos = positions[pipPosition]
    pipX = pos.x
    pipY = pos.y
  }

  // Watermark config
  const watermarkText = "created with faceswapvid.vercel.app"
  const fontSize = Math.max(14, Math.round(canvas.height * 0.025))

  // Use MediaRecorder to capture the canvas as video
  const stream = canvas.captureStream(30)

  // Try MP4 first (Safari), then WebM (Chrome/Firefox)
  const codecs = [
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ]
  const mimeType = codecs.find((c) => MediaRecorder.isTypeSupported(c)) || "video/webm"

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  })

  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const recordingDone = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }))
    }
  })

  // Start recording and play videos
  recorder.start()
  mainVideo.currentTime = 0
  if (pipVideo) pipVideo.currentTime = 0

  const playPromises: Promise<void>[] = [mainVideo.play()]
  if (pipVideo) playPromises.push(pipVideo.play())
  await Promise.all(playPromises)

  onProgress?.(0.4)

  // Draw frames until main video ends
  const duration = mainVideo.duration
  await new Promise<void>((resolve) => {
    function drawFrame() {
      if (mainVideo.ended || mainVideo.paused) {
        recorder.stop()
        resolve()
        return
      }

      // Draw main video
      ctx.drawImage(mainVideo, 0, 0, canvas.width, canvas.height)

      // Draw PiP with rounded corners
      if (pipVideo && !pipVideo.ended) {
        ctx.save()
        drawRoundedRect(ctx, pipX, pipY, pipW, pipH, cornerRadius)
        ctx.clip()
        ctx.drawImage(pipVideo, pipX, pipY, pipW, pipH)
        ctx.restore()

        // Draw subtle border around PiP
        ctx.save()
        drawRoundedRect(ctx, pipX, pipY, pipW, pipH, cornerRadius)
        ctx.strokeStyle = "rgba(255,255,255,0.3)"
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.restore()
      }

      // Draw watermark
      if (addWatermark) {
        ctx.save()
        ctx.font = `${fontSize}px monospace`
        ctx.fillStyle = "rgba(255,255,255,0.7)"
        ctx.shadowColor = "rgba(0,0,0,0.5)"
        ctx.shadowBlur = 4
        ctx.shadowOffsetX = 1
        ctx.shadowOffsetY = 1
        ctx.fillText(watermarkText, 20, canvas.height - 20)
        ctx.restore()
      }

      // Report progress
      if (duration > 0) {
        const p = 0.4 + (mainVideo.currentTime / duration) * 0.5
        onProgress?.(Math.min(p, 0.9))
      }

      requestAnimationFrame(drawFrame)
    }
    requestAnimationFrame(drawFrame)
  })

  onProgress?.(0.95)
  const blob = await recordingDone
  onProgress?.(1.0)
  const extension = mimeType.includes("mp4") ? "mp4" : "webm"
  return { blob, extension }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
