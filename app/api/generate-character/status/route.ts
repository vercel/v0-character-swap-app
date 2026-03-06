import { type NextRequest, NextResponse } from "next/server"
import { getRun } from "workflow/api"
import { getSession } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const runId = request.nextUrl.searchParams.get("runId")
  if (!runId) {
    return NextResponse.json({ error: "runId is required" }, { status: 400 })
  }

  try {
    const run = getRun(runId)
    const status = await run.status

    if (status === "completed") {
      try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000))
        const result = await Promise.race([run.returnValue, timeout])
        return NextResponse.json({ status: "completed", result })
      } catch {
        return NextResponse.json({ status: "running" })
      }
    }

    if (status === "failed" || status === "cancelled") {
      let errorMessage = "Generation failed"
      try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000))
        await Promise.race([run.returnValue, timeout])
      } catch (e) {
        if (e instanceof Error && e.message !== "timeout") {
          errorMessage = e.message
        }
      }
      return NextResponse.json({ status: "failed", error: errorMessage })
    }

    return NextResponse.json({ status: "running" })
  } catch (error) {
    console.error("[generate-character/status] Error:", error)
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 })
  }
}
