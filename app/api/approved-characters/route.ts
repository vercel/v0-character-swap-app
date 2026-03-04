import { sql } from "@/lib/db"

export async function GET() {
  try {
    const characters = await sql`
      SELECT id, image_url as src, suggested_name as name
      FROM character_submissions
      WHERE status = 'approved' AND image_url IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 50
    `

    return Response.json(
      { characters },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    )
  } catch (error) {
    console.error("Failed to fetch approved characters:", error)
    return Response.json({ characters: [] }, { status: 500 })
  }
}
