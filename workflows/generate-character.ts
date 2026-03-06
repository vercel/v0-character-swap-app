/**
 * Durable workflow for character image generation using Grok.
 *
 * Flow:
 * 1. Generate a single 1:1 image with Grok (square is the safest base for cropping)
 * 2. Upload to Vercel Blob
 * 3. Use the same URL for all 3 aspect ratios — Cloudinary crops with g_north
 *
 * The prompt ensures the character is centered with enough headroom and
 * background padding so Cloudinary's c_fill crop looks good at any ratio.
 *
 * Steps auto-retry on transient errors (network, 500, rate limits).
 */

export interface GenerateCharacterInput {
  prompt: string
  gatewayApiKey?: string
}

export interface GenerateCharacterResult {
  imageUrl: string
  sources: {
    "9:16": string
    "1:1": string
    "16:9": string
  }
}

const PROMPT_TEMPLATE = (prompt: string) =>
  `A Pixar-quality 3D animated character: ${prompt}.

RENDERING:
- Pixar/Disney 3D animation style — smooth rounded shapes, soft subsurface scattering on skin, big expressive eyes, slightly exaggerated proportions
- Highly detailed skin textures with visible pores, fine peach fuzz, subtle freckles or blemishes for realism
- Detailed fabric textures — visible stitching, wool fibers, leather grain, wrinkles in clothing
- Fur and hair rendered strand-by-strand with realistic sheen and volume
- Rich environmental background that matches the character's theme (e.g. kitchen for a chef, ocean for a pirate, forest for an elf) — NOT a plain gradient
- Cinematic lighting with depth of field, rim lighting, and ambient occlusion
- The overall image should look like a still frame from a Pixar feature film

COMPOSITION (critical — follow exactly):
- Wide establishing shot with the character small in the center
- Character's head occupies only about 20-25% of the total image width
- MASSIVE amounts of background visible on all sides — at least 35-40% padding on each side
- The character is a small figure in a big scenic environment
- Think "wide movie still where the character is in the middle of a big world"
- The character's body ends around the waist — no legs visible

CHARACTER:
- Clearly fictional cartoon character, never photorealistic or a real person
- Facing the viewer directly with a friendly expression
- Face completely unobstructed — no sunglasses, masks, or hair covering the face
- Sharp focus on facial features with even, soft lighting`

// ============================================
// WORKFLOW
// ============================================

export async function generateCharacterWorkflow(input: GenerateCharacterInput): Promise<GenerateCharacterResult> {
  "use workflow"

  const { prompt, gatewayApiKey } = input

  // Generate a single 16:9 image — wide gives the most horizontal content for cropping to portrait
  const base64 = await generateImage(PROMPT_TEMPLATE(prompt), "16:9", gatewayApiKey)

  // Upload once — same image used for all ratios (Cloudinary crops per ratio)
  const url = await uploadToBlob(base64, "square")

  return {
    imageUrl: url,
    sources: {
      "16:9": url,
    },
  }
}

// ============================================
// STEP FUNCTIONS
// ============================================

async function generateImage(
  prompt: string,
  aspectRatio: string,
  gatewayApiKey?: string,
): Promise<string> {
  "use step"

  const { experimental_generateImage, createGateway } = await import("ai")

  const gateway = createGateway({
    ...(gatewayApiKey ? { apiKey: gatewayApiKey } : {}),
  })

  const result = await experimental_generateImage({
    model: gateway.imageModel("xai/grok-imagine-image"),
    prompt,
    providerOptions: { xai: { aspect_ratio: aspectRatio, resolution: "2k" } },
  })

  return result.image.base64
}

async function uploadToBlob(base64: string, suffix: string): Promise<string> {
  "use step"

  const { put } = await import("@vercel/blob")

  const buffer = Buffer.from(base64, "base64")
  const filename = `reference-images/${Date.now()}-${suffix}.png`

  const { url } = await put(filename, buffer, {
    access: "public",
    contentType: "image/png",
  })

  return url
}
