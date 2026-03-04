import { getIronSession, type IronSession, type SessionOptions } from "iron-session"
import { cookies } from "next/headers"

export interface SessionData {
  // User identity
  userId?: string
  email: string
  name?: string
  picture?: string
  // Auth tokens
  accessToken: string
  refreshToken?: string
  // Wallet / AI Gateway
  apiKey?: string
  apiKeyObtainedAt?: number
  teamId?: string
  // Session metadata
  expiresAt: number
  isLoggedIn: boolean
}

function getSessionOptions(): SessionOptions {
  if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET environment variable is required in production")
  }

  const sessionSecret =
    process.env.SESSION_SECRET ||
    "default-secret-for-development-only-not-secure-32-chars-minimum"

  return {
    password: sessionSecret,
    cookieName: "vercel_auth_session",
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * 90, // 90 days
      path: "/",
    },
  }
}

/**
 * Get the raw iron-session. Used by the credits API route
 * which needs to mutate session fields directly (e.g. refreshing apiKey).
 */
export async function getIronSessionData(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, getSessionOptions())
}
