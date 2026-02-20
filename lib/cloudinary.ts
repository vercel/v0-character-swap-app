/**
 * Cloudinary video compositing via fetch URL API.
 *
 * Uses "fetch" delivery type: Cloudinary downloads the video from the
 * original URL on first request, applies transformations, and caches on CDN.
 *
 * Setup (one-time):
 * 1. Cloudinary Dashboard → Settings → Security → Allowed fetch domains:
 *    add 7zjbnnvanyvles15.public.blob.vercel-storage.com
 * 2. Env var: CLOUDINARY_CLOUD_NAME
 */

const WATERMARK_TEXT = "created with faceswapvid.vercel.app"

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

interface CompositeVideoOptions {
  /** Full Vercel Blob URL of the main (result) video */
  mainVideoUrl: string
  /** Full Vercel Blob URL of the PiP video (user's recording), or null */
  pipVideoUrl: string | null
  /** Whether to add PiP overlay */
  showPip: boolean
  /** Watermark text (defaults to site URL) */
  watermark?: string
  /** Cloudinary cloud name */
  cloudName: string
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
  watermark = WATERMARK_TEXT,
  cloudName,
}: CompositeVideoOptions): string {
  validateBlobUrl(mainVideoUrl)

  const transformations: string[] = []

  // PiP video overlay using fetch source (base64-encoded URL)
  if (showPip && pipVideoUrl) {
    validateBlobUrl(pipVideoUrl)
    const b64Url = base64UrlEncode(pipVideoUrl)
    transformations.push(
      `l_video:fetch:${b64Url},w_0.2,fl_relative,r_12,g_south_east,x_20,y_20`
    )
  }

  // Watermark text overlay
  if (watermark) {
    const encodedText = watermark.replace(/ /g, "%20")
    transformations.push(
      `l_text:courier_18:${encodedText},co_rgb:FFFFFFB3,g_south_west,x_20,y_20`
    )
  }

  const transformStr = transformations.length > 0
    ? transformations.join("/") + "/"
    : ""

  // fetch delivery type: pass the full source URL at the end
  const encodedMainUrl = encodeURIComponent(mainVideoUrl)
  return `https://res.cloudinary.com/${cloudName}/video/fetch/${transformStr}${encodedMainUrl}`
}
