import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { verifySession } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    const session = await verifySession()
    const userId = session?.user?.id || null

    const { videoUrl, characterImageUrl, characterName, sourceVideoUrl } = await request.json()

    if (!videoUrl) {
      return NextResponse.json({ error: "Video URL required" }, { status: 400 })
    }

    // Try to fill in missing data from the generations table
    let finalCharacterImageUrl = characterImageUrl
    let finalCharacterName = characterName
    let finalSourceVideoUrl = sourceVideoUrl

    if (!finalCharacterImageUrl || !finalSourceVideoUrl) {
      const rows = await sql`
        SELECT character_image_url, character_name, source_video_url
        FROM generations
        WHERE video_url = ${videoUrl} AND status = 'completed'
        LIMIT 1
      `
      if (rows.length > 0) {
        finalCharacterImageUrl = finalCharacterImageUrl || rows[0].character_image_url
        finalCharacterName = finalCharacterName || rows[0].character_name
        finalSourceVideoUrl = finalSourceVideoUrl || rows[0].source_video_url
      }
    }

    await sql`
      INSERT INTO video_submissions (video_url, character_image_url, character_name, source_video_url, user_id, status)
      VALUES (${videoUrl}, ${finalCharacterImageUrl || null}, ${finalCharacterName || null}, ${finalSourceVideoUrl || null}, ${userId}, 'pending')
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to submit video:", error)
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 })
  }
}
