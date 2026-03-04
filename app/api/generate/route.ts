import { type NextRequest, NextResponse } from "next/server"
import { start } from "workflow/api"
import { generateVideoWorkflow } from "@/workflows/generate-video"
import { createGeneration, updateGenerationStartProcessing, updateGenerationRunId } from "@/lib/db"
import { toWorkflowErrorObject } from "@/lib/workflow-errors"
import { getSession } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    // Verify session server-side — never trust userId from client
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { generationId: existingGenerationId, videoUrl, characterImageUrl, characterName, sourceVideoAspectRatio, sendEmail } = body
    // Use verified session data, not client-provided userId/email
    const userId = session.userId
    const userName = session.name || undefined
    const userEmail = session.email || undefined

    if (!videoUrl || !characterImageUrl) {
      return NextResponse.json(
        { error: "Video URL and character image URL are required" },
        { status: 400 }
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

    // TEMP: use project-level OIDC (session already verified above)

    // Start the durable workflow via the Workflow SDK
    // Each step runs on its own request, avoiding the 5-minute serverless timeout
    // The .well-known/workflow/v1/step route has maxDuration=800 via vercel.json
    const run = await start(generateVideoWorkflow, [{
      generationId,
      videoUrl,
      characterImageUrl,
      characterName: characterName || undefined,
      userName: userName || undefined,
      userEmail: sendEmail ? userEmail : undefined,
      sourceVideoUrl: videoUrl,
      sourceVideoAspectRatio: sourceVideoAspectRatio || "fill",
      gatewayApiKey: undefined, // TEMP: use project-level OIDC
    }])

    // Store the workflow run ID so the UI can track progress
    await updateGenerationRunId(generationId, run.id)

    console.log(`[Generate] Started workflow run ${run.id} for generation ${generationId}`)

    return NextResponse.json({
      success: true,
      generationId,
      runId: run.id,
      message: "Video generation workflow started",
    })
  } catch (error) {
    console.error("Generate error:", error)
    const message = error instanceof Error ? error.message : "Failed to start video generation"
    return NextResponse.json(
      { error: toWorkflowErrorObject(message) },
      { status: 500 }
    )
  }
}
