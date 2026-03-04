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
            className="text-[9px] font-semibold uppercase tracking-wider text-black transition-opacity hover:opacity-60"
          >
            sign in
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

      {/* Bottom: Open in v0 */}
      <div className="mt-2 shrink-0">
        <a
          href="https://v0.app/templates/face-swap-template-1Nu0E0eAo9q"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1 text-black/30 transition-colors hover:text-black/60"
          title="Open in v0"
        >
          <svg className="h-4 w-auto" viewBox="0 0 252 120" fill="currentColor">
            <path d="M96 86.0625V24H120V103.125C120 112.445 112.445 120 103.125 120C98.6751 120 94.2826 118.284 91.125 115.127L0 24H33.9375L96 86.0625Z" />
            <path d="M218.25 0C236.89 0 252 15.1104 252 33.75V96H228V41.0625L173.062 96H228V120H165.75C147.11 120 132 104.89 132 86.25V24H156V79.125L211.125 24H156V0H218.25Z" />
          </svg>
          <span className="text-[8px] leading-tight">Open in v0</span>
        </a>
      </div>
    </div>
  )
}
