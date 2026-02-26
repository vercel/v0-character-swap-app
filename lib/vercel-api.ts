export async function fetchVercelApi<T = any>(
  endpoint: string,
  accessToken: string,
  options?: RequestInit,
): Promise<T> {
  const url = `https://api.vercel.com${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Vercel API error: ${response.status} - ${error}`)
  }

  return response.json() as Promise<T>
}
