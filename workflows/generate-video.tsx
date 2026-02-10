import { FatalError } from "workflow"

/**
 * Input for the video generation workflow
 */
export interface GenerateVideoInput {
  generationId: number
  videoUrl: string
  characterImageUrl: string
  characterName?: string
  userEmail?: string
}

/**
 * Durable workflow for video generation using AI SDK + AI Gateway.
 *
 * Flow:
 * 1. Generate video via AI SDK with KlingAI motion control (step)
 * 2. Save resulting video bytes to Vercel Blob (step)
 * 3. Update the database with completed status (step)
 * 4. Send email notification if requested (step)
 *
 * Each step is automatically retried on transient errors and its result
 * is persisted so the workflow can resume from where it left off.
 */
export async function generateVideoWorkflow(input: GenerateVideoInput) {
  "use workflow"

  const { generationId, videoUrl, characterImageUrl, characterName, userEmail } = input

  console.log(`[Workflow] Starting generation ${generationId}`)

  // Step 1: Generate video via AI SDK + KlingAI
  let videoData: Uint8Array
  try {
    videoData = await generateVideoWithAISDK(generationId, videoUrl, characterImageUrl)
  } catch (error) {
    // If generation fails, mark it as failed in DB before re-throwing
    const errorMessage = error instanceof Error ? error.message : String(error)
    await markGenerationFailed(generationId, errorMessage)
    throw error
  }

  // Step 2: Save video to Vercel Blob
  const blobUrl = await saveVideoToBlob(generationId, videoData)

  // Step 3: Update database with completed status
  await markGenerationComplete(generationId, blobUrl)

  // Step 4: Send email notification
  if (userEmail) {
    await sendCompletionEmail(userEmail, blobUrl, characterName)
  }

  console.log(`[Workflow] Generation ${generationId} completed: ${blobUrl}`)
  return { success: true, videoUrl: blobUrl }
}

// ============================================
// STEP FUNCTIONS (full Node.js access + retry)
// ============================================

async function generateVideoWithAISDK(
  generationId: number,
  videoUrl: string,
  characterImageUrl: string,
): Promise<Uint8Array> {
  "use step"

  const { experimental_generateVideo: generateVideo } = await import("ai")
  const { createGateway } = await import("@ai-sdk/gateway")
  const { Agent } = await import("undici")
  const { updateGenerationRunId } = await import("@/lib/db")

  // Custom gateway with extended timeouts for video generation (can take 10+ minutes)
  const gateway = createGateway({
    fetch: (url, init) =>
      fetch(url, {
        ...init,
        dispatcher: new Agent({
          headersTimeout: 15 * 60 * 1000,
          bodyTimeout: 15 * 60 * 1000,
        }),
      } as RequestInit),
  })

  // Update run ID so UI knows it's processing
  await updateGenerationRunId(generationId, `workflow-${generationId}`)

  console.log(`[Step:generateVideo] Calling klingai/kling-v2.6-motion-control for generation ${generationId}`)

  let result: Awaited<ReturnType<typeof generateVideo>>
  try {
    result = await generateVideo({
      model: gateway.video("klingai/kling-v2.6-motion-control"),
      prompt: {
        image: characterImageUrl,
      },
      providerOptions: {
        klingai: {
          videoUrl: videoUrl,
          characterOrientation: "video" as const,
          mode: "std" as const,
          pollIntervalMs: 5_000,
          pollTimeoutMs: 14 * 60 * 1000,
        },
      },
    })
  } catch (error) {
    // Client errors (4xx) are not retryable
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes("400") || message.includes("401") || message.includes("403") || message.includes("422")) {
      throw new FatalError(`Provider client error: ${message}`)
    }
    // All other errors are retryable by default
    throw error
  }

  console.log(`[Step:generateVideo] Generated ${result.videos.length} video(s)`)

  if (result.videos.length === 0) {
    throw new FatalError("No videos were generated")
  }

  return result.videos[0].uint8Array
}

// Allow up to 2 retries for the video generation step (3 total attempts)
generateVideoWithAISDK.maxRetries = 2

async function saveVideoToBlob(generationId: number, videoData: Uint8Array): Promise<string> {
  "use step"

  const { put } = await import("@vercel/blob")

  console.log(`[Step:saveBlob] Saving ${videoData.length} bytes for generation ${generationId}`)

  const { url } = await put(`generations/${generationId}-${Date.now()}.mp4`, videoData, {
    access: "public",
    contentType: "video/mp4",
  })

  console.log(`[Step:saveBlob] Saved to: ${url}`)
  return url
}

async function markGenerationComplete(generationId: number, videoUrl: string): Promise<void> {
  "use step"

  const { updateGenerationComplete } = await import("@/lib/db")
  await updateGenerationComplete(generationId, videoUrl)
  console.log(`[Step:markComplete] Generation ${generationId} marked as complete`)
}

async function markGenerationFailed(generationId: number, error: string): Promise<void> {
  "use step"

  const { updateGenerationFailed } = await import("@/lib/db")
  await updateGenerationFailed(generationId, error)
  console.log(`[Step:markFailed] Generation ${generationId} marked as failed: ${error}`)
}

async function sendCompletionEmail(email: string, videoUrl: string, characterName?: string): Promise<void> {
  "use step"

  try {
    const { Resend } = await import("resend")
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: "v0 Face Swap <noreply@resend.dev>",
      to: email,
      subject: "Your video is ready!",
      html: `
        <h1>Your face swap video is ready!</h1>
        ${characterName ? `<p>Character: ${characterName}</p>` : ""}
        <p>Click below to view your video:</p>
        <p><a href="${videoUrl}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:6px;">View Video</a></p>
        <p style="margin-top:20px;color:#666;font-size:14px;">Or copy this link: ${videoUrl}</p>
      `,
    })
    console.log(`[Step:sendEmail] Email sent to ${email}`)
  } catch (error) {
    // Email failures should not block the workflow
    console.error("[Step:sendEmail] Failed to send email:", error)
  }
}
// Don't retry email failures
sendCompletionEmail.maxRetries = 0
