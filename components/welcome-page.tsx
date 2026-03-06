"use client"

import { useState, useRef } from "react"

interface WelcomePageProps {
  onStart: () => void
}

export function WelcomePage({ onStart }: WelcomePageProps) {
  const [demoPlaying, setDemoPlaying] = useState(false)
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [demosReady, setDemosReady] = useState(false)
  const mainLoadedRef = useRef(false)
  const pipLoadedRef = useRef(false)

  // Hardcoded demo — always the same video
  const demo = {
    video_url: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/generations/21-1772643743115.mp4",
    source_video_url: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/videos/1772643422835-recording-cfKTyEBFxWaTSDktsZXxJIpeu9KZrS.mp4",
    character_image_url: "https://7zjbnnvanyvles15.public.blob.vercel-storage.com/characters/1772643430646-character-W1YQ8gzFMYFGErIHZWK0S8bSOoBEVZ.jpg",
    character_name: "Firefighter",
  }


  return (
    <div className="relative flex h-full w-full flex-col overflow-y-auto bg-white">
      {/* Logo */}
      <div className="absolute left-6 top-5 z-10 hidden items-center gap-2 md:flex">
        <svg className="h-4 w-auto text-black" viewBox="0 0 252 120" fill="currentColor">
          <path d="M96 86.0625V24H120V103.125C120 112.445 112.445 120 103.125 120C98.6751 120 94.2826 118.284 91.125 115.127L0 24H33.9375L96 86.0625Z" />
          <path d="M218.25 0C236.89 0 252 15.1104 252 33.75V96H228V41.0625L173.062 96H228V120H165.75C147.11 120 132 104.89 132 86.25V24H156V79.125L211.125 24H156V0H218.25Z" />
        </svg>
        <span className="text-2xl font-pixel text-black">FaceSwap</span>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-20 md:pb-6">
        <div className="w-full max-w-xl text-center">
          {/* Logo — mobile only, above everything */}
          <div className="-mt-4 mb-5 flex items-center justify-center gap-3 md:hidden">
            <svg className="h-7 w-auto text-black" viewBox="0 0 252 120" fill="currentColor">
              <path d="M96 86.0625V24H120V103.125C120 112.445 112.445 120 103.125 120C98.6751 120 94.2826 118.284 91.125 115.127L0 24H33.9375L96 86.0625Z" />
              <path d="M218.25 0C236.89 0 252 15.1104 252 33.75V96H228V41.0625L173.062 96H228V120H165.75C147.11 120 132 104.89 132 86.25V24H156V79.125L211.125 24H156V0H218.25Z" />
            </svg>
            <span className="text-4xl font-pixel text-black">FaceSwap</span>
          </div>
          <h2 className="mb-6 text-2xl text-black md:mb-8 md:text-3xl">
            Turn yourself into a cartoon
          </h2>

          {/* Demo video placeholder (always reserves space) */}
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
                  // Sync PiP time before playing both together
                  if (pip) pip.currentTime = main.currentTime
                  main.play()
                  if (pip) pip.play()
                  setDemoPlaying(true)
                } else {
                  main.pause()
                  pip?.pause()
                  setDemoPlaying(false)
                }
              }}
              id="demo-container"
            >

              {demo && (
                <>
                  {/* Poster image — always visible immediately */}
                  {demo.character_image_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={`/_next/image?url=${encodeURIComponent(demo.character_image_url)}&w=640&q=75`}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  <video
                    data-main
                    src={demo.video_url}
                    className={`relative h-full w-full object-cover transition-opacity ${demosReady ? "opacity-100" : "opacity-0"}`}
                    muted
                    loop
                    playsInline
                    preload="auto"
                    onLoadedData={() => {
                      mainLoadedRef.current = true
                      if (pipLoadedRef.current) setDemosReady(true)
                    }}
                    onTimeUpdate={(e) => {
                      const pip = document.querySelector<HTMLVideoElement>("[data-pip]")
                      if (pip && Math.abs(pip.currentTime - e.currentTarget.currentTime) > 0.15) {
                        pip.currentTime = e.currentTarget.currentTime
                      }
                    }}
                  />
                  {/* PiP */}
                  {demo.source_video_url && (
                    <div className={`absolute bottom-3 right-3 aspect-video w-24 overflow-hidden rounded-lg border-2 border-white/30 shadow-lg transition-opacity md:w-28 ${demosReady ? "opacity-100" : "opacity-0"}`}>
                      <video
                        data-pip
                        src={demo.source_video_url}
                        className="h-full w-full object-cover"
                        muted
                        loop
                        playsInline
                        preload="auto"
                        onLoadedData={() => {
                          pipLoadedRef.current = true
                          if (mainLoadedRef.current) setDemosReady(true)
                        }}
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
                      <span className="text-[11px] font-medium text-black">{demo.character_name}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Steps */}
          <div className="mb-6 flex items-center justify-center gap-3 md:mb-8 md:gap-4">
            <div className="flex flex-col items-center gap-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-xs font-bold text-white">1</span>
              <span className="text-[11px] text-black">Pick a cartoon</span>
            </div>
            <svg className="h-3 w-3 shrink-0 text-black/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            <div className="flex flex-col items-center gap-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/10 text-xs font-bold text-black">2</span>
              <span className="text-[11px] text-black">Record yourself</span>
            </div>
            <svg className="h-3 w-3 shrink-0 text-black/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            <div className="flex flex-col items-center gap-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/10 text-xs font-bold text-black">3</span>
              <span className="text-[11px] text-black">AI transforms you</span>
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

          {/* Links */}
          <div className="mx-auto mt-4 flex w-full max-w-xs items-center gap-2.5">
            <button
              onClick={() => setShowHowItWorks(true)}
              className="flex h-10 flex-1 items-center justify-center rounded-xl bg-neutral-200 text-sm font-medium text-black/70 transition-colors hover:bg-neutral-300"
            >
              How it works
            </button>
            <a
              href="https://v0.app/templates/face-swap-template-1Nu0E0eAo9q"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-neutral-200 text-sm font-medium text-black/70 transition-colors hover:bg-neutral-300"
            >
              Open in
              <svg className="h-3 w-auto" viewBox="0 0 252 120" fill="currentColor">
                <path d="M96 86.0625V24H120V103.125C120 112.445 112.445 120 103.125 120C98.6751 120 94.2826 118.284 91.125 115.127L0 24H33.9375L96 86.0625Z" />
                <path d="M218.25 0C236.89 0 252 15.1104 252 33.75V96H228V41.0625L173.062 96H228V120H165.75C147.11 120 132 104.89 132 86.25V24H156V79.125L211.125 24H156V0H218.25Z" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* How it works modal */}
      {showHowItWorks && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setShowHowItWorks(false)}
          onKeyDown={(e) => { if (e.key === "Escape") setShowHowItWorks(false) }}
          tabIndex={0}
          ref={(el) => el?.focus()}
        >
          <div
            className="relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowHowItWorks(false)}
              className="absolute right-4 top-4 text-black transition-colors hover:text-black"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="mb-5 text-xl font-bold text-black">How it works</h2>

            <div className="space-y-4 text-[14px] leading-relaxed text-black">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-black">recording</p>
                <p>
                  You record a short video in your browser. The recording is uploaded to{" "}
                  <a href="https://vercel.com/docs/storage/vercel-blob" target="_blank" rel="noopener noreferrer" className="text-black underline underline-offset-2 hover:text-black">Vercel Blob</a>
                  {" "}in the background while you pick a character.
                </p>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-black">character generation</p>
                <p>
                  Default characters are pre-made illustrations. Custom characters are generated with{" "}
                  <a href="https://sdk.vercel.ai" target="_blank" rel="noopener noreferrer" className="text-black underline underline-offset-2 hover:text-black">AI SDK</a>
                  {" "}using Grok through{" "}
                  <a href="https://vercel.com/ai-gateway" target="_blank" rel="noopener noreferrer" className="text-black underline underline-offset-2 hover:text-black">AI Gateway</a>.
                </p>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-black">video generation</p>
                <p>
                  <a href="https://vercel.com/ai-gateway" target="_blank" rel="noopener noreferrer" className="text-black underline underline-offset-2 hover:text-black">AI Gateway</a>
                  {" "}routes the request to Kling Motion Control (klingai/kling-v2.6-motion-control). The model analyzes your facial landmarks, expressions, and head pose frame-by-frame, then transfers that motion onto the character image.
                </p>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-black">orchestration</p>
                <p>
                  A{" "}
                  <a href="https://useworkflow.dev/" target="_blank" rel="noopener noreferrer" className="text-black underline underline-offset-2 hover:text-black">Vercel Workflow</a>
                  {" "}handles the full pipeline: convert the video, call AI Gateway, save the result to{" "}
                  <a href="https://vercel.com/docs/storage/vercel-blob" target="_blank" rel="noopener noreferrer" className="text-black underline underline-offset-2 hover:text-black">Blob</a>
                  , update{" "}
                  <a href="https://neon.tech" target="_blank" rel="noopener noreferrer" className="text-black underline underline-offset-2 hover:text-black">Neon Postgres</a>
                  , and send an email notification. Workflows are durable: they survive serverless timeouts, browser closes, and network disconnections.
                </p>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-black">download</p>
                <p>
                  Downloads are composited server-side via Cloudinary: the generated video with a picture-in-picture overlay of your original recording.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 border-t border-neutral-100 pt-4 text-[12px] text-black">
                <span>Built with</span>
                <a href="https://nextjs.org" target="_blank" rel="noopener noreferrer" className="text-black underline underline-offset-2 hover:text-black">Next.js</a>
                <span>+</span>
                <a href="https://sdk.vercel.ai" target="_blank" rel="noopener noreferrer" className="text-black underline underline-offset-2 hover:text-black">AI SDK</a>
                <span>+</span>
                <a href="https://vercel.com/ai-gateway" target="_blank" rel="noopener noreferrer" className="text-black underline underline-offset-2 hover:text-black">AI Gateway</a>
                <span>+</span>
                <a href="https://useworkflow.dev/" target="_blank" rel="noopener noreferrer" className="text-black underline underline-offset-2 hover:text-black">Workflow</a>
                <span>+</span>
                <a href="https://v0.app" target="_blank" rel="noopener noreferrer" className="text-black underline underline-offset-2 hover:text-black">v0</a>
                <span>+</span>
                <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-black underline underline-offset-2 hover:text-black">Vercel</a>
              </div>

              <a
                href="https://v0.app/templates/face-swap-template-1Nu0E0eAo9q"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800"
              >
                Open in
                <svg className="h-3.5 w-auto" viewBox="0 0 252 120" fill="currentColor">
                  <path d="M96 86.0625V24H120V103.125C120 112.445 112.445 120 103.125 120C98.6751 120 94.2826 118.284 91.125 115.127L0 24H33.9375L96 86.0625Z" />
                  <path d="M218.25 0C236.89 0 252 15.1104 252 33.75V96H228V41.0625L173.062 96H228V120H165.75C147.11 120 132 104.89 132 86.25V24H156V79.125L211.125 24H156V0H218.25Z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
