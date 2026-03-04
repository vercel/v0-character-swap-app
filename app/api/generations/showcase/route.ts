import { sql } from "@/lib/db"

export async function GET() {
  try {
    const videos = await sql`
      SELECT video_url, character_image_url, character_name, 'fill' as aspect_ratio
      FROM video_submissions
      WHERE status = 'approved' AND video_url IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 20
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
