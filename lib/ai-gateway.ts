export interface GatewayCredits {
  balance: string
  total_used: string
}

export class AiGatewayError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "AiGatewayError"
    this.status = status
  }
}

export async function getCredits(apiKey: string): Promise<GatewayCredits> {
  return fetchAiGateway<GatewayCredits>("/v1/credits", apiKey)
}

async function fetchAiGateway<T>(endpoint: string, apiKey: string): Promise<T> {
  const response = await fetch(`https://ai-gateway.vercel.sh${endpoint}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    throw new AiGatewayError(
      `AI Gateway API error: ${response.status} ${response.statusText}`,
      response.status,
    )
  }

  return response.json() as T
}
