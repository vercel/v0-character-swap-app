import { sql } from "@/lib/db"

export async function GET() {
  try {
    // One video per character (most recent), plus approved community submissions
    const generationVideos = await sql`
      SELECT DISTINCT ON (character_name) video_url, character_image_url, character_name, source_video_url, 'fill' as aspect_ratio
      FROM generations
      WHERE status = 'completed' AND video_url IS NOT NULL AND character_name IS NOT NULL
      ORDER BY character_name, completed_at DESC
    `

    const communityVideos = await sql`
      SELECT video_url, character_image_url, character_name, source_video_url, 'fill' as aspect_ratio
      FROM video_submissions
      WHERE status = 'approved' AND video_url IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 20
    `

    // Merge: community first, then generation videos (dedup by video_url)
    const seen = new Set<string>()
    const all = [...communityVideos, ...generationVideos].filter(v => {
      if (seen.has(v.video_url)) return false
      seen.add(v.video_url)
      return true
    })

    return Response.json(
      { generations: all },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    )
  } catch (error) {
    console.error("Failed to fetch showcase:", error)
    return Response.json({ generations: [] }, { status: 500 })
  }
}
