import { NextResponse } from "next/server"
import { getAuthenticatedUser, getUserTeam } from "@/lib/auth"
import { getIronSessionData, type SessionData } from "@/lib/secure-session"
import { getCredits, AiGatewayError } from "@/lib/ai-gateway"
import {
  exchangePersonalAccessTokenForGatewayApiKey,
  shouldRefreshApiKey,
} from "@/lib/exchange-token"
import type { IronSession } from "iron-session"

export interface CreditsResponse {
  balance: string
  totalUsed: string
  buyCreditsUrl: string
}

export const dynamic = "force-dynamic"

/**
 * Obtain a fresh API key and save it to the session.
 */
async function refreshApiKey(
  session: IronSession<SessionData>,
  accessToken: string,
): Promise<string | null> {
  try {
    let teamId = session.teamId
    if (!teamId) {
      const authUser = await getAuthenticatedUser(accessToken)
      if (!authUser?.teamId) {
        console.error("[credits] No team ID found for user during API key refresh")
        return null
      }
      teamId = authUser.teamId
      session.teamId = teamId
    }

    const newApiKey = await exchangePersonalAccessTokenForGatewayApiKey({
      personalAccessToken: accessToken,
      teamId: teamId!,
    })

    if (newApiKey) {
      session.apiKey = newApiKey
      session.apiKeyObtainedAt = Date.now()
      await session.save()
      console.log("[credits] Successfully refreshed API key")
      return newApiKey
    }

    console.error("[credits] Failed to exchange token for API key")
    return null
  } catch (error) {
    console.error("[credits] Error refreshing API key:", error)
    return null
  }
}

export async function GET() {
  try {
    const session = await getIronSessionData()

    if (!session?.isLoggedIn || !session?.accessToken) {
      return NextResponse.json(
        { error: "Not authenticated. Please sign in first.", needsAuth: true },
        { status: 401 },
      )
    }

    // Resolve teamId — use cached value or fetch it
    let teamId = session.teamId
    if (!teamId) {
      const authenticatedUser = await getAuthenticatedUser(session.accessToken)
      if (!authenticatedUser?.teamId) {
        return NextResponse.json(
          { error: "No team ID found for user", tokenExpired: true },
          { status: 401 },
        )
      }
      teamId = authenticatedUser.teamId
      session.teamId = teamId
      await session.save()
    }

    // Determine if we need to get or refresh the API key
    let apiKeyToUse: string | null = session.apiKey ?? null
    const needsRefresh =
      !apiKeyToUse || shouldRefreshApiKey(session.apiKeyObtainedAt)

    // Case 1: No API key — obtain one
    if (!apiKeyToUse) {
      apiKeyToUse = await refreshApiKey(session, session.accessToken)

      if (!apiKeyToUse) {
        return NextResponse.json(
          {
            error:
              "Unable to obtain API key. Please try signing out and back in.",
            needsTeamAuth: true,
          },
          { status: 401 },
        )
      }
    }
    // Case 2: API key exists but stale — proactively refresh
    else if (needsRefresh) {
      const newKey = await refreshApiKey(session, session.accessToken)
      if (newKey) {
        apiKeyToUse = newKey
      }
      // If refresh fails, continue with existing key
    }

    // Fetch credits and team info in parallel
    try {
      const [creditsResponse, teamResponse] = await Promise.all([
        getCredits(apiKeyToUse!),
        getUserTeam(session.accessToken, teamId!),
      ])

      return NextResponse.json<CreditsResponse>({
        balance: creditsResponse.balance,
        totalUsed: creditsResponse.total_used,
        buyCreditsUrl: `https://vercel.com/${teamResponse?.slug ?? teamId}/~/ai-gateway`,
      })
    } catch (error) {
      // Reactive refresh: if API key was rejected, get a new one and retry once
      const isApiKeyIssue =
        error instanceof AiGatewayError &&
        (error.status === 401 || error.status === 403)

      if (isApiKeyIssue) {
        console.log(
          "[credits] API key rejected (401/403), attempting reactive refresh...",
        )
        const newKey = await refreshApiKey(session, session.accessToken)

        if (newKey) {
          try {
            const [creditsResponse, teamResponse] = await Promise.all([
              getCredits(newKey),
              getUserTeam(session.accessToken, teamId!),
            ])

            return NextResponse.json<CreditsResponse>({
              balance: creditsResponse.balance,
              totalUsed: creditsResponse.total_used,
              buyCreditsUrl: `https://vercel.com/${teamResponse?.slug ?? teamId}/~/ai-gateway`,
            })
          } catch (retryError) {
            console.error("[credits] Retry also failed:", retryError)
          }
        }

        return NextResponse.json(
          {
            error:
              "Unable to access AI Gateway. Please try signing out and back in.",
            needsTeamAuth: true,
          },
          { status: 401 },
        )
      }

      throw error
    }
  } catch (error) {
    console.error("Error fetching credits:", error)

    if (
      error instanceof Error &&
      error.message.includes("Vercel API error")
    ) {
      return NextResponse.json(
        { error: "Authentication expired", tokenExpired: true },
        { status: 401 },
      )
    }

    return NextResponse.json(
      { error: "Internal server error while fetching credits" },
      { status: 500 },
    )
  }
}
