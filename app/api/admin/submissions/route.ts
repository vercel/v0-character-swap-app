import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

// Get all submissions
export async function GET() {
  try {
    const submissions = await sql`
      SELECT * FROM character_submissions 
      ORDER BY created_at DESC
    `
    return NextResponse.json({ submissions })
  } catch (error) {
    console.error("Failed to fetch submissions:", error)
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
  }
}

// Update submission status (approve/reject)
export async function PATCH(request: Request) {
  try {
    const { id, status, name, category } = await request.json()

    if (!id || !status) {
      return NextResponse.json({ error: "ID and status required" }, { status: 400 })
    }

    if (status !== "approved" && status !== "rejected") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    await sql`
      UPDATE character_submissions 
      SET status = ${status}, 
          suggested_name = COALESCE(${name || null}, suggested_name),
          suggested_category = COALESCE(${category || null}, suggested_category)
      WHERE id = ${id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update submission:", error)
    return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  }
}

// Delete submission
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 })
    }

    await sql`DELETE FROM character_submissions WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete submission:", error)
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
  }
}
