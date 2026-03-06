import { type NextRequest, NextResponse } from "next/server"
import { generateImage, generateText } from "ai"
import { createGateway } from "@ai-sdk/gateway"
import { getSession } from "@/lib/auth"

export const maxDuration = 120

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

/**
 * Generate a variant of the original image at a different aspect ratio using Gemini.
 */
async function generateVariant(
  originalDataUrl: string,
  aspectRatio: string,
  apiKey?: string,
): Promise<string> {
  const gateway = createGateway({
    ...(apiKey ? { apiKey } : {}),
  })
  const model = gateway("google/gemini-2.5-flash-image")

  const result = await generateText({
    model,
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
  if (!imageFile) throw new Error(`No image generated for ${aspectRatio}`)
  return `data:${imageFile.mediaType};base64,${imageFile.base64}`
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Sign in to generate characters" },
        { status: 401 }
      )
    }

    const { prompt } = await request.json()

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      )
    }

    // Step 1: Generate the original in 16:9 with Grok (uses user's gateway key or OIDC fallback)
    const gateway = createGateway({
      ...(session.apiKey ? { apiKey: session.apiKey } : {}),
    })
    const { image } = await generateImage({
      model: gateway.imageModel("xai/grok-imagine-image"),
      prompt: PROMPT_TEMPLATE(prompt.trim()),
      aspectRatio: "16:9",
    })
    const originalDataUrl = `data:image/png;base64,${image.base64}`

    // Step 2: Use Gemini to reframe into 9:16 and 1:1 (in parallel)
    const [portrait, square] = await Promise.all([
      generateVariant(originalDataUrl, "9:16", session.apiKey),
      generateVariant(originalDataUrl, "1:1", session.apiKey),
    ])

    const sources: Record<string, string> = {
      "16:9": originalDataUrl,
      "9:16": portrait,
      "1:1": square,
    }

    return NextResponse.json({
      imageUrl: originalDataUrl,
      sources,
    })
  } catch (error: unknown) {
    console.error("Generate character error:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage || "Failed to generate character" },
      { status: 500 }
    )
  }
}
