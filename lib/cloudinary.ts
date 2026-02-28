/**
 * Cloudinary video compositing via fetch URL API.
 *
 * Uses "fetch" delivery type: Cloudinary downloads the video from the
 * original URL on first request, applies transformations, and caches on CDN.
 *
 * Setup (one-time):
 * 1. Cloudinary Dashboard → Settings → Security → Allowed fetch domains:
 *    add 7zjbnnvanyvles15.public.blob.vercel-storage.com
 * 2. Env vars: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 */

import { createHash } from "crypto"

const WATERMARK_TEXT = "created with v0faceswap.app"

function validateBlobUrl(url: string): void {
  const parsed = new URL(url)
  if (!parsed.hostname.endsWith(".public.blob.vercel-storage.com")) {
    throw new Error("URL is not a Vercel Blob URL")
  }
}

/**
 * Base64url-encode a URL for use as a Cloudinary fetch overlay source.
 * Cloudinary fetch overlays require the source URL to be base64-encoded.
 */
function base64UrlEncode(url: string): string {
  // btoa works server-side in Node 16+ and in browsers
  const b64 = Buffer.from(url).toString("base64")
  // Make URL-safe: replace + with -, / with _, remove trailing =
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/**
 * Builds a Cloudinary fetch URL that converts any video (webm, mov, etc.) to MP4.
 * Used to convert raw user recordings before passing to Kling.
 */
export function buildMp4ConversionUrl(blobUrl: string, cloudName: string): string {
  validateBlobUrl(blobUrl)
  const encodedUrl = encodeURIComponent(blobUrl)
  return `https://res.cloudinary.com/${cloudName}/video/fetch/f_mp4,vc_h264,ac_aac,eo_auto/${encodedUrl}`
}

interface CompositeVideoOptions {
  /** Full Vercel Blob URL of the main (result) video */
  mainVideoUrl: string
  /** Full Vercel Blob URL of the PiP video (user's recording), or null */
  pipVideoUrl: string | null
  /** Whether to add PiP overlay */
  showPip: boolean
  /** Aspect ratio of the PiP video */
  pipAspectRatio?: "9:16" | "16:9" | "fill"
  /** Watermark text (defaults to site URL) */
  watermark?: string
  /** Cloudinary cloud name */
  cloudName: string
  /** Force browser download instead of inline playback */
  attachment?: boolean
}

/**
 * Builds the transformation string for composite video (PiP + watermark).
 * Shared between fetch URL builder and eager preparation.
 */
function buildCompositeTransformation(options: {
  pipVideoUrl: string | null
  showPip: boolean
  pipAspectRatio?: "9:16" | "16:9" | "fill"
  watermark?: string
  attachment?: boolean
}): string {
  const { pipVideoUrl, showPip, pipAspectRatio = "fill", watermark = WATERMARK_TEXT, attachment = false } = options
  const transformations: string[] = []

  if (showPip && pipVideoUrl) {
    validateBlobUrl(pipVideoUrl)
    const b64Url = base64UrlEncode(pipVideoUrl)
    const pipSize = pipAspectRatio === "9:16" ? "w_0.12" : "w_0.2"
    transformations.push(
      `l_video:fetch:${b64Url},${pipSize},fl_relative,ac_none,r_12,g_south_east,x_20,y_20`
    )
  }

  if (watermark) {
    const encodedText = watermark.replace(/ /g, "%20")
    transformations.push(
      `l_text:GeistMono-Regular.ttf_18:${encodedText},co_rgb:FFFFFFB3,g_south_west,x_20,y_20`
    )
  }

  if (attachment) {
    transformations.push("fl_attachment")
  }

  return transformations.join("/")
}

/**
 * Builds a Cloudinary video URL with optional PiP overlay and watermark.
 * Uses "fetch" delivery type — no auto-upload mapping needed.
 * Audio is preserved automatically.
 */
export function buildCompositeVideoUrl({
  mainVideoUrl,
  pipVideoUrl,
  showPip,
  pipAspectRatio = "fill",
  watermark = WATERMARK_TEXT,
  cloudName,
  attachment = false,
}: CompositeVideoOptions): string {
  validateBlobUrl(mainVideoUrl)

  const transformStr = buildCompositeTransformation({ pipVideoUrl, showPip, pipAspectRatio, watermark, attachment })
  const prefix = transformStr ? transformStr + "/" : ""
  const encodedMainUrl = encodeURIComponent(mainVideoUrl)
  return `https://res.cloudinary.com/${cloudName}/video/fetch/${prefix}${encodedMainUrl}`
}

// ============================================
// Eager preparation via Cloudinary Upload API
// ============================================

function signCloudinaryParams(params: Record<string, string>, apiSecret: string): string {
  const sorted = Object.keys(params).sort()
  const toSign = sorted.map(k => `${k}=${params[k]}`).join("&") + apiSecret
  return createHash("sha1").update(toSign).digest("hex")
}

/**
 * Deterministic public_id from a Vercel Blob URL.
 * Used to check if a video has been uploaded to Cloudinary.
 */
export function blobUrlToPublicId(blobUrl: string): string {
  const hash = createHash("sha256").update(blobUrl).digest("hex").slice(0, 16)
  return `faceswap/${hash}`
}

/**
 * Builds a Cloudinary upload-based delivery URL (vs fetch-based).
 * Used for videos that have been uploaded via prepareCompositeDownload.
 */
export function buildUploadCompositeUrl(options: {
  publicId: string
  pipVideoUrl: string | null
  showPip: boolean
  pipAspectRatio?: "9:16" | "16:9" | "fill"
  cloudName: string
  attachment?: boolean
}): string {
  const { publicId, cloudName, attachment = false, ...rest } = options
  const transformStr = buildCompositeTransformation({ ...rest, attachment })
  const prefix = transformStr ? transformStr + "/" : ""
  return `https://res.cloudinary.com/${cloudName}/video/upload/${prefix}${publicId}.mp4`
}

interface PrepareCompositeOptions {
  mainVideoUrl: string
  sourceVideoUrl: string | null
  sourceVideoAspectRatio?: "9:16" | "16:9" | "fill"
  cloudName: string
  apiKey: string
  apiSecret: string
}

/**
 * Uploads the result video to Cloudinary and triggers eager_async processing
 * for both download variants (watermark-only and watermark+PiP).
 *
 * Upload-based videos don't have the "too large to process synchronously"
 * limit that fetch-based videos have.
 */
export async function prepareCompositeDownload({
  mainVideoUrl,
  sourceVideoUrl,
  sourceVideoAspectRatio = "fill",
  cloudName,
  apiKey,
  apiSecret,
}: PrepareCompositeOptions): Promise<string> {
  const publicId = blobUrlToPublicId(mainVideoUrl)

  // Build eager transformations for both variants
  const eagerTransformations: string[] = []

  // Variant 1: watermark only (no PiP)
  const watermarkOnly = buildCompositeTransformation({ pipVideoUrl: null, showPip: false })
  if (watermarkOnly) eagerTransformations.push(watermarkOnly)

  // Variant 2: watermark + PiP (if source video available)
  if (sourceVideoUrl) {
    const withPip = buildCompositeTransformation({
      pipVideoUrl: sourceVideoUrl,
      showPip: true,
      pipAspectRatio: sourceVideoAspectRatio,
    })
    if (withPip) eagerTransformations.push(withPip)
  }

  const eager = eagerTransformations.join("|")
  const timestamp = Math.floor(Date.now() / 1000).toString()

  // resource_type goes in the URL path, NOT in signed params
  const params: Record<string, string> = {
    eager,
    eager_async: "true",
    overwrite: "false",
    public_id: publicId,
    timestamp,
  }

  const signature = signCloudinaryParams(params, apiSecret)

  const formData = new FormData()
  formData.append("file", mainVideoUrl)
  for (const [k, v] of Object.entries(params)) {
    formData.append(k, v)
  }
  formData.append("api_key", apiKey)
  formData.append("signature", signature)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
    { method: "POST", body: formData },
  )

  if (!res.ok) {
    const text = await res.text()
    // "already exists" is fine — video was already uploaded
    if (!text.includes("already exists")) {
      throw new Error(`Cloudinary upload failed: ${res.status} ${text}`)
    }
  }

  return publicId
}
