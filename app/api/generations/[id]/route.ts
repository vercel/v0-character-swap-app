import { NextResponse, type NextRequest } from "next/server"
import { verifySession } from "@/lib/auth"
import { getDb, updateGenerationFailed } from "@/lib/db"

async function resolveUserId(request: NextRequest): Promise<string | null> {
  const session = await verifySession().catch(() => null)
  if (session?.user?.id) return session.user.id
  const anonId = request.headers.get("x-anonymous-user-id")
  if (anonId && anonId.startsWith("anon_")) return anonId
  return null
}

// Update generation status (e.g., mark as failed)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await resolveUserId(request)
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const generationId = parseInt(id, 10)

    if (isNaN(generationId)) {
      return NextResponse.json({ error: "Invalid generation ID" }, { status: 400 })
    }

    const { status, errorMessage } = await request.json()

    // Verify ownership first
    const sql = getDb()
    const ownership = await sql`
      SELECT id FROM generations 
      WHERE id = ${generationId} AND user_id = ${userId}
    `
    
    if (ownership.length === 0) {
      return NextResponse.json({ error: "Generation not found" }, { status: 404 })
    }

    if (status === "failed") {
      await updateGenerationFailed(generationId, errorMessage)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update generation:", error)
    return NextResponse.json(
      { error: "Failed to update generation" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await resolveUserId(request)
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const generationId = parseInt(id, 10)

    if (isNaN(generationId)) {
      return NextResponse.json({ error: "Invalid generation ID" }, { status: 400 })
    }

    // Delete the generation (user can only delete their own)
    const sql = getDb()
    const result = await sql`
      DELETE FROM generations 
      WHERE id = ${generationId} 
        AND user_id = ${userId}
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Generation not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to cancel generation:", error)
    return NextResponse.json(
      { error: "Failed to cancel generation" },
      { status: 500 }
    )
  }
}
