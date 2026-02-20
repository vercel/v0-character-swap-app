"use client"

export interface PipOptions {
  mainVideoUrl: string
  pipVideoUrl?: string | null
  pipPosition?: "bottom-right" | "bottom-left" | "top-right" | "top-left"
  pipScale?: number
  pipAspectRatio?: "9:16" | "16:9" | "fill"
  onProgress?: (progress: number) => void
  addWatermark?: boolean
}

function loadVideo(url: string, muted: boolean): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    video.crossOrigin = "anonymous"
    video.muted = muted
    video.playsInline = true
    video.preload = "auto"
    video.onloadeddata = () => resolve(video)
    video.onerror = () => reject(new Error(`Failed to load video: ${url}`))
    video.src = url
  })
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
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

  // Load main video UN-muted so captureStream() includes audio tracks
  const mainVideo = await loadVideo(mainVideoUrl, false)
  onProgress?.(0.2)

  const pipVideo = pipVideoUrl ? await loadVideo(pipVideoUrl, true) : null
  onProgress?.(0.3)

  // Canvas for compositing at native resolution
  const canvas = document.createElement("canvas")
  canvas.width = mainVideo.videoWidth
  canvas.height = mainVideo.videoHeight
  const ctx = canvas.getContext("2d")!

  // PiP dimensions
  const padding = 20
  const cornerRadius = 12
  let pipW = 0, pipH = 0, pipX = 0, pipY = 0

  if (pipVideo) {
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

  const watermarkText = "created with faceswapvid.vercel.app"
  const fontSize = Math.max(14, Math.round(canvas.height * 0.025))

  // Build combined stream: canvas video track + main video audio tracks
  const canvasStream = canvas.captureStream(30)
  const combinedStream = new MediaStream()

  // Add canvas video track (composited frames)
  canvasStream.getVideoTracks().forEach(t => combinedStream.addTrack(t))

  // Add audio tracks from the main video via captureStream()
  // This captures decoded audio directly from the video element
  try {
    const mainStream = (mainVideo as any).captureStream() as MediaStream
    mainStream.getAudioTracks().forEach(t => combinedStream.addTrack(t))
  } catch {
    // captureStream not available or no audio — continue without
  }

  // Pick best codec
  const codecs = [
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ]
  const mimeType = codecs.find(c => MediaRecorder.isTypeSupported(c)) || "video/webm"

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  })

  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const recordingDone = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
  })

  // Start recording, then play videos from beginning
  recorder.start()
  mainVideo.currentTime = 0
  if (pipVideo) pipVideo.currentTime = 0

  // Must play main video for captureStream audio to flow
  mainVideo.volume = 0.01 // near-silent so user doesn't hear double audio
  const playPromises: Promise<void>[] = [mainVideo.play()]
  if (pipVideo) playPromises.push(pipVideo.play())
  await Promise.all(playPromises)

  onProgress?.(0.4)

  const duration = mainVideo.duration
  await new Promise<void>((resolve) => {
    function drawFrame() {
      if (mainVideo.ended || mainVideo.paused) {
        recorder.stop()
        resolve()
        return
      }

      ctx.drawImage(mainVideo, 0, 0, canvas.width, canvas.height)

      if (pipVideo && !pipVideo.ended) {
        ctx.save()
        drawRoundedRect(ctx, pipX, pipY, pipW, pipH, cornerRadius)
        ctx.clip()
        ctx.drawImage(pipVideo, pipX, pipY, pipW, pipH)
        ctx.restore()

        ctx.save()
        drawRoundedRect(ctx, pipX, pipY, pipW, pipH, cornerRadius)
        ctx.strokeStyle = "rgba(255,255,255,0.3)"
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.restore()
      }

      if (addWatermark) {
        ctx.save()
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = "high"
        ctx.font = `500 ${fontSize}px "Geist Mono", ui-monospace, SFMono-Regular, monospace`
        ctx.fillStyle = "rgba(255,255,255,0.7)"
        ctx.shadowColor = "rgba(0,0,0,0.5)"
        ctx.shadowBlur = 4
        ctx.shadowOffsetX = 1
        ctx.shadowOffsetY = 1
        ctx.fillText(watermarkText, 20, canvas.height - 20)
        ctx.restore()
      }

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
