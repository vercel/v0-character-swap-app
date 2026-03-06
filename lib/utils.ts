import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type AspectRatio = "9:16" | "1:1" | "16:9"

const ASPECT_RATIO_DIMENSIONS: Record<AspectRatio, { w: number; h: number }> = {
  "9:16": { w: 720, h: 1280 },
  "1:1": { w: 1024, h: 1024 },
  "16:9": { w: 1280, h: 720 },
}

/**
 * Get the character image for a given aspect ratio.
 * If the character has pre-generated sources for that ratio, use it directly.
 * Otherwise fall back to Cloudinary c_fill,g_north crop.
 */
export function characterImageForAspectRatio(
  src: string,
  aspectRatio: AspectRatio,
  sources?: { "9:16"?: string; "1:1"?: string; "16:9"?: string },
): string {
  // Pre-generated image for this ratio — use it directly
  if (sources?.[aspectRatio]) return sources[aspectRatio]
  // Fallback: Cloudinary crop
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (!cloudName) return src
  const { w, h } = ASPECT_RATIO_DIMENSIONS[aspectRatio]
  if (src.includes(".public.blob.vercel-storage.com")) {
    return `https://res.cloudinary.com/${cloudName}/image/fetch/w_${w},h_${h},c_fill,g_north,f_webp,q_90/${encodeURIComponent(src)}`
  }
  if (src.includes("res.cloudinary.com")) {
    return src.replace(/\/image\/(fetch|upload)\/[^/]+\//, `/image/$1/w_${w},h_${h},c_fill,g_north,f_webp,q_90/`)
  }
  return src
}

/**
 * Detect aspect ratio from an image URL
 * Returns common aspect ratio strings: "9:16", "3:4", "1:1", "4:3", "16:9"
 */
export function detectImageAspectRatio(src: string): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve("1:1")
      return
    }
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const ratio = img.width / img.height
      if (ratio < 0.65) {
        resolve("9:16")
      } else if (ratio >= 0.65 && ratio < 0.85) {
        resolve("3:4")
      } else if (ratio >= 0.85 && ratio < 1.15) {
        resolve("1:1")
      } else if (ratio >= 1.15 && ratio < 1.5) {
        resolve("4:3")
      } else {
        resolve("16:9")
      }
    }
    img.onerror = () => resolve("1:1")
    img.src = src
  })
}

/**
 * Detect video aspect ratio from dimensions
 * Returns: "9:16" (portrait), "16:9" (landscape), or "fill" (square-ish)
 */
export function detectVideoAspectRatio(width: number, height: number): "9:16" | "16:9" | "fill" {
  const ratio = width / height
  if (ratio < 0.7) {
    return "9:16" // Portrait
  } else if (ratio > 1.4) {
    return "16:9" // Landscape
  }
  return "fill" // Square-ish
}
