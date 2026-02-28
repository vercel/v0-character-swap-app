import type { Character } from "./types"

// ===========================================
// Video Constraints
// ===========================================

export const MAX_VIDEO_SIZE = 50 * 1024 * 1024 // 50MB
export const MAX_VIDEO_DURATION = 30 // seconds - KlingAI limit via AI Gateway
export const MIN_VIDEO_DURATION = 4 // seconds - KlingAI requires >=3s, buffer for MP4 conversion

// ===========================================
// Image Constraints
// ===========================================

export const MIN_IMAGE_DIMENSION = 340 // pixels - KlingAI minimum

// ===========================================
// Default Characters
// ===========================================

export const DEFAULT_CHARACTERS: Character[] = [
  { id: 1, src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/firefighter.png", name: "Firefighter" },
  { id: 2, src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/vampire-girl.png", name: "Vampire Girl" },
  { id: 3, src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/hacker-grandma.png", name: "Hacker Grandma" },
  { id: 4, src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/alien-chef.png", name: "Alien Chef" },
  { id: 5, src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/disco-robot.png", name: "Disco Robot" },
  { id: 6, src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/grumpy-wizard.png", name: "Grumpy Wizard" },
  { id: 7, src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/knight-princess.png", name: "Knight Princess" },
  { id: 8, src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/space-pirate.png", name: "Space Pirate" },
  { id: 9, src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/wise-king.png", name: "Wise King" },
  { id: 10, src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/fairy-queen.png", name: "Fairy Queen" },
  { id: 11, src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/warrior-queen.png", name: "Warrior Queen" },
  { id: 12, src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/dark-elf-empress.png", name: "Dark Elf Empress" },
]

// ===========================================
// Storage Keys
// ===========================================

export const STORAGE_KEYS = {
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
