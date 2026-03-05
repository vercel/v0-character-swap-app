import { sql } from "@/lib/db"

export async function GET() {
  try {
    // One video per character (most recent completed)
    const videos = await sql`
      SELECT DISTINCT ON (character_name) video_url, character_image_url, character_name, source_video_url, 'fill' as aspect_ratio
      FROM generations
      WHERE status = 'completed' AND video_url IS NOT NULL AND character_name IS NOT NULL
      ORDER BY character_name, completed_at DESC
    `

    return Response.json(
      { generations: videos },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    )
  } catch (error) {
    console.error("Failed to fetch showcase:", error)
    return Response.json({ generations: [] }, { status: 500 })
  }
}
