import { getMedianCompletionTime } from "@/lib/db"

export async function GET() {
  const medianDurationSeconds = await getMedianCompletionTime()

  return Response.json(
    { medianDurationSeconds },
    { headers: { "Cache-Control": "public, max-age=300" } },
  )
}
