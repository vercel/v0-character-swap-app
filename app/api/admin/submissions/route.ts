import { sql } from "@/lib/db"
import { NextResponse } from "next/server"
import { verifySession } from "@/lib/auth"

const ADMIN_EMAILS = process.env.ADMIN_EMAILS?.split(",").map(e => e.trim()).filter(Boolean) ?? []

async function requireAdmin() {
  const session = await verifySession()
  if (!session?.user?.id) return null
  // Fail-closed: if ADMIN_EMAILS is not configured, nobody is admin
  if (ADMIN_EMAILS.length === 0) return null
  if (!ADMIN_EMAILS.includes(session.user.email)) return null
  return session
}

// Get all submissions (characters + videos)
export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const characters = await sql`
      SELECT *, 'character' as type FROM character_submissions
      ORDER BY created_at DESC
      LIMIT 200
    `
    const videos = await sql`
      SELECT *, 'video' as type FROM video_submissions
      ORDER BY created_at DESC
      LIMIT 200
    `
    return NextResponse.json({ characters, videos })
  } catch (error) {
    console.error("Failed to fetch submissions:", error)
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
  }
}

// Update submission status (approve/reject)
export async function PATCH(request: Request) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, status, name, category, type } = await request.json()

    if (!id || typeof id !== "number" || !status) {
      return NextResponse.json({ error: "Valid numeric ID and status required" }, { status: 400 })
    }

    if (status !== "approved" && status !== "rejected") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    // Sanitize string inputs
    const safeName = typeof name === "string" ? name.slice(0, 100) : null
    const safeCategory = typeof category === "string" ? category.slice(0, 50) : null

    if (type === "video") {
      await sql`UPDATE video_submissions SET status = ${status} WHERE id = ${id}`
    } else {
      await sql`
        UPDATE character_submissions
        SET status = ${status},
            suggested_name = COALESCE(${safeName}, suggested_name),
            suggested_category = COALESCE(${safeCategory}, suggested_category)
        WHERE id = ${id}
      `
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update submission:", error)
    return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  }
}

// Delete submission
export async function DELETE(request: Request) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, type } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 })
    }

    if (type === "video") {
      await sql`DELETE FROM video_submissions WHERE id = ${id}`
    } else {
      await sql`DELETE FROM character_submissions WHERE id = ${id}`
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete submission:", error)
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
  }
}
