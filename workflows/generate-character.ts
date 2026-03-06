/**
 * Durable workflow for character image generation.
 *
 * Flow:
 * 1. Generate original 16:9 image with Grok via AI Gateway
 * 2. Reframe into 9:16 and 1:1 with Gemini (in parallel via separate steps)
 * 3. Upload all 3 images to Vercel Blob
 * 4. Return the URLs
 *
 * Steps auto-retry on transient errors (network, 500, rate limits).
 * FatalError skips retries for input errors.
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

CHARACTER:
- Clearly fictional cartoon character, never photorealistic or a real person
- Full head and upper body visible, facing the viewer directly
- Face completely unobstructed — no sunglasses, masks, or hair covering the face
- Sharp focus on facial features with even, soft lighting`

const REFRAME_PROMPT = (aspectRatio: string) =>
  `Recreate this exact same character in the exact same Pixar 3D animation style, with the same face, same outfit, same colors, same pose, same lighting. Keep the character IDENTICAL — do not change any features. Only reframe/recompose the image to fit a ${aspectRatio} aspect ratio. Show head and upper body. Keep the background style consistent.`

// ============================================
// WORKFLOW
// ============================================

export async function generateCharacterWorkflow(input: GenerateCharacterInput): Promise<GenerateCharacterResult> {
  "use workflow"

  const { prompt, gatewayApiKey } = input

  // Step 1: Generate original 16:9 with Grok
  const originalBase64 = await generateOriginal(prompt, gatewayApiKey)
  const originalDataUrl = `data:image/png;base64,${originalBase64}`

  // Step 2: Reframe into 9:16 and 1:1 with Gemini (parallel steps)
  const [portraitBase64, squareBase64] = await Promise.all([
    reframeImage(originalDataUrl, "9:16", gatewayApiKey),
    reframeImage(originalDataUrl, "1:1", gatewayApiKey),
  ])

  // Step 3: Upload all 3 to blob storage
  const [url169, url916, url11] = await Promise.all([
    uploadToBlob(originalBase64, "image/png", "16x9"),
    uploadToBlob(portraitBase64, "image/png", "9x16"),
    uploadToBlob(squareBase64, "image/png", "1x1"),
  ])

  return {
    imageUrl: url169,
    sources: {
      "16:9": url169,
      "9:16": url916,
      "1:1": url11,
    },
  }
}

// ============================================
// STEP FUNCTIONS
// ============================================

async function generateOriginal(prompt: string, gatewayApiKey?: string): Promise<string> {
  "use step"

  const { generateImage, createGateway } = await import("ai")

  const gateway = createGateway({
    ...(gatewayApiKey ? { apiKey: gatewayApiKey } : {}),
  })

  const { image } = await generateImage({
    model: gateway.imageModel("xai/grok-imagine-image"),
    prompt: PROMPT_TEMPLATE(prompt),
    aspectRatio: "16:9",
  })

  return image.base64
}

async function reframeImage(originalDataUrl: string, aspectRatio: string, gatewayApiKey?: string): Promise<string> {
  "use step"

  const { generateText, createGateway } = await import("ai")

  const gateway = createGateway({
    ...(gatewayApiKey ? { apiKey: gatewayApiKey } : {}),
  })

  const result = await generateText({
    model: gateway("google/gemini-2.5-flash-image"),
    messages: [
      {
        role: "user",
        content: [
          { type: "image", image: originalDataUrl },
          { type: "text", text: REFRAME_PROMPT(aspectRatio) },
        ],
      },
    ],
    providerOptions: {
      google: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio },
      },
    },
  })

  const imageFile = result.files?.find((f) => f.mediaType?.startsWith("image/"))
  if (!imageFile) {
    const { FatalError } = await import("workflow")
    throw new FatalError(`No image generated for ${aspectRatio}`)
  }

  return imageFile.base64
}

async function uploadToBlob(base64: string, mediaType: string, suffix: string): Promise<string> {
  "use step"

  const { put } = await import("@vercel/blob")

  const buffer = Buffer.from(base64, "base64")
  const filename = `reference-images/${Date.now()}-${suffix}.png`

  const { url } = await put(filename, buffer, {
    access: "public",
    contentType: mediaType,
  })

  return url
}
