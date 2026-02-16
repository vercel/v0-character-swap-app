import { getDb } from "@/lib/db"
import { NextResponse } from "next/server"

// Get all approved characters (available to all users)
export async function GET() {
  try {
    const sql = getDb()
    const characters = await sql`
      SELECT id, image_url, suggested_name, suggested_category 
      FROM character_submissions 
      WHERE status = 'approved'
      ORDER BY created_at DESC
    `
    return NextResponse.json({ characters })
  } catch (error) {
    console.error("Failed to fetch approved characters:", error)
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
  }
}
