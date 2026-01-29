import type { Character } from "./types"

// ===========================================
// Video Constraints
// ===========================================

export const MAX_VIDEO_SIZE = 50 * 1024 * 1024 // 50MB
export const MAX_VIDEO_DURATION = 30 // seconds - fal.ai limit
export const MIN_VIDEO_DURATION = 3 // seconds - fal.ai requirement

// ===========================================
// Image Constraints
// ===========================================

export const MIN_IMAGE_DIMENSION = 340 // pixels - fal.ai minimum

// ===========================================
// Default Characters
// ===========================================

export const DEFAULT_CHARACTERS: Character[] = [
  { id: 1, src: "/characters/leodc.png", name: "Django" },
  { id: 2, src: "/characters/aliens.png", name: "Aliens" },
  { id: 3, src: "/characters/dolly.png", name: "Dolly Parton" },
  { id: 4, src: "/characters/aubrey.png", name: "Aubrey Plaza" },
  { id: 5, src: "/characters/donald.png", name: "Donald Trump" },
]

// Alias for backwards compatibility
export const defaultCharacters = DEFAULT_CHARACTERS

// ===========================================
// Storage Keys
// ===========================================

export const STORAGE_KEYS = {
  HIDDEN_CHARACTERS: "hiddenDefaultCharacters",
  PENDING_CHARACTER: "pendingCharacter",
  PENDING_VIDEO_URL: "pendingVideoUrl",
  PENDING_UPLOADED: "pendingUploaded",
  PENDING_AUTO_SUBMIT: "pendingAutoSubmit",
  PENDING_ASPECT_RATIO: "pendingAspectRatio",
} as const

// ===========================================
// Custom Character ID Offset
// ===========================================

// Offset added to database IDs to avoid collision with default characters
export const CUSTOM_CHARACTER_ID_OFFSET = 1000
