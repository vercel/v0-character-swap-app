import { NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"

export const runtime = "edge"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const video = formData.get("video") as File
    
    if (!video) {
      return NextResponse.json({ error: "No video provided" }, { status: 400 })
    }

    console.log("[v0] Processing video:", { 
      name: video.name, 
      size: video.size, 
      type: video.type 
    })

    // For now, just upload the video as-is
    // The key insight: Safari's video might work if we just re-upload it
    // The issue might be in how the blob was created client-side
    
    const arrayBuffer = await video.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)
    
    // Upload to Vercel Blob
    const blob = await put(`videos/${Date.now()}-processed.mp4`, buffer, {
      access: "public",
      contentType: "video/mp4",
    })

    console.log("[v0] Video uploaded:", { url: blob.url, size: video.size })

    return NextResponse.json({ 
      url: blob.url,
      size: video.size,
    })
  } catch (error) {
    console.error("[v0] Error processing video:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process video" },
      { status: 500 }
    )
  }
}
