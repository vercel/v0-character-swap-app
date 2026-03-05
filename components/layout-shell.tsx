"use client"

import { useState, useCallback, useRef, useEffect, type ReactNode } from "react"
import { SidebarStrip } from "@/components/sidebar-strip"
import { useCredits } from "@/hooks/use-credits"
import { useViewer } from "@/providers/viewer-context"
import { useVideoDownload } from "@/hooks/use-video-download"
import { useCloudinaryPrewarm } from "@/hooks/use-cloudinary-prewarm"
import { cn } from "@/lib/utils"

function toMp4Url(url: string | null): string | null {
  if (!url) return null
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (!cloudName) return url
  if (!url.includes(".public.blob.vercel-storage.com")) return url
  return `https://res.cloudinary.com/${cloudName}/video/fetch/f_mp4,vc_h264,ac_aac/${encodeURIComponent(url)}`
}

export function LayoutShell({ children }: { children: ReactNode }) {
  const { balance, creditsLoading, error: creditsError, refresh: refreshCredits } = useCredits()
  const viewer = useViewer()

  // Escape key closes viewer overlay
  const viewerCloseRef = useRef(viewer.close)
  viewerCloseRef.current = viewer.close
  const isViewerOpen = !!viewer.data || !!viewer.error
  useEffect(() => {
    if (!isViewerOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        viewerCloseRef.current()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isViewerOpen])

  // Buy credits modal state
  const [showBuyOptions, setShowBuyOptions] = useState(false)
  const [buyAmount, setBuyAmount] = useState("")
  const [purchasing, setPurchasing] = useState(false)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)

  const parsedBuyAmount = Number.parseFloat(buyAmount)
  const isValidBuyAmount = buyAmount !== "" && Number.isFinite(parsedBuyAmount) && parsedBuyAmount > 0

  const handleBuyCredits = useCallback(async (amount: number) => {
    if (!amount || amount <= 0) return
    setPurchasing(true)
    setPurchaseError(null)
    try {
      const res = await fetch("/api/credits/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPurchaseError(data.error || `Purchase failed (${res.status})`)
        return
      }
      if (data.checkoutSessionUrl) {
        window.location.href = data.checkoutSessionUrl
        return
      }
      refreshCredits()
      setShowBuyOptions(false)
      setBuyAmount("")
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setPurchasing(false)
    }
  }, [refreshCredits])

  return (
    <main className="relative flex h-[100dvh] flex-row overflow-hidden bg-white">
      {/* Main content area */}
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">
        {children}

        {/* Video Viewer Overlay — inside content area so sidebar stays visible */}
        {viewer.data && <VideoOverlay />}

        {/* Error Viewer Overlay */}
        {viewer.error && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-white">
          <button
            onClick={viewer.close}
            className="absolute left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black/10 text-black transition-colors hover:bg-black/20"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex flex-col items-center gap-5 px-8">
            {viewer.error.characterImageUrl && (
              <div className="h-20 w-20 overflow-hidden rounded-xl bg-neutral-100 ring-1 ring-neutral-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={viewer.error.characterImageUrl} alt="" className="h-full w-full object-cover object-top" />
              </div>
            )}
            <div className="max-w-xs text-center">
              <p className="mb-3 text-xl font-pixel text-black">Generation Failed</p>
              <p className="text-sm leading-relaxed text-black/50">{viewer.error.message}</p>
            </div>
            <button
              onClick={viewer.close}
              className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
            >
              close
            </button>
          </div>
        </div>
      )}
      </div>

      {/* Sidebar Strip */}
      <SidebarStrip
        onBuyCredits={() => { setShowBuyOptions(true); setPurchaseError(null); setBuyAmount("") }}
      />

      {/* Buy Credits Modal */}
      {showBuyOptions && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => { setShowBuyOptions(false); setBuyAmount(""); setPurchaseError(null) }}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-semibold text-black">Buy Credits</h2>
            <p className="mb-4 text-sm text-black/50">
              {!creditsLoading && !creditsError && (
                <>Current balance: <span className="tabular-nums font-medium text-black">${Number.parseFloat(balance).toFixed(2)}</span></>
              )}
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 25, 50].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setBuyAmount(String(amount))}
                    disabled={purchasing}
                    className={`rounded-xl border py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      buyAmount === String(amount)
                        ? "border-black bg-black text-white"
                        : "border-neutral-200 text-black hover:border-neutral-400 hover:text-black"
                    }`}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-black/40">$</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    placeholder="Custom amount"
                    value={buyAmount}
                    onChange={(e) => { setBuyAmount(e.target.value); setPurchaseError(null) }}
                    disabled={purchasing}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 pl-7 pr-3 text-sm tabular-nums text-black placeholder:text-black/40 focus:border-neutral-400 focus:outline-none disabled:opacity-40"
                  />
                </div>
              </div>
              {purchaseError && (
                <p className="text-xs text-red-500">{purchaseError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setShowBuyOptions(false); setBuyAmount(""); setPurchaseError(null) }}
                  disabled={purchasing}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm text-black/50 transition-colors hover:text-black disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleBuyCredits(parsedBuyAmount)}
                  disabled={!isValidBuyAmount || purchasing}
                  className="flex-1 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {purchasing ? "Processing..." : "Purchase"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

