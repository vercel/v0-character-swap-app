"use client"

import { useState, useRef, useEffect, useLayoutEffect, useCallback, type ReactNode } from "react"

interface BottomSheetProps {
  peek: ReactNode
  children: ReactNode
  isExpanded: boolean
  onExpandedChange: (expanded: boolean) => void
  peekHeight?: number
}

export function BottomSheet({
  peek,
  children,
  isExpanded,
  onExpandedChange,
  peekHeight = 100
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const startYRef = useRef(0)
  const startOffsetRef = useRef(0)
  const dragOffsetRef = useRef<number | null>(null)
  const [renderOffset, setRenderOffset] = useState<number | null>(null)
  const [sheetHeight, setSheetHeight] = useState(0)
  const settledRef = useRef(false)
  const [settled, setSettled] = useState(false)

  const isDragging = renderOffset !== null

  // Measure before first paint to avoid flash
  useLayoutEffect(() => {
    if (sheetRef.current) setSheetHeight(sheetRef.current.offsetHeight)
  }, [])

  // Track content resizes after mount.
  // Suppress transitions until the sheet stabilizes (~500ms) so
  // images/data loading don't cause visible jumps.
  useEffect(() => {
    const el = sheetRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setSheetHeight(el.offsetHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      settledRef.current = true
      setSettled(true)
    }, 600)
    return () => clearTimeout(timer)
  }, [])

  const maxOffset = Math.max(0, sheetHeight - peekHeight)

  const progress = isDragging
    ? 1 - (renderOffset ?? 0) / (maxOffset || 1)
    : isExpanded ? 1 : 0

  const handleTouchStart = useCallback((e: TouchEvent) => {
    isDraggingRef.current = true
    startYRef.current = e.touches[0].clientY
    startOffsetRef.current = isExpanded ? 0 : maxOffset
  }, [isExpanded, maxOffset])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDraggingRef.current) return
    const deltaY = e.touches[0].clientY - startYRef.current
    const offset = Math.max(0, Math.min(startOffsetRef.current + deltaY, maxOffset))
    dragOffsetRef.current = offset
    setRenderOffset(offset)
  }, [maxOffset])

  const handleTouchEnd = useCallback(() => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false

    const finalOffset = dragOffsetRef.current
    dragOffsetRef.current = null
    setRenderOffset(null)

    if (finalOffset === null) return

    const deltaY = finalOffset - startOffsetRef.current

    let shouldExpand: boolean
    if (Math.abs(deltaY) > 50) {
      shouldExpand = deltaY < 0
    } else {
      shouldExpand = finalOffset < maxOffset / 2
    }

    if (shouldExpand !== isExpanded) {
      onExpandedChange(shouldExpand)
    }
  }, [isExpanded, onExpandedChange, maxOffset])

  useEffect(() => {
    const el = sheetRef.current
    if (!el) return

    el.addEventListener("touchstart", handleTouchStart, { passive: true })
    el.addEventListener("touchmove", handleTouchMove, { passive: true })
    el.addEventListener("touchend", handleTouchEnd, { passive: true })

    return () => {
      el.removeEventListener("touchstart", handleTouchStart)
      el.removeEventListener("touchmove", handleTouchMove)
      el.removeEventListener("touchend", handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  const transform = isDragging
    ? `translateY(${renderOffset}px)`
    : isExpanded
      ? "translateY(0)"
      : `translateY(${maxOffset}px)`

  return (
    <div
      ref={sheetRef}
      className={`fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-3xl bg-neutral-950 ${
        !settled || isDragging ? "duration-0" : "transition-transform duration-300 ease-out"
      }`}
      style={{
        maxHeight: "85dvh",
        transform,
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
      <div className={`relative min-h-0 flex-1 px-3 pb-3 ${
        isExpanded && !isDragging ? "overflow-y-auto overscroll-contain" : "overflow-hidden"
      }`}>
        {/* Peek content — absolute so it doesn't affect layout */}
        <div
          className="absolute inset-x-3 top-0 z-10 transition-opacity duration-150"
          style={{
            opacity: Math.max(0, 1 - progress * 2.5),
            pointerEvents: progress > 0.4 ? "none" : "auto",
          }}
        >
          {peek}
        </div>

        {/* Expanded content — sized to content, revealed by sheet sliding up */}
        <div
          className="transition-opacity duration-150"
          style={{
            opacity: Math.min(1, progress * 2),
            pointerEvents: progress < 0.4 ? "none" : "auto",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
