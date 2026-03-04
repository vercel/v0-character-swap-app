"use client"

import { useState } from "react"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface WelcomePageProps {
  onStart: () => void
}

export function WelcomePage({ onStart }: WelcomePageProps) {
  const [demoPlaying, setDemoPlaying] = useState(false)

  const { data: showcaseData } = useSWR<{ generations: { video_url: string; source_video_url: string | null; character_image_url: string | null; character_name: string | null }[] }>(
    "/api/generations/showcase",
    fetcher,
    { dedupingInterval: 60000 }
  )
  const demo = showcaseData?.generations?.[0] || null

  return (
    <div className="relative flex h-full w-full flex-col overflow-y-auto bg-white">
      {/* Logo — top-left on desktop */}
      <h1 className="absolute left-6 top-5 z-10 hidden text-2xl font-pixel text-black md:block">v0 FaceSwap</h1>

      {/* Content */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-20 md:pb-6">
        <div className="w-full max-w-md text-center">
          {/* Title */}
          <h1 className="mb-2 text-2xl font-pixel text-black md:hidden">v0 FaceSwap</h1>
          <h2 className="mb-2 text-2xl font-bold text-black md:text-3xl">
            Turn yourself into a cartoon
          </h2>
          <p className="mb-6 text-[15px] leading-relaxed text-black/45 md:mb-8">
            Record a short video and AI will animate any cartoon character as you. Your expressions, your movements, their style.
          </p>

          {/* Demo video — 16:9 with PiP */}
          {demo && (
            <div className="mx-auto mb-6 w-full max-w-[420px] md:mb-8">
              <div
                className="relative aspect-video cursor-pointer overflow-hidden rounded-2xl bg-neutral-100 shadow-lg ring-1 ring-black/5"
                onClick={() => {
                  const container = document.getElementById("demo-container")
                  if (!container) return
                  const main = container.querySelector<HTMLVideoElement>("[data-main]")
                  const pip = container.querySelector<HTMLVideoElement>("[data-pip]")
                  if (!main) return
                  if (main.paused) {
                    main.muted = false
                    main.play()
                    if (pip) { pip.currentTime = main.currentTime; pip.play() }
                    setDemoPlaying(true)
                  } else {
                    main.pause()
                    pip?.pause()
                    setDemoPlaying(false)
                  }
                }}
                id="demo-container"
              >
                <video
                  data-main
                  src={demo.video_url}
                  className="h-full w-full object-cover"
                  muted
                  loop
                  playsInline
                  preload="auto"
                  onTimeUpdate={(e) => {
                    const pip = document.querySelector<HTMLVideoElement>("[data-pip]")
                    if (pip && Math.abs(pip.currentTime - e.currentTarget.currentTime) > 0.15) {
                      pip.currentTime = e.currentTarget.currentTime
                    }
                  }}
                />
                {/* PiP — source video, always visible */}
                {demo.source_video_url && (
                  <div className="absolute bottom-3 right-3 aspect-video w-24 overflow-hidden rounded-lg border-2 border-white/30 shadow-lg md:w-28">
                    <video
                      data-pip
                      src={demo.source_video_url}
                      className="h-full w-full object-cover"
                      muted
                      loop
                      playsInline
                      preload="auto"
                    />
                  </div>
                )}
                {!demoPlaying && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/20">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg">
                      <svg className="ml-0.5 h-6 w-6 text-black" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                    <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                      See it in action
                    </span>
                  </div>
                )}
                {/* Character badge */}
                {demo.character_image_url && (
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-white/90 py-1 pl-1 pr-2.5 shadow-sm backdrop-blur-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={demo.character_image_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                    <span className="text-[11px] font-medium text-black/70">{demo.character_name}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* How it works */}
          <div className="mb-6 flex items-center justify-center gap-3 md:mb-8 md:gap-4">
            <div className="flex flex-col items-center gap-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-xs font-bold text-white">1</span>
              <span className="text-[11px] text-black/50">Pick a cartoon</span>
            </div>
            <svg className="h-3 w-3 shrink-0 text-black/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            <div className="flex flex-col items-center gap-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/10 text-xs font-bold text-black/40">2</span>
              <span className="text-[11px] text-black/50">Record yourself</span>
            </div>
            <svg className="h-3 w-3 shrink-0 text-black/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            <div className="flex flex-col items-center gap-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/10 text-xs font-bold text-black/40">3</span>
              <span className="text-[11px] text-black/50">AI transforms you</span>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={onStart}
            className="mx-auto flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-black text-[15px] font-semibold text-white shadow-sm transition-all hover:bg-gray-800 active:scale-[0.98]"
          >
            Get started
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Powered by */}
          <p className="mt-4 text-[11px] text-black/30">
            Powered by{" "}
            <a href="https://vercel.com/ai-gateway" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-black/50">AI Gateway</a>
            {" · "}
            <a href="https://v0.app/templates/face-swap-template-1Nu0E0eAo9q" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-black/50">Open in v0</a>
          </p>
        </div>
      </div>
    </div>
  )
}