/** Fullscreen video player overlay — reads from ViewerContext, owns all player state */
function VideoOverlay() {
  const { data, close } = useViewer()
  const mainVideoRef = useRef<HTMLVideoElement>(null)
  const pipVideoRef = useRef<HTMLVideoElement>(null)

  const [showPip, setShowPip] = useState(true)
  const [videoProgress, setVideoProgress] = useState(0)

  if (!data) return null

  const { videoUrl, sourceVideoUrl, sourceAspectRatio, characterName, characterImageUrl } = data
  const pipSrc = toMp4Url(sourceVideoUrl) || sourceVideoUrl
  const hasPipSource = !!sourceVideoUrl
  const pipAspectRatio = sourceAspectRatio

  // Download uses raw blob URL (Cloudinary API validates blob URLs)
  // Playback uses pipSrc (Cloudinary-converted MP4 for cross-browser)
  const { isDownloading, downloadProgress, handleDownload } = useVideoDownload({
    resultUrl: videoUrl,
    pipVideoUrl: sourceVideoUrl,
    showPip,
    pipAspectRatio,
    characterName,
  })

  useCloudinaryPrewarm({
    resultUrl: videoUrl,
    pipVideoUrl: sourceVideoUrl,
    showPip,
  })

  return (
    <div className="absolute inset-0 z-40 bg-black">
      {/* Close button */}
      <button
        onClick={close}
        className="absolute left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <video
        key={videoUrl}
        ref={mainVideoRef}
        src={videoUrl}
        muted
        loop
        playsInline
        preload="auto"
        poster={characterImageUrl
          ? (characterImageUrl.startsWith("http")
            ? `/_next/image?url=${encodeURIComponent(characterImageUrl)}&w=640&q=75`
            : characterImageUrl)
          : undefined}
        className="h-full w-full cursor-pointer object-contain md:object-cover"
        onClick={(e) => {
          const v = e.currentTarget
          if (v.paused) v.play(); else v.pause()
        }}
        onLoadedData={(e) => {
          e.currentTarget.muted = false
          e.currentTarget.play()
        }}
        onPlay={() => {
          const pip = pipVideoRef.current
          if (pip) {
            pip.currentTime = mainVideoRef.current?.currentTime || 0
            pip.play()
          }
        }}
        onPause={() => { pipVideoRef.current?.pause() }}
        onSeeked={() => {
          if (pipVideoRef.current && mainVideoRef.current) {
            pipVideoRef.current.currentTime = mainVideoRef.current.currentTime
          }
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget
          if (v.duration) setVideoProgress(v.currentTime / v.duration)
          const pip = pipVideoRef.current
          if (pip && v) {
            const diff = Math.abs(pip.currentTime - v.currentTime)
            if (diff > 0.15) pip.currentTime = v.currentTime
          }
        }}
      />

      {/* PiP video — always mounted when source exists, visibility toggled via CSS */}
      {hasPipSource && (
        <div className={cn(
          "absolute bottom-20 right-4 overflow-hidden rounded-lg border-2 border-black/20 shadow-lg transition-opacity",
          showPip ? "opacity-100" : "pointer-events-none opacity-0",
          pipAspectRatio === "9:16" && "aspect-[9/16] h-28 md:h-40",
          pipAspectRatio !== "9:16" && "aspect-video w-28 md:w-48"
        )}>
          <video
            ref={pipVideoRef}
            src={pipSrc || ""}
            muted loop playsInline preload="auto"
            className="h-full w-full object-cover"
            onLoadedData={() => {
              const main = mainVideoRef.current
              const pip = pipVideoRef.current
              if (main && pip && main.readyState >= 2) {
                pip.currentTime = main.currentTime
                pip.play()
              }
            }}
          />
        </div>
      )}

      {/* Controls */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-4 pb-4 pt-10">
        <div
          className="h-1 w-full cursor-pointer rounded-full bg-white/20"
          onClick={(e) => {
            if (!mainVideoRef.current) return
            const rect = e.currentTarget.getBoundingClientRect()
            const pct = (e.clientX - rect.left) / rect.width
            mainVideoRef.current.currentTime = pct * mainVideoRef.current.duration
          }}
        >
          <div className="h-full rounded-full bg-white" style={{ width: `${videoProgress * 100}%` }} />
        </div>
        <div className="flex items-center justify-center gap-2.5">
          <button
            disabled={isDownloading}
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-1.5 text-[13px] font-medium text-white backdrop-blur-sm transition-all hover:bg-white/25 active:scale-95 disabled:opacity-70"
          >
            {isDownloading ? (
              <>
                <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {Math.round(downloadProgress * 100)}%
              </>
            ) : (
              <>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                download
              </>
            )}
          </button>
          <button
            onClick={close}
            className="rounded-full bg-white/15 px-4 py-1.5 text-[13px] font-medium text-white backdrop-blur-sm transition-all hover:bg-white/25 active:scale-95"
          >
            close
          </button>
          {hasPipSource && (
            <button
              onClick={() => setShowPip(!showPip)}
              className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-medium text-white backdrop-blur-sm transition-all hover:bg-white/25 active:scale-95"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <rect x="12" y="10" width="8" height="5" rx="1" />
              </svg>
              pip
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
