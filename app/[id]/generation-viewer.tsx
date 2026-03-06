"use client"

import { useEffect, useRef } from "react"
import { useViewer } from "@/providers/viewer-context"
import { OngoingGenerationView } from "@/components/ongoing-generation-view"
import type { Generation } from "@/lib/db"

export function GenerationViewer({ generation }: { generation: Generation }) {
  const { viewVideo } = useViewer()
  const openedRef = useRef(false)

  useEffect(() => {
    if (openedRef.current) return
    if (generation.status === "completed" && generation.video_url) {
      openedRef.current = true
      viewVideo({
        videoUrl: generation.video_url,
        sourceVideoUrl: generation.source_video_url || null,
        sourceAspectRatio: generation.source_video_aspect_ratio || "fill",
        generatedAspectRatio: generation.aspect_ratio || "fill",
        characterName: generation.character_name,
        characterImageUrl: generation.character_image_url,
        uuid: generation.uuid,
      })
    }
  }, [generation, viewVideo])

  // Completed — viewer overlay handles display (rendered by LayoutShell)
  if (generation.status === "completed" && generation.video_url) {
    return null
  }

  // In-progress — show progress UI inline
  if (
    generation.status === "uploading" ||
    generation.status === "processing"
  ) {
    return <OngoingGenerationView generationId={generation.id} />
  }

  // Failed or other
  return null
}
