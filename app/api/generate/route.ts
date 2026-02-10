import { type NextRequest, NextResponse } from "next/server"
import { start } from "workflow/api"
import { generateVideoWorkflow } from "@/workflows/generate-video"
import { createGeneration, updateGenerationStartProcessing } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { generationId: existingGenerationId, videoUrl, characterImageUrl, userId, userEmail, characterName, sendEmail } = body

    if (!videoUrl || !characterImageUrl) {
      return NextResponse.json(
        { error: "Video URL and character image URL are required" },
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User must be logged in" },
        { status: 401 }
      )
    }

    let generationId = existingGenerationId

    if (existingGenerationId) {
      await updateGenerationStartProcessing(existingGenerationId, videoUrl, characterImageUrl)
    } else {
      generationId = await createGeneration({
        userId,
        userEmail: sendEmail ? userEmail : undefined,
        videoUrl,
        characterName: characterName || undefined,
        characterImageUrl,
      })

      if (!generationId) {
        return NextResponse.json(
          { error: "Failed to create generation record" },
          { status: 500 }
        )
      }
    }

    // Start the durable workflow - returns immediately, runs in background
    const run = await start(generateVideoWorkflow, [{
      generationId,
      videoUrl,
      characterImageUrl,
      characterName: characterName || undefined,
      userEmail: sendEmail ? userEmail : undefined,
    }])

    console.log(`[Generate] Started workflow run ${run.runId} for generation ${generationId}`)

    return NextResponse.json({
      success: true,
      generationId,
      runId: run.runId,
      message: "Video generation workflow started",
    })
  } catch (error) {
    console.error("Generate error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start video generation" },
      { status: 500 }
    )
  }
}
