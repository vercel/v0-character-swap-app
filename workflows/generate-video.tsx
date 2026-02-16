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

type ProviderErrorPayload = {
  kind: "provider_error"
  provider: "fal"
  model: string
  code: string
  summary: string
  details: string
}

const PROVIDER_ERROR_PREFIX = "WF_PROVIDER_ERROR::"

async function serializeUnknownError(error: unknown): Promise<string> {
  if (error instanceof Error) {
    return error.stack ?? error.message
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "then" in error &&
    typeof (error as { then?: unknown }).then === "function"
  ) {
    try {
      const resolved = await (error as Promise<unknown>)
      return `Promise rejection: ${await serializeUnknownError(resolved)}`
    } catch (promiseError) {
      return `Promise rejection: ${await serializeUnknownError(promiseError)}`
    }
  }

  if (typeof error === "string") {
    return error
  }

  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

function buildProviderErrorPayload(details: string): ProviderErrorPayload {
  return {
    kind: "provider_error",
    provider: "fal",
    model: "fal-ai/kling-video/v2.6/standard/motion-control",
    code: "PROVIDER_ERROR",
    summary: "Kling v2.6 motion control via fal.ai request failed.",
    details,
  }
}

/**
 * Durable workflow for video generation using Kling v2.6 motion control via fal.ai
 * 
 * Flow:
 * 1. Workflow calls fal.ai Kling motion control API (fal-ai/kling-video/v2.6/standard/motion-control)
 * 2. fal.subscribe handles polling internally until video is ready
 * 3. Workflow downloads the resulting video and saves to Vercel Blob
 * 4. Workflow updates the database and sends email notification
 */
export async function generateVideoWorkflow(input: GenerateVideoInput) {
  "use workflow"

  const { generationId, videoUrl, characterImageUrl, characterName, userEmail } = input

  const workflowStartTime = Date.now()
  console.log(`[Workflow] [${new Date().toISOString()}] Starting generation ${generationId} via Kling v2.6 motion control (fal.ai)`)

  // Generate video AND save to blob in a single step
  // This avoids serializing large video bytes between steps
  let blobUrl: string
  try {
    const generateStartTime = Date.now()
    blobUrl = await generateAndSaveVideo(generationId, videoUrl, characterImageUrl)
    const generateTime = Date.now() - generateStartTime
    console.log(`[Workflow] [${new Date().toISOString()}] Video generated and saved in ${generateTime}ms (${(generateTime / 1000).toFixed(1)}s)`)
  } catch (genError) {
    console.error(`[Workflow] [${new Date().toISOString()}] Video generation failed:`, genError)
    const errorMessage = genError instanceof Error ? genError.message : String(genError)
    await markGenerationFailed(generationId, errorMessage)
    return { success: false, error: errorMessage }
  }

  // Update database
  const dbStartTime = Date.now()
  await markGenerationComplete(generationId, blobUrl)
  console.log(`[Workflow] [${new Date().toISOString()}] markGenerationComplete took ${Date.now() - dbStartTime}ms`)

  // Send email notification
  if (userEmail) {
    const emailStartTime = Date.now()
    await sendCompletionEmail(userEmail, blobUrl, characterName)
    console.log(`[Workflow] [${new Date().toISOString()}] sendCompletionEmail took ${Date.now() - emailStartTime}ms`)
  }

  const totalTime = Date.now() - workflowStartTime
  console.log(`[Workflow] [${new Date().toISOString()}] Generation ${generationId} completed: ${blobUrl}`)
  console.log(`[Workflow] [TIMING SUMMARY] Total: ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`)
  return { success: true, videoUrl: blobUrl }
}

// ============================================
// STEP FUNCTIONS (have full Node.js access)
// ============================================

async function generateAndSaveVideo(
  generationId: number,
  videoUrl: string,
  characterImageUrl: string,
): Promise<string> {
  "use step"

  const stepStartTime = Date.now()
  console.log(`[Workflow Step] [${new Date().toISOString()}] generateAndSaveVideo starting...`)

  const { fal } = await import("@fal-ai/client")
  const { put } = await import("@vercel/blob")
  const { updateGenerationRunId } = await import("@/lib/db")

  // Configure fal client with credentials
  fal.config({
    credentials: process.env.FAL_KEY,
  })

  console.log(`[Workflow Step] [${new Date().toISOString()}] fal client configured (+${Date.now() - stepStartTime}ms)`)
  console.log(`[Workflow Step] [${new Date().toISOString()}] Input: characterImageUrl=${characterImageUrl}, videoUrl=${videoUrl}`)

  // Update run ID with a placeholder so UI knows it's processing
  await updateGenerationRunId(generationId, `fal-kling-${generationId}`)

  // Generate video using Kling v2.6 motion control via fal.ai
  console.log(`[Workflow Step] [${new Date().toISOString()}] Calling fal.subscribe with fal-ai/kling-video/v2.6/standard/motion-control...`)

  const generateStart = Date.now()
  let result: { data: { video: { url: string; file_name: string; content_type: string } }; requestId: string }
  try {
    console.log(`[Workflow Step] [${new Date().toISOString()}] Starting Kling motion control call at ${generateStart}...`)
    result = await fal.subscribe("fal-ai/kling-video/v2.6/standard/motion-control", {
      input: {
        image_url: characterImageUrl,
        video_url: videoUrl,
        character_orientation: "video" as const,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs?.map((log) => log.message).forEach((msg) => console.log(`[Workflow Step] [fal/kling] ${msg}`))
        }
      },
    }) as { data: { video: { url: string; file_name: string; content_type: string } }; requestId: string }
  } catch (error) {
    const { FatalError } = await import("workflow")
    const elapsedMs = Date.now() - generateStart
    console.error(`[Workflow Step] [${new Date().toISOString()}] Kling motion control FAILED after ${elapsedMs}ms (${(elapsedMs / 1000).toFixed(1)}s)`)
    console.error(`[Workflow Step] Error type: ${error?.constructor?.name}`)
    console.error(`[Workflow Step] Error message: ${error instanceof Error ? error.message : String(error)}`)

    const details = await serializeUnknownError(error)
    console.error(`[Workflow Step] Serialized error details: ${details.substring(0, 500)}...`)

    const payload = buildProviderErrorPayload(details)
    console.error(`[Workflow Step] Error payload:`, payload)

    // Use FatalError to skip retries - provider errors won't be fixed by retrying
    throw new FatalError(`${PROVIDER_ERROR_PREFIX}${JSON.stringify(payload)}`)
  }

  const generateTime = Date.now() - generateStart
  console.log(`[Workflow Step] [${new Date().toISOString()}] Kling motion control completed in ${generateTime}ms (${(generateTime / 1000).toFixed(1)}s)`)

  const falVideoUrl = result.data?.video?.url
  if (!falVideoUrl) {
    throw new Error("No video URL returned from Kling motion control via fal.ai")
  }

  console.log(`[Workflow Step] [${new Date().toISOString()}] fal video URL: ${falVideoUrl}, downloading and saving to Blob...`)

  // Download the video from fal and save to Vercel Blob
  const videoResponse = await fetch(falVideoUrl)
  if (!videoResponse.ok) {
    throw new Error(`Failed to download video from fal: ${videoResponse.status}`)
  }
  const videoBuffer = await videoResponse.arrayBuffer()
  console.log(`[Workflow Step] [${new Date().toISOString()}] Video size: ${videoBuffer.byteLength} bytes`)

  const { url: blobUrl } = await put(`generations/${generationId}-${Date.now()}.mp4`, Buffer.from(videoBuffer), {
    access: "public",
    contentType: "video/mp4",
  })

  console.log(`[Workflow Step] [${new Date().toISOString()}] Saved to blob: ${blobUrl}, total step time: ${Date.now() - stepStartTime}ms`)
  return blobUrl
}

async function markGenerationComplete(generationId: number, videoUrl: string): Promise<void> {
  "use step"

  const { updateGenerationComplete } = await import("@/lib/db")
  await updateGenerationComplete(generationId, videoUrl)
  console.log(`[Workflow Step] Marked generation ${generationId} as complete`)
}

async function markGenerationFailed(generationId: number, error: string): Promise<void> {
  "use step"

  const { updateGenerationFailed } = await import("@/lib/db")
  await updateGenerationFailed(generationId, error)
  console.log(`[Workflow Step] Marked generation ${generationId} as failed: ${error}`)
}

async function sendCompletionEmail(email: string, videoUrl: string, characterName?: string): Promise<void> {
  "use step"

  const { Resend } = await import("resend")

  try {
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
    console.log(`[Workflow Step] Email sent to ${email}`)
  } catch (error) {
    console.error("[Workflow Step] Failed to send email:", error)
  }
}
