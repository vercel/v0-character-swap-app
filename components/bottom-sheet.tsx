"use client"

import { useRef, useEffect, useCallback, type ReactNode } from "react"

interface BottomSheetProps {
  peek: ReactNode
  children: ReactNode
  isExpanded: boolean
  onExpandedChange: (expanded: boolean) => void
  peekHeight?: number
}

/**
 * Mobile bottom sheet with spring physics.
 *
 * All drag/animation runs via rAF + direct DOM manipulation — zero React
 * re-renders during interaction. Spring animation on release for native feel.
 */
export function BottomSheet({
  peek,
  children,
  isExpanded,
  onExpandedChange,
  peekHeight = 100,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const peekRef = useRef<HTMLDivElement>(null)
  const expandedRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // All mutable state in refs — no React renders during drag/animation
  const offsetRef = useRef(0)
  const velocityRef = useRef(0)
  const isDraggingRef = useRef(false)
  const startYRef = useRef(0)
  const startOffsetRef = useRef(0)
  const animFrameRef = useRef(0)
  const lastTouchTimeRef = useRef(0)
  const lastTouchYRef = useRef(0)
  const isExpandedRef = useRef(isExpanded)
  const internalChangeRef = useRef(false)

  const expandedHeight = useRef(
    typeof window !== "undefined" ? Math.round(window.innerHeight * 0.7) : 400,
  ).current
  const maxOffset = expandedHeight - peekHeight

  // Apply current offset to DOM — no React involved
  const applyOffset = useCallback(
    (offset: number) => {
      const sheet = sheetRef.current
      const peekEl = peekRef.current
      const expandedEl = expandedRef.current
      if (!sheet) return

      sheet.style.transform = `translateY(${offset}px)`

      const progress = 1 - offset / maxOffset
      if (peekEl) {
        peekEl.style.opacity = String(Math.max(0, 1 - progress * 2.5))
        peekEl.style.pointerEvents = progress > 0.4 ? "none" : "auto"
      }
      if (expandedEl) {
        expandedEl.style.opacity = String(Math.min(1, progress * 2))
        expandedEl.style.pointerEvents = progress < 0.4 ? "none" : "auto"
      }
    },
    [maxOffset],
  )

  // Spring animation from current position/velocity to target
  const animateTo = useCallback(
    (target: number) => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)

      // Disable scrolling during animation
      if (contentRef.current) contentRef.current.style.overflowY = "hidden"

      let current = offsetRef.current
      let v = velocityRef.current
      let lastTime = performance.now()

      const step = (now: number) => {
        if (isDraggingRef.current) return // Drag took over

        const dt = Math.min((now - lastTime) / 1000, 0.032)
        lastTime = now

        // Spring: stiffness pulls toward target, damping slows oscillation
        const stiffness = 400
        const damping = 35
        const force = -stiffness * (current - target)
        const dampingForce = -damping * v
        v += (force + dampingForce) * dt
        current += v * dt

        offsetRef.current = current
        applyOffset(current)

        // Settle when close enough and slow enough
        if (Math.abs(current - target) < 0.5 && Math.abs(v) < 10) {
          offsetRef.current = target
          velocityRef.current = 0
          applyOffset(target)

          // Enable scrolling when fully expanded
          if (contentRef.current) {
            contentRef.current.style.overflowY = target === 0 ? "auto" : "hidden"
          }
          return
        }

        animFrameRef.current = requestAnimationFrame(step)
      }

      animFrameRef.current = requestAnimationFrame(step)
    },
    [applyOffset],
  )

  // Sync with prop changes (programmatic expand/collapse)
  useEffect(() => {
    isExpandedRef.current = isExpanded

    // Skip if we triggered this change ourselves (already animating)
    if (internalChangeRef.current) {
      internalChangeRef.current = false
      return
    }

    if (!isDraggingRef.current) {
      animateTo(isExpanded ? 0 : maxOffset)
    }
  }, [isExpanded, maxOffset, animateTo])

  // Touch handlers — registered once, use refs for all state
  useEffect(() => {
    const el = sheetRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      // Cancel any running animation
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)

      isDraggingRef.current = true
      startYRef.current = e.touches[0].clientY
      startOffsetRef.current = offsetRef.current
      lastTouchTimeRef.current = performance.now()
      lastTouchYRef.current = e.touches[0].clientY
      velocityRef.current = 0

      // Lock scrolling during drag
      if (contentRef.current) contentRef.current.style.overflowY = "hidden"
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return
      e.preventDefault() // Block Safari bounce / body scroll

      const touchY = e.touches[0].clientY
      const now = performance.now()
      const dt = (now - lastTouchTimeRef.current) / 1000

      // Track velocity (px/s) for spring seeding
      if (dt > 0.001) {
        const instantV = (touchY - lastTouchYRef.current) / dt
        // Smooth velocity with exponential moving average
        velocityRef.current = velocityRef.current * 0.4 + instantV * 0.6
      }
      lastTouchTimeRef.current = now
      lastTouchYRef.current = touchY

      const deltaY = touchY - startYRef.current
      const offset = Math.max(0, Math.min(startOffsetRef.current + deltaY, maxOffset))
      offsetRef.current = offset
      applyOffset(offset)
    }

    const onTouchEnd = () => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false

      const offset = offsetRef.current
      const v = velocityRef.current

      // Snap decision: velocity-based for flicks, position-based otherwise
      let shouldExpand: boolean
      if (Math.abs(v) > 400) {
        shouldExpand = v < 0 // Flick up → expand
      } else {
        shouldExpand = offset < maxOffset / 2
      }

      const target = shouldExpand ? 0 : maxOffset

      // Seed spring with finger velocity (slightly dampened)
      velocityRef.current = v * 0.6
      animateTo(target)

      if (shouldExpand !== isExpandedRef.current) {
        internalChangeRef.current = true
        onExpandedChange(shouldExpand)
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true })
    el.addEventListener("touchmove", onTouchMove, { passive: false })
    el.addEventListener("touchend", onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener("touchstart", onTouchStart)
      el.removeEventListener("touchmove", onTouchMove)
      el.removeEventListener("touchend", onTouchEnd)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [maxOffset, applyOffset, animateTo, onExpandedChange])

  // Set initial position on mount (no animation)
  useEffect(() => {
    const target = isExpandedRef.current ? 0 : maxOffset
    offsetRef.current = target
    applyOffset(target)
    if (contentRef.current) {
      contentRef.current.style.overflowY = isExpandedRef.current ? "auto" : "hidden"
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={sheetRef}
      className="fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-3xl bg-neutral-950"
      style={{
        height: `${expandedHeight}px`,
        willChange: "transform",
        transform: `translateY(${isExpanded ? 0 : maxOffset}px)`,
      }}
    >
      {/* Handle */}
      <div
        className="flex shrink-0 cursor-grab items-center justify-center py-2 active:cursor-grabbing"
        onClick={() => onExpandedChange(!isExpanded)}
      >
        <div className="h-1 w-8 rounded-full bg-neutral-700" />
      </div>

      {/* Content area */}
      <div
        ref={contentRef}
        className="relative min-h-0 flex-1 overscroll-contain px-3 pb-[max(12px,env(safe-area-inset-bottom))]"
        style={{ overflowY: isExpanded ? "auto" : "hidden" }}
      >
        {/* Peek content */}
        <div
          ref={peekRef}
          className="absolute inset-x-3 top-0 z-10"
          style={{
            opacity: isExpanded ? 0 : 1,
            pointerEvents: isExpanded ? "none" : "auto",
          }}
        >
          {peek}
        </div>

        {/* Expanded content */}
        <div
          ref={expandedRef}
          style={{
            opacity: isExpanded ? 1 : 0,
            pointerEvents: isExpanded ? "auto" : "none",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
