"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { WelcomePage } from "@/components/welcome-page"

export default function Home() {
  const router = useRouter()

  // After login, the OAuth callback redirects to "/".
  // If we saved a return URL before login, redirect there now.
  useEffect(() => {
    const returnUrl = sessionStorage.getItem("loginReturnUrl")
    if (returnUrl) {
      sessionStorage.removeItem("loginReturnUrl")
      router.replace(returnUrl)
    }
  }, [router])

  return <WelcomePage onStart={() => router.push("/pick")} />
}
