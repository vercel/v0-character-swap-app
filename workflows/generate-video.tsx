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
  provider: "kling"
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
  if (details.includes("GatewayInternalServerError")) {
    return {
      kind: "provider_error",
      provider: "kling",
      model: "klingai/kling-v2.6-motion-control",
      code: "GATEWAY_INTERNAL_SERVER_ERROR",
      summary: "AI Gateway/provider returned an internal server error.",
      details,
    }
  }

  return {
    kind: "provider_error",
    provider: "kling",
    model: "klingai/kling-v2.6-motion-control",
    code: "PROVIDER_ERROR",
    summary: "Provider request failed.",
    details,
  }
}

/**
 * Durable workflow for video generation using AI SDK + AI Gateway
 * 
 * Flow:
 * 1. Workflow calls generateVideo via AI SDK with KlingAI motion control
 * 2. AI SDK handles polling internally until video is ready
 * 3. Workflow saves the resulting video to Vercel Blob
 * 4. Workflow updates the database and sends email notification
 * 
 * No webhook needed - AI SDK handles the entire generation lifecycle.
 */
export async function generateVideoWorkflow(input: GenerateVideoInput) {
  "use workflow"

  const { generationId, videoUrl, characterImageUrl, characterName, userEmail } = input

  const workflowStartTime = Date.now()
  console.log(`[Workflow] [${new Date().toISOString()}] Starting generation ${generationId} via AI Gateway`)

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

  const { experimental_generateVideo: generateVideo, createGateway } = await import("ai")
  const { Agent } = await import("undici")
  const { put } = await import("@vercel/blob")
  const { updateGenerationRunId } = await import("@/lib/db")
  const { buildMp4ConversionUrl } = await import("@/lib/cloudinary")

  console.log(`[Workflow Step] [${new Date().toISOString()}] Imports loaded, creating gateway...`)

  // Convert raw video (webm/mov) to MP4 via Cloudinary fetch transformation
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  let klingVideoUrl = videoUrl
  if (cloudName) {
    try {
      const mp4Url = buildMp4ConversionUrl(videoUrl, cloudName)
      console.log(`[Workflow Step] [${new Date().toISOString()}] Pre-warming Cloudinary MP4 URL: ${mp4Url}`)
      const warmup = await fetch(mp4Url, { method: "HEAD" })
      if (warmup.ok) {
        klingVideoUrl = mp4Url
        const contentType = warmup.headers.get("content-type")
        const contentLength = warmup.headers.get("content-length")
        const sizeMB = contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(2) : "unknown"
        console.log(`[Workflow Step] [${new Date().toISOString()}] Cloudinary MP4 ready: type=${contentType}, size=${sizeMB}MB`)
      } else {
        console.warn(`[Workflow Step] [${new Date().toISOString()}] Cloudinary pre-warm failed (${warmup.status}), falling back to original URL`)
      }
    } catch (cloudinaryErr) {
      console.warn(`[Workflow Step] [${new Date().toISOString()}] Cloudinary conversion failed, falling back to original URL:`, cloudinaryErr)
    }
  } else {
    console.warn(`[Workflow Step] [${new Date().toISOString()}] CLOUDINARY_CLOUD_NAME not set, skipping MP4 conversion`)
  }

  // Create a NEW Agent instance on each request (per official Vercel docs)
  // This ensures fresh connections without any stale state
  const gateway = createGateway({
    fetch: (url, init) => {
      const agent = new Agent({
        headersTimeout: 15 * 60 * 1000, // 15 minutes
        bodyTimeout: 15 * 60 * 1000, // 15 minutes
      })
      console.log(`[Workflow Step] [${new Date().toISOString()}] Creating new Agent for request to ${url}`)

      return fetch(url, {
        ...init,
        dispatcher: agent,
      } as RequestInit)
    },
  })

  console.log(`[Workflow Step] [${new Date().toISOString()}] Gateway created (+${Date.now() - stepStartTime}ms)`)
  console.log(`[Workflow Step] [${new Date().toISOString()}] Input: characterImageUrl=${characterImageUrl}, videoUrl=${klingVideoUrl}`)

  // Update run ID with a placeholder so UI knows it's processing
  await updateGenerationRunId(generationId, `ai-gateway-${generationId}`)

  // Generate video using AI SDK with KlingAI motion control
  console.log(`[Workflow Step] [${new Date().toISOString()}] Calling experimental_generateVideo with klingai/kling-v2.6-motion-control...`)

  const generateStart = Date.now()
  let result: Awaited<ReturnType<typeof generateVideo>>
  try {
    console.log(`[Workflow Step] [${new Date().toISOString()}] Starting generateVideo call at ${generateStart}...`)
    result = await generateVideo({
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
  } catch (error) {
    const { FatalError } = await import("workflow")
    const elapsedMs = Date.now() - generateStart
    console.error(`[Workflow Step] [${new Date().toISOString()}] generateVideo FAILED after ${elapsedMs}ms (${(elapsedMs / 1000).toFixed(1)}s)`)
    console.error(`[Workflow Step] Error type: ${error?.constructor?.name}`)
    console.error(`[Workflow Step] Error message: ${error instanceof Error ? error.message : String(error)}`)

    // Log detailed error information
    if (error && typeof error === "object") {
      if ("cause" in error) {
        console.error(`[Workflow Step] Error cause:`, (error as { cause: unknown }).cause)
      }
      if ("statusCode" in error) {
        console.error(`[Workflow Step] Status code: ${(error as { statusCode: unknown }).statusCode}`)
      }
      if ("url" in error) {
        console.error(`[Workflow Step] Request URL: ${(error as { url: unknown }).url}`)
      }
      if ("requestBodyValues" in error) {
        console.error(`[Workflow Step] Request body:`, (error as { requestBodyValues: unknown }).requestBodyValues)
      }
    }

    const details = await serializeUnknownError(error)
    console.error(`[Workflow Step] Serialized error details: ${details.substring(0, 500)}...`)

    const payload = buildProviderErrorPayload(details)
    console.error(`[Workflow Step] Error payload:`, payload)

    // Use FatalError to skip retries - provider errors won't be fixed by retrying
    throw new FatalError(`${PROVIDER_ERROR_PREFIX}${JSON.stringify(payload)}`)
  }

  const generateTime = Date.now() - generateStart
  console.log(`[Workflow Step] [${new Date().toISOString()}] generateVideo completed in ${generateTime}ms (${(generateTime / 1000).toFixed(1)}s)`)
  console.log(`[Workflow Step] [${new Date().toISOString()}] Generated ${result.videos.length} video(s)`)

  if (result.videos.length === 0) {
    throw new Error("No videos were generated")
  }

  // Save video bytes directly to Vercel Blob (avoid serializing large bytes between steps)
  const videoBytes = result.videos[0].uint8Array
  console.log(`[Workflow Step] [${new Date().toISOString()}] Video size: ${videoBytes.length} bytes, saving to Blob...`)

  const { url: blobUrl } = await put(`generations/${generationId}-${Date.now()}.mp4`, videoBytes, {
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
