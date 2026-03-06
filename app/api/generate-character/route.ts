import { type NextRequest, NextResponse } from "next/server"
import { start } from "workflow/api"
import { generateCharacterWorkflow } from "@/workflows/generate-character"
import { getSession } from "@/lib/auth"

export const maxDuration = 120

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

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      )
    }

    // Start durable workflow — retries on transient errors automatically
    const run = await start(generateCharacterWorkflow, [{
      prompt: prompt.trim(),
      gatewayApiKey: session.apiKey,
    }])

    return NextResponse.json({ runId: run.runId })
  } catch (error: unknown) {
    console.error("Generate character error:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage || "Failed to generate character" },
      { status: 500 }
    )
  }
}
