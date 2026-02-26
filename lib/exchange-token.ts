import { fetchVercelApi } from "./vercel-api"

/**
 * Check if we should proactively refresh the API key based on when it was obtained.
 * Refresh if older than 4 hours.
 */
export function shouldRefreshApiKey(obtainedAt: number | undefined): boolean {
  if (!obtainedAt) return true
  const FOUR_HOURS = 4 * 60 * 60 * 1000
  return Date.now() - obtainedAt > FOUR_HOURS
}

/**
 * Exchange a Vercel access token for an AI Gateway API key.
 */
export async function exchangePersonalAccessTokenForGatewayApiKey({
  personalAccessToken,
  teamId,
}: {
  personalAccessToken: string
  teamId: string
}): Promise<string | null> {
  try {
    const data = await fetchVercelApi(`/api-keys?teamId=${teamId}`, personalAccessToken, {
      method: "POST",
      body: JSON.stringify({
        purpose: "ai-gateway",
        name: "AI Wallet API Key",
        exchange: true,
      }),
    })

    return data.apiKeyString || null
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error("[exchange-token] Failed to exchange PAT:", errorMsg.substring(0, 200))
    return null
  }
}
