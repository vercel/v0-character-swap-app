import { NextResponse, type NextRequest } from "next/server"
import { getUserGenerations, createPendingGeneration } from "@/lib/db"
import { verifySession } from "@/lib/auth"
import { toWorkflowErrorObject } from "@/lib/workflow-errors"

async function resolveUserId(request: NextRequest): Promise<string | null> {
  // Try authenticated session first
  const session = await verifySession().catch(() => null)
  if (session?.user?.id) return session.user.id
  // Fall back to anonymous user ID from header
  const anonId = request.headers.get("x-anonymous-user-id")
  if (anonId && anonId.startsWith("anon_")) return anonId
  return null
}

export async function GET(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const generations = await getUserGenerations(userId)
    const generationsWithStructuredErrors = generations.map((generation) => ({
      ...generation,
      error:
        generation.error_message != null
          ? toWorkflowErrorObject(generation.error_message)
          : null,
    }))

    return NextResponse.json({ generations: generationsWithStructuredErrors }, {
      headers: {
        'Cache-Control': 'private, max-age=0, stale-while-revalidate=10',
      }
    })
  } catch (error) {
    console.error("Failed to fetch generations:", error)
    return NextResponse.json(
      { error: "Failed to fetch generations" },
      { status: 500 }
    )
  }
}

// Create a pending generation (before upload starts)
export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { characterName, characterImageUrl, aspectRatio, sourceVideoAspectRatio } = await request.json()

    const generationId = await createPendingGeneration({
      userId,
      userEmail: undefined,
      characterName,
      characterImageUrl,
      aspectRatio: aspectRatio || "fill",
      sourceVideoAspectRatio: sourceVideoAspectRatio || "fill",
    })

    return NextResponse.json({ generationId })
  } catch (error) {
    console.error("Failed to create pending generation:", error)
    return NextResponse.json(
      { error: "Failed to create generation" },
      { status: 500 }
    )
  }
}
