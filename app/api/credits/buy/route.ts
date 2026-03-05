import { NextResponse } from "next/server"
import { getSession, getBaseUrl } from "@/lib/auth"

export const dynamic = "force-dynamic"

const LOG_PREFIX = "[buy-credits]"

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    // Parse & validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      console.error(LOG_PREFIX, requestId, "Failed to parse request body as JSON")
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      )
    }

    const { amount } = body as { amount?: unknown }

    if (amount === undefined || amount === null) {
      console.error(LOG_PREFIX, requestId, "Missing 'amount' field in body")
      return NextResponse.json(
        { error: "Amount is required" },
        { status: 400 },
      )
    }

    if (typeof amount !== "number" || !Number.isFinite(amount)) {
      console.error(LOG_PREFIX, requestId, "Invalid amount type:", typeof amount, amount)
      return NextResponse.json(
        { error: "Amount must be a valid number" },
        { status: 400 },
      )
    }

    if (amount <= 0) {
      console.error(LOG_PREFIX, requestId, "Non-positive amount:", amount)
      return NextResponse.json(
        { error: "Amount must be greater than zero" },
        { status: 400 },
      )
    }

    // Session checks
    const session = await getSession()

    if (!session?.accessToken) {
      console.error(LOG_PREFIX, requestId, "No access token in session")
      return NextResponse.json(
        { error: "Not authenticated. Please sign in first.", needsAuth: true },
        { status: 401 },
      )
    }

    const teamId = session.teamId
    if (!teamId) {
      console.error(LOG_PREFIX, requestId, "No teamId in session")
      return NextResponse.json(
        { error: "No team selected. Please sign out and back in." },
        { status: 400 },
      )
    }

    // Call Vercel billing API
    const returnUrl = getBaseUrl()
    const url = `https://api.vercel.com/v1/billing/buy?teamId=${teamId}`
    const purchaseBody = {
      item: { type: "credits", creditType: "gateway", amount },
      browserCheckout: {
        returnUrl,
      },
    }

    console.log(LOG_PREFIX, requestId, "Calling Vercel billing API", {
      url,
      amount,
      teamId,
    })

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(purchaseBody),
    })

    // Handle response
    let responseBody: unknown = null
    const rawText = await res.text()

    try {
      responseBody = JSON.parse(rawText)
    } catch {
      console.error(LOG_PREFIX, requestId, "Non-JSON response from billing API", {
        status: res.status,
        statusText: res.statusText,
        body: rawText.slice(0, 500),
      })
    }

    if (!res.ok) {
      console.error(LOG_PREFIX, requestId, "Billing API error", {
        status: res.status,
        statusText: res.statusText,
        body: responseBody ?? rawText.slice(0, 500),
      })

      const errorMessage =
        (responseBody as any)?.error?.message ??
        (responseBody as any)?.error ??
        res.statusText

      return NextResponse.json(
        { error: `Purchase failed: ${errorMessage}` },
        { status: res.status },
      )
    }

    console.log(LOG_PREFIX, requestId, "Purchase successful", {
      status: res.status,
    })

    return NextResponse.json({
      success: true,
      checkoutSessionUrl: (responseBody as any)?.checkoutSessionUrl ?? null,
    })
  } catch (error) {
    console.error(LOG_PREFIX, requestId, "Unexpected error", {
      message: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: "An unexpected error occurred while processing the purchase" },
      { status: 500 },
    )
  }
}
