import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { verifySession } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    const session = await verifySession()
    const userId = session?.user?.id || null

    const { videoUrl, characterImageUrl, characterName } = await request.json()

    if (!videoUrl) {
      return NextResponse.json({ error: "Video URL required" }, { status: 400 })
    }

    await sql`
      INSERT INTO video_submissions (video_url, character_image_url, character_name, user_id, status)
      VALUES (${videoUrl}, ${characterImageUrl || null}, ${characterName || null}, ${userId}, 'pending')
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to submit video:", error)
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 })
  }
}
