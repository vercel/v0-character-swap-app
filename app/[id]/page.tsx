import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getGenerationByUuid } from "@/lib/db"
import { GenerationViewer } from "./generation-viewer"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  if (!UUID_RE.test(id)) return { title: "Not found — v0 Face Swap" }

  const gen = await getGenerationByUuid(id)
  if (!gen) return { title: "Not found — v0 Face Swap" }

  const title = gen.character_name
    ? `${gen.character_name} — v0 Face Swap`
    : "v0 Face Swap"
  const description = gen.character_name
    ? `Watch this ${gen.character_name} face swap video`
    : "Watch this face swap video"
  const image = gen.character_image_url || undefined

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(image ? { images: [{ url: image }] } : {}),
      type: gen.video_url ? "video.other" : "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  }
}

export default async function GenerationSharePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()

  const gen = await getGenerationByUuid(id)
  if (!gen) notFound()

  return <GenerationViewer generation={gen} />
}
