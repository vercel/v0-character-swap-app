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
  { id: 1, name: "Firefighter", src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/firefighter-16x9.png", sources: { "9:16": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/firefighter-9x16.png", "1:1": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/firefighter-1x1.png", "16:9": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/firefighter-16x9.png" } },
  { id: 2, name: "Vampire Girl", src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/vampire-girl-16x9.png", sources: { "9:16": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/vampire-girl-9x16.png", "1:1": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/vampire-girl-1x1.png", "16:9": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/vampire-girl-16x9.png" } },
  { id: 5, name: "Disco Robot", src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/disco-robot-16x9.png", sources: { "9:16": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/disco-robot-9x16.png", "1:1": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/disco-robot-1x1.png", "16:9": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/disco-robot-16x9.png" } },
  { id: 4, name: "Alien Chef", src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/alien-chef-16x9.png", sources: { "9:16": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/alien-chef-9x16.png", "1:1": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/alien-chef-1x1.png", "16:9": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/alien-chef-16x9.png" } },
  { id: 3, name: "Hacker Grandma", src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/hacker-grandma-16x9.png", sources: { "9:16": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/hacker-grandma-9x16.png", "1:1": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/hacker-grandma-1x1.png", "16:9": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/hacker-grandma-16x9.png" } },
  { id: 6, name: "Grumpy Wizard", src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/grumpy-wizard-16x9.png", sources: { "9:16": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/grumpy-wizard-9x16.png", "1:1": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/grumpy-wizard-1x1.png", "16:9": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/grumpy-wizard-16x9.png" } },
  { id: 7, name: "Knight Princess", src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/knight-princess-16x9.png", sources: { "9:16": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/knight-princess-9x16.png", "1:1": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/knight-princess-1x1.png", "16:9": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/knight-princess-16x9.png" } },
  { id: 8, name: "Space Pirate", src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/space-pirate-16x9.png", sources: { "9:16": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/space-pirate-9x16.png", "1:1": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/space-pirate-1x1.png", "16:9": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/space-pirate-16x9.png" } },
  { id: 9, name: "Wise King", src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/wise-king-16x9.png", sources: { "9:16": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/wise-king-9x16.png", "1:1": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/wise-king-1x1.png", "16:9": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/wise-king-16x9.png" } },
  { id: 10, name: "Fairy Queen", src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/fairy-queen-16x9.png", sources: { "9:16": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/fairy-queen-9x16.png", "1:1": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/fairy-queen-1x1.png", "16:9": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/fairy-queen-16x9.png" } },
  { id: 11, name: "Warrior Queen", src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/warrior-queen-16x9.png", sources: { "9:16": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/warrior-queen-9x16.png", "1:1": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/warrior-queen-1x1.png", "16:9": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/warrior-queen-16x9.png" } },
  { id: 12, name: "Dark Elf Empress", src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/dark-elf-empress-16x9.png", sources: { "9:16": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/dark-elf-empress-9x16.png", "1:1": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/dark-elf-empress-1x1.png", "16:9": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/dark-elf-empress-16x9.png" } },
  { id: 13, name: "Pirate Cat", src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/pirate-cat-16x9.png", sources: { "9:16": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/pirate-cat-9x16.png", "1:1": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/pirate-cat-1x1.png", "16:9": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/pirate-cat-16x9.png" } },
  { id: 14, name: "JD Cartoon", src: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/jd-cartoon-16x9.png", sources: { "9:16": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/jd-cartoon-9x16.png", "1:1": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/jd-cartoon-1x1.png", "16:9": "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/jd-cartoon-16x9.png" } },
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
