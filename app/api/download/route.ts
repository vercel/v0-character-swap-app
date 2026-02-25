import { NextRequest, NextResponse } from "next/server"
import { buildCompositeVideoUrl, blobUrlToPublicId, buildUploadCompositeUrl } from "@/lib/cloudinary"

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME

function isBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.hostname.endsWith(".public.blob.vercel-storage.com")
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  if (!CLOUD_NAME) {
    return NextResponse.json(
      { error: "Cloudinary not configured" },
      { status: 503 }
    )
  }

  const { searchParams } = request.nextUrl
  const mainVideoUrl = searchParams.get("main")
  const pipVideoUrl = searchParams.get("pip")
  const showPip = searchParams.get("showPip") === "true"
  const pipAspectRatio = (searchParams.get("pipAspectRatio") || "fill") as "9:16" | "16:9" | "fill"
  const attachment = searchParams.get("attachment") === "true"

  if (!mainVideoUrl || !isBlobUrl(mainVideoUrl)) {
    return NextResponse.json(
      { error: "Invalid main video URL" },
      { status: 400 }
    )
  }

  if (pipVideoUrl && !isBlobUrl(pipVideoUrl)) {
    return NextResponse.json(
      { error: "Invalid PiP video URL" },
      { status: 400 }
    )
  }

  try {
    // Try upload-based URL first (pre-processed via eager async, no size limit)
    const publicId = blobUrlToPublicId(mainVideoUrl)
    const uploadUrl = buildUploadCompositeUrl({
      publicId,
      pipVideoUrl: showPip ? pipVideoUrl : null,
      showPip,
      pipAspectRatio,
      cloudName: CLOUD_NAME,
    })

    // Check if the video has been uploaded to Cloudinary
    const check = await fetch(uploadUrl, { method: "HEAD" })
    if (check.ok) {
      return NextResponse.json({ url: uploadUrl })
    }

    // Fallback to fetch-based URL (works for smaller videos)
    const fetchUrl = buildCompositeVideoUrl({
      mainVideoUrl,
      pipVideoUrl: showPip ? pipVideoUrl : null,
      showPip,
      pipAspectRatio,
      cloudName: CLOUD_NAME,
      attachment,
    })

    return NextResponse.json({ url: fetchUrl })
  } catch (error) {
    console.error("Failed to build Cloudinary URL:", error)
    return NextResponse.json(
      { error: "Failed to build download URL" },
      { status: 500 }
    )
  }
}
