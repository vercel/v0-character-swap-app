import { sql } from "@/lib/db"

export async function GET() {
  try {
    const rows = await sql`
      SELECT video_url, character_image_url, character_name, aspect_ratio
      FROM generations
      WHERE status = 'completed' AND video_url IS NOT NULL AND character_image_url IS NOT NULL
      ORDER BY completed_at DESC
      LIMIT 12
    `

    return Response.json(
      { generations: rows },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    )
  } catch (error) {
    console.error("Failed to fetch showcase:", error)
    return Response.json({ generations: [] }, { status: 500 })
  }
}
