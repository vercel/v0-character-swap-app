import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

// Get all approved characters (available to all users)
export async function GET() {
  try {
    const characters = await sql`
      SELECT id, image_url, suggested_name, suggested_category
      FROM character_submissions
      WHERE status = 'approved'
      ORDER BY created_at DESC
    `
    return NextResponse.json({ characters }, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      }
    })
  } catch (error) {
    console.error("Failed to fetch approved characters:", error)
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
  }
}
