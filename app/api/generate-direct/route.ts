import { type NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import { createGeneration, updateGenerationStartProcessing, updateGenerationRunId, updateGenerationComplete, updateGenerationFailed } from "@/lib/db"

// This route runs the video generation DIRECTLY (no workflow).
// Used to test whether the Workflow SDK step is causing the ~340s timeout.
// The after() callback runs after the response is sent, keeping the function alive up to maxDuration.
export const maxDuration = 800

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

    await updateGenerationRunId(generationId, `direct-${generationId}`)

    console.log(`[GenerateDirect] Starting direct generation ${generationId} (no workflow)`)

    // Run the generation in the background after sending the response.
    // The function stays alive up to maxDuration (800s).
    after(async () => {
      try {
        const startTime = Date.now()
        console.log(`[GenerateDirect] [${new Date().toISOString()}] Background generation starting for ${generationId}`)

        const blobUrl = await generateAndSaveVideoDirect(generationId, videoUrl, characterImageUrl)

        const elapsed = Date.now() - startTime
        console.log(`[GenerateDirect] [${new Date().toISOString()}] Generation ${generationId} completed in ${elapsed}ms (${(elapsed / 1000).toFixed(1)}s): ${blobUrl}`)

        await updateGenerationComplete(generationId, blobUrl)

        // Send email if requested
        if (sendEmail && userEmail) {
          try {
            const { Resend } = await import("resend")
            const resend = new Resend(process.env.RESEND_API_KEY)
            await resend.emails.send({
              from: "v0 Face Swap <noreply@resend.dev>",
              to: userEmail,
              subject: "Your video is ready!",
              html: `
                <h1>Your face swap video is ready!</h1>
                ${characterName ? `<p>Character: ${characterName}</p>` : ""}
                <p>Click below to view your video:</p>
                <p><a href="${blobUrl}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:6px;">View Video</a></p>
              `,
            })
            console.log(`[GenerateDirect] Email sent to ${userEmail}`)
          } catch (emailErr) {
            console.error("[GenerateDirect] Email failed:", emailErr)
          }
        }
      } catch (error) {
        let errorMessage = "Unknown error"
        if (error instanceof Error) {
          errorMessage = `${error.message}${error.stack ? `\n${error.stack}` : ""}`
        } else if (error && typeof error === "object") {
          try {
            errorMessage = JSON.stringify(error, null, 2)
          } catch {
            errorMessage = String(error)
          }
        } else {
          errorMessage = String(error)
        }
        console.error(`[GenerateDirect] Generation ${generationId} failed:`, error)
        console.error(`[GenerateDirect] Error type:`, typeof error)
        console.error(`[GenerateDirect] Error constructor:`, error?.constructor?.name)
        await updateGenerationFailed(generationId, errorMessage).catch(dbErr => {
          console.error(`[GenerateDirect] Failed to update DB with error:`, dbErr)
        })
      }
    })

    return NextResponse.json({
      success: true,
      generationId,
      runId: `direct-${generationId}`,
      message: "Video generation started (direct mode, no workflow)",
    })
  } catch (error) {
    console.error("GenerateDirect error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start video generation" },
      { status: 500 }
    )
  }
}

/**
 * Generate video and save to blob — runs directly in the route handler (no workflow step).
 * Uses fal.ai face swap (half-moon-ai/ai-face-swap/faceswapvideo).
 */
async function generateAndSaveVideoDirect(
  generationId: number,
  videoUrl: string,
  characterImageUrl: string,
): Promise<string> {
  const stepStartTime = Date.now()
  console.log(`[GenerateDirect] [${new Date().toISOString()}] generateAndSaveVideoDirect starting for generation ${generationId}`)

  const { fal } = await import("@fal-ai/client")
  const { put } = await import("@vercel/blob")

  // Configure fal client with credentials
  fal.config({
    credentials: process.env.FAL_KEY,
  })

  console.log(`[GenerateDirect] [${new Date().toISOString()}] fal client configured (+${Date.now() - stepStartTime}ms)`)
  console.log(`[GenerateDirect] [${new Date().toISOString()}] characterImageUrl=${characterImageUrl}, videoUrl=${videoUrl}`)

  // Generate face swap video using fal.ai
  console.log(`[GenerateDirect] [${new Date().toISOString()}] Calling fal.subscribe with half-moon-ai/ai-face-swap/faceswapvideo...`)

  const generateStart = Date.now()
  try {
    const result = await fal.subscribe("half-moon-ai/ai-face-swap/faceswapvideo", {
      input: {
        source_face_url: characterImageUrl,
        target_video_url: videoUrl,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs?.map((log) => log.message).forEach((msg) => console.log(`[GenerateDirect] [fal] ${msg}`))
        }
      },
    }) as { data: { video: { url: string } }; requestId: string }

    const generateTime = Date.now() - generateStart
    console.log(`[GenerateDirect] [${new Date().toISOString()}] fal face swap completed in ${generateTime}ms (${(generateTime / 1000).toFixed(1)}s)`)

    const falVideoUrl = result.data?.video?.url
    if (!falVideoUrl) {
      throw new Error("No video URL returned from fal face swap")
    }

    console.log(`[GenerateDirect] [${new Date().toISOString()}] fal video URL: ${falVideoUrl}, downloading and saving to Blob...`)

    // Download the video from fal and save to Vercel Blob
    const videoResponse = await fetch(falVideoUrl)
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video from fal: ${videoResponse.status}`)
    }
    const videoBuffer = await videoResponse.arrayBuffer()
    console.log(`[GenerateDirect] [${new Date().toISOString()}] Video size: ${videoBuffer.byteLength} bytes`)

    const { url: blobUrl } = await put(`generations/${generationId}-${Date.now()}.mp4`, Buffer.from(videoBuffer), {
      access: "public",
      contentType: "video/mp4",
    })

    console.log(`[GenerateDirect] [${new Date().toISOString()}] Saved to blob: ${blobUrl}, total time: ${Date.now() - stepStartTime}ms`)
    return blobUrl
  } catch (error) {
    const elapsedMs = Date.now() - generateStart
    console.error(`[GenerateDirect] [${new Date().toISOString()}] fal face swap FAILED after ${elapsedMs}ms (${(elapsedMs / 1000).toFixed(1)}s)`)
    console.error(`[GenerateDirect] Error type: ${error?.constructor?.name}`)
    console.error(`[GenerateDirect] Error message: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}
