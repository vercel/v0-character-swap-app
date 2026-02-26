import { cookies } from "next/headers"
import crypto from "node:crypto"
import { getIronSessionData } from "./secure-session"

export interface VercelUser {
  id: string
  email: string
  name: string
  avatar?: string
}

export interface AuthSession {
  user: VercelUser
  accessToken: string
  refreshToken?: string
  teamId?: string
  apiKey?: string
  apiKeyObtainedAt?: number
  expiresAt?: number
}

const STATE_COOKIE = "oauth_state"
const VERIFIER_COOKIE = "oauth_verifier"

// Generate a secure random string
function generateSecureRandomString(length: number): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
  const randomBytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(randomBytes, (byte) => charset[byte % charset.length]).join("")
}

// Generate code challenge from verifier (SHA256 + base64url)
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest("SHA-256", data)
  const base64 = Buffer.from(digest).toString("base64")
  // Convert to base64url
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return "http://localhost:3000"
}

// ── Session management (backed by iron-session) ─────────────────────────

export async function getSession(): Promise<AuthSession | null> {
  const session = await getIronSessionData()

  if (!session.isLoggedIn || !session.email) {
    return null
  }

  return {
    user: {
      id: session.userId || "",
      email: session.email,
      name: session.name || "",
      avatar: session.picture,
    },
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    teamId: session.teamId,
    apiKey: session.apiKey,
    apiKeyObtainedAt: session.apiKeyObtainedAt,
    expiresAt: session.expiresAt,
  }
}

export async function verifySession(): Promise<AuthSession | null> {
  return getSession()
}

export async function setSession(data: AuthSession): Promise<void> {
  const session = await getIronSessionData()
  session.userId = data.user.id
  session.email = data.user.email
  session.name = data.user.name
  session.picture = data.user.avatar
  session.accessToken = data.accessToken
  session.refreshToken = data.refreshToken
  session.teamId = data.teamId
  session.apiKey = data.apiKey
  session.apiKeyObtainedAt = data.apiKeyObtainedAt
  session.expiresAt = data.expiresAt || 0
  session.isLoggedIn = true
  await session.save()
}

export async function clearSession(): Promise<void> {
  const session = await getIronSessionData()
  session.destroy()

  // Also delete the old plain-text cookie from before the iron-session migration
  const cookieStore = await cookies()
  cookieStore.delete("vercel_session")
}

// ── OAuth utilities ─────────────────────────────────────────────────────

export async function createAuthUrl(): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID!
  const baseUrl = getBaseUrl()
  const redirectUri = `${baseUrl}/api/auth/callback`
  
  // Generate PKCE values
  const state = generateSecureRandomString(32)
  const codeVerifier = generateSecureRandomString(64)
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  
  // Store state and verifier in cookies
  const cookieStore = await cookies()
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  }
  
  cookieStore.set(STATE_COOKIE, state, cookieOptions)
  cookieStore.set(VERIFIER_COOKIE, codeVerifier, cookieOptions)
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "openid email profile offline_access",
    response_type: "code",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  })
  
  return `https://vercel.com/oauth/authorize?${params.toString()}`
}

export async function getOAuthCookies(): Promise<{ state: string | null; verifier: string | null }> {
  const cookieStore = await cookies()
  return {
    state: cookieStore.get(STATE_COOKIE)?.value || null,
    verifier: cookieStore.get(VERIFIER_COOKIE)?.value || null,
  }
}

export async function clearOAuthCookies(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(STATE_COOKIE)
  cookieStore.delete(VERIFIER_COOKIE)
}

// ── Vercel API helpers (for wallet / credits) ───────────────────────────

// Fetch the authenticated user's info from Vercel API (includes defaultTeamId)
export async function getAuthenticatedUser(accessToken: string) {
  try {
    const response = await fetch("https://api.vercel.com/v2/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) return null

    const data = await response.json()
    return {
      user: data.user,
      teamId: data.user?.defaultTeamId || data.user?.id,
    }
  } catch (error) {
    console.error("Error fetching authenticated user:", error)
    return null
  }
}

// Fetch team info (including slug for buy-credits URL)
interface TeamResponse {
  id: string
  slug: string
  name: string
  [key: string]: unknown
}

export async function getUserTeam(
  accessToken: string,
  teamId: string,
): Promise<TeamResponse | null> {
  try {
    const response = await fetch(`https://api.vercel.com/v2/teams/${teamId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      console.error("Error fetching team:", response.status, response.statusText)
      return null
    }

    return (await response.json()) as TeamResponse
  } catch (error) {
    console.error("Error fetching user team:", error)
    return null
  }
}
