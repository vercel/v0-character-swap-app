import { type NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import { createGeneration, updateGenerationStartProcessing, updateGenerationRunId, updateGenerationComplete, updateGenerationFailed } from "@/lib/db"
import { getSession } from "@/lib/auth"

// This route runs the video generation DIRECTLY (no workflow).
// Used to test whether the Workflow SDK step is causing the ~340s timeout.
// The after() callback runs after the response is sent, keeping the function alive up to maxDuration.
export const maxDuration = 800

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { generationId: existingGenerationId, videoUrl, characterImageUrl, userId, userName, userEmail, characterName, sendEmail } = body

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

    // Read the user's AI Gateway API key before entering after() (cookies not available there)
    const session = await getSession()
    const userApiKey = undefined // TEMP: use project-level OIDC

    console.log(`[GenerateDirect] Starting direct generation ${generationId} (no workflow)`)

    // Run the generation in the background after sending the response.
    // The function stays alive up to maxDuration (800s).
    after(async () => {
      try {
        const startTime = Date.now()
        console.log(`[GenerateDirect] [${new Date().toISOString()}] Background generation starting for ${generationId}`)

        const blobUrl = await generateAndSaveVideoDirect(generationId, videoUrl, characterImageUrl, userApiKey)

        const elapsed = Date.now() - startTime
        console.log(`[GenerateDirect] [${new Date().toISOString()}] Generation ${generationId} completed in ${elapsed}ms (${(elapsed / 1000).toFixed(1)}s): ${blobUrl}`)

        await updateGenerationComplete(generationId, blobUrl)

        // Send email if requested
        if (sendEmail && userEmail) {
          try {
            const { Resend } = await import("resend")
            const resend = new Resend(process.env.RESEND_API_KEY)
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://v0faceswap.app"
            const firstName = userName?.split(" ")[0] || ""
            const greeting = firstName ? `Hey ${firstName}!` : "Hey!"
            await resend.emails.send({
              from: "v0 Face Swap <hello@v0faceswap.app>",
              to: userEmail,
              subject: `Your face swap video is ready${characterName ? ` — ${characterName}` : ""}!`,
              text: [
                greeting,
                "",
                `Your video generated with v0 Face Swap is ready${characterName ? ` (${characterName})` : ""}.`,
                "",
                `Check it out: ${appUrl}`,
                "",
                "Build your own Face Swap app by cloning this v0 template: https://v0.app/templates/1Nu0E0eAo9q",
                "",
                "— v0 Face Swap",
              ].join("\n"),
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
 * Uses the exact same pattern as shaper's working code.
 */
async function generateAndSaveVideoDirect(
  generationId: number,
  videoUrl: string,
  characterImageUrl: string,
  gatewayApiKey?: string,
): Promise<string> {
  try {
    console.log(`[GenerateDirect] [${new Date().toISOString()}] generateAndSaveVideoDirect starting for generation ${generationId}`)

    const { experimental_generateVideo: generateVideo, createGateway } = await import("ai")
    const { Agent } = await import("undici")
    const { put } = await import("@vercel/blob")
    const { buildMp4ConversionUrl } = await import("@/lib/cloudinary")

    console.log(`[GenerateDirect] [${new Date().toISOString()}] Imports loaded successfully`)

    const stepStartTime = Date.now()

    // Convert raw video (webm/mov) to MP4 via Cloudinary fetch transformation
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    let klingVideoUrl = videoUrl
    if (cloudName) {
      try {
        const mp4Url = buildMp4ConversionUrl(videoUrl, cloudName)
        console.log(`[GenerateDirect] [${new Date().toISOString()}] Pre-warming Cloudinary MP4 URL: ${mp4Url}`)
        const warmup = await fetch(mp4Url, { method: "HEAD" })
        if (warmup.ok) {
          klingVideoUrl = mp4Url
          const contentType = warmup.headers.get("content-type")
          const contentLength = warmup.headers.get("content-length")
          const sizeMB = contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(2) : "unknown"
          console.log(`[GenerateDirect] [${new Date().toISOString()}] Cloudinary MP4 ready: type=${contentType}, size=${sizeMB}MB`)
        } else {
          console.warn(`[GenerateDirect] [${new Date().toISOString()}] Cloudinary pre-warm failed (${warmup.status}), falling back to original URL`)
        }
      } catch (cloudinaryErr) {
        console.warn(`[GenerateDirect] [${new Date().toISOString()}] Cloudinary conversion failed, falling back to original URL:`, cloudinaryErr)
      }
    } else {
      console.warn(`[GenerateDirect] [${new Date().toISOString()}] CLOUDINARY_CLOUD_NAME not set, skipping MP4 conversion`)
    }

    // Create a NEW Agent instance on each request (per official Vercel docs)
    // This ensures fresh connections without any stale state
    // If the user has an AI Gateway API key, use it so credits come from their account.
    // Otherwise, falls back to OIDC (project-level auth).
    const gateway = createGateway({
      ...(gatewayApiKey ? { apiKey: gatewayApiKey } : {}),
      fetch: (url, init) => {
        const agent = new Agent({
          headersTimeout: 15 * 60 * 1000, // 15 minutes
          bodyTimeout: 15 * 60 * 1000, // 15 minutes
        })
        console.log(`[GenerateDirect] [${new Date().toISOString()}] Creating new Agent for request to ${url}`)

        return fetch(url, {
          ...init,
          dispatcher: agent,
        } as RequestInit)
      },
    })

    console.log(`[GenerateDirect] [${new Date().toISOString()}] Setup done (+${Date.now() - stepStartTime}ms)`)
    console.log(`[GenerateDirect] [${new Date().toISOString()}] characterImageUrl=${characterImageUrl}, videoUrl=${klingVideoUrl}`)

  // Generate video using AI SDK with KlingAI motion control
  console.log(`[GenerateDirect] [${new Date().toISOString()}] Calling experimental_generateVideo...`)

  const generateStart = Date.now()
  const result = await generateVideo({
    model: gateway.video("klingai/kling-v2.6-motion-control"),
    prompt: {
      image: characterImageUrl,
    },
    providerOptions: {
      klingai: {
        videoUrl: klingVideoUrl,
        characterOrientation: "video" as const,
        mode: "std" as const,
        pollIntervalMs: 5_000,
        pollTimeoutMs: 14 * 60 * 1000, // 14 minutes
      },
    },
  })

  const generateTime = Date.now() - generateStart
  console.log(`[GenerateDirect] [${new Date().toISOString()}] generateVideo completed in ${generateTime}ms (${(generateTime / 1000).toFixed(1)}s)`)
  console.log(`[GenerateDirect] [${new Date().toISOString()}] Generated ${result.videos.length} video(s)`)

  if (result.videos.length === 0) {
    throw new Error("No videos were generated")
  }

  // Save to Vercel Blob
  const videoBytes = result.videos[0].uint8Array
  console.log(`[GenerateDirect] [${new Date().toISOString()}] Video size: ${videoBytes.length} bytes, saving to Blob...`)

  const { url: blobUrl } = await put(`generations/${generationId}-${Date.now()}.mp4`, videoBytes, {
    access: "public",
    contentType: "video/mp4",
  })

    console.log(`[GenerateDirect] [${new Date().toISOString()}] Saved to blob: ${blobUrl}, total time: ${Date.now() - stepStartTime}ms`)
    return blobUrl
  } catch (error) {
    const elapsedMs = Date.now() - generateStart
    console.error(`[GenerateDirect] [${new Date().toISOString()}] generateVideo FAILED after ${elapsedMs}ms (${(elapsedMs / 1000).toFixed(1)}s)`)
    console.error(`[GenerateDirect] Error type: ${error?.constructor?.name}`)
    console.error(`[GenerateDirect] Error message: ${error instanceof Error ? error.message : String(error)}`)

    // Log detailed error information
    if (error && typeof error === "object") {
      if ("cause" in error) {
        console.error(`[GenerateDirect] Error cause:`, (error as { cause: unknown }).cause)
      }
      if ("statusCode" in error) {
        console.error(`[GenerateDirect] Status code: ${(error as { statusCode: unknown }).statusCode}`)
      }
      if ("url" in error) {
        console.error(`[GenerateDirect] Request URL: ${(error as { url: unknown }).url}`)
      }
      if ("requestBodyValues" in error) {
        console.error(`[GenerateDirect] Request body:`, (error as { requestBodyValues: unknown }).requestBodyValues)
      }
    }

    console.error(`[GenerateDirect] Full error object:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    throw error
  }
}
