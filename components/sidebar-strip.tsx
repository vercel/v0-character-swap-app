"use client"

import Image from "next/image"
import { useAuth } from "@/components/auth-provider"
import { useCredits } from "@/hooks/use-credits"
import { GenerationsPanel } from "@/components/generations-panel"
import { Coins, LogOut } from "lucide-react"
import { useState, useRef, useEffect } from "react"

interface SidebarStripProps {
  onSelectVideo: (videoUrl: string, sourceVideoUrl: string | null, sourceAspectRatio: "9:16" | "16:9" | "fill", generatedAspectRatio: "9:16" | "16:9" | "fill") => void
  onSelectError: (error: { message: string; characterName: string | null; characterImageUrl: string | null; createdAt: string }) => void
  onBuyCredits: () => void
}

export function SidebarStrip({ onSelectVideo, onSelectError, onBuyCredits }: SidebarStripProps) {
  const { user, isLoading: authLoading, login, logout } = useAuth()
  const { balance, creditsLoading, error: creditsError } = useCredits()
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showMenu) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [showMenu])

  return (
    <div className="flex h-full w-[72px] shrink-0 flex-col items-center border-l border-neutral-200 bg-white py-3">
      {/* User avatar or sign-in */}
      <div className="relative mb-2" ref={menuRef}>
        {user ? (
          <>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full transition-opacity hover:opacity-80"
            >
              {user.avatar ? (
                <Image src={user.avatar} alt={user.name || ""} width={40} height={40} className="rounded-full" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-black/10" />
              )}
            </button>
            {showMenu && (
              <div className="absolute right-full top-0 z-50 mr-2 min-w-[120px] rounded-lg border border-black/10 bg-white py-1 shadow-sm">
                <button
                  onClick={() => { setShowMenu(false); logout() }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-black/70 transition-colors hover:bg-black/5 hover:text-black"
                >
                  <LogOut className="h-3 w-3" />
                  sign out
                </button>
              </div>
            )}
          </>
        ) : !authLoading ? (
          <button
            onClick={login}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 transition-colors hover:bg-black/10"
            title="Sign in with Vercel"
          >
            <svg className="h-4 w-4 text-black/50" viewBox="0 0 76 65" fill="currentColor">
              <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
            </svg>
          </button>
        ) : (
          <div className="h-10 w-10 rounded-full bg-black/5" />
        )}
      </div>

      {/* Credits */}
      {user && (
        <button
          onClick={onBuyCredits}
          className="mb-3 flex flex-col items-center gap-0.5 transition-opacity hover:opacity-70"
          title="Buy credits"
        >
          <Coins className="h-3.5 w-3.5 text-yellow-500" />
          {creditsLoading ? (
            <span className="text-[10px] text-black/40">...</span>
          ) : creditsError ? (
            <span className="text-[10px] text-black/40">--</span>
          ) : (
            <span className="text-[10px] tabular-nums text-black/60">
              ${Number.parseFloat(balance).toFixed(0)}
            </span>
          )}
        </button>
      )}

      {/* Divider */}
      <div className="mx-2 mb-3 h-px w-8 bg-neutral-200" />

      {/* Generation thumbnails — vertical scroll */}
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5">
        <GenerationsPanel
          onSelectVideo={onSelectVideo}
          onSelectError={onSelectError}
          variant="sidebar"
        />
      </div>

      {/* Bottom: How it works */}
      <div className="mt-2 shrink-0">
        <a
          href="https://v0.app/templates/1Nu0E0eAo9q"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] text-black/30 transition-colors hover:text-black/60"
          title="Template in v0"
        >
          v0
        </a>
      </div>
    </div>
  )
}
