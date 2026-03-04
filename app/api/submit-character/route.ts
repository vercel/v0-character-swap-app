import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { verifySession } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    const session = await verifySession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }
    const userId = session.user.id

    const { imageUrl, name } = await request.json()

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json({ error: "Image URL required" }, { status: 400 })
    }

    await sql`
      INSERT INTO character_submissions (image_url, suggested_name, user_id, status)
      VALUES (${imageUrl}, ${name || null}, ${userId}, 'pending')
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to submit character:", error)
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 })
  }
}
