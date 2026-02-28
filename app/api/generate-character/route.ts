import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      )
    }

    // Use project-level OIDC auth (env-based API key)
    // Cartoon-only prompt — no photorealistic images or real people
    const result = await generateText({
      model: "google/gemini-3-pro-image",
      prompt: `Create a cartoon character illustration of ${prompt}.

STYLE REQUIREMENTS - MANDATORY:
- Art style MUST be 3D animated in the style of Pixar/Disney — smooth, rounded shapes, soft subsurface scattering on skin, big expressive eyes, slightly exaggerated proportions
- Render quality should look like a still frame from a Pixar movie
- NEVER generate a photorealistic image or photograph
- NEVER generate a real person, celebrity, politician, or any recognizable public figure
- The character must be clearly fictional and illustrated
- If the description sounds like a real person, create an original Pixar-style cartoon character inspired by the concept instead

COMPOSITION REQUIREMENTS for face swap compatibility:
- Full head and complete upper body (shoulders, chest, arms) clearly visible
- Face looking directly at viewer, frontal view, no profile angles
- Face completely unobstructed - no sunglasses, masks, hands covering face, or hair covering face
- Even, soft lighting on face with no harsh shadows
- Sharp focus on facial features
- Simple illustrated or solid color background
- Character visible from head to at least waist level`,
    })

    const imageFile = result.files?.find((f) => f.mediaType?.startsWith("image/"))

    if (!imageFile) {
      throw new Error("No image generated")
    }

    const base64 = Buffer.from(imageFile.uint8Array).toString("base64")
    const imageUrl = `data:${imageFile.mediaType};base64,${base64}`

    return NextResponse.json({ imageUrl })
  } catch (error: unknown) {
    console.error("Generate character error:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage || "Failed to generate character" },
      { status: 500 }
    )
  }
}
