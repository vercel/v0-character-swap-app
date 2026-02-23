"use client"

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react"

interface BottomSheetProps {
  peek: ReactNode
  children: ReactNode
  isExpanded: boolean
  onExpandedChange: (expanded: boolean) => void
  peekHeight?: number
}

const SHEET_HEIGHT_DVH = 60

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
  // State only for triggering re-renders during drag
  const [renderOffset, setRenderOffset] = useState<number | null>(null)

  const isDragging = renderOffset !== null

  const getMaxOffset = useCallback(
    () => window.innerHeight * (SHEET_HEIGHT_DVH / 100) - peekHeight,
    [peekHeight],
  )

  const progress = isDragging
    ? 1 - (renderOffset ?? 0) / (getMaxOffset() || 1)
    : isExpanded ? 1 : 0

  const handleTouchStart = useCallback((e: TouchEvent) => {
    isDraggingRef.current = true
    startYRef.current = e.touches[0].clientY
    startOffsetRef.current = isExpanded ? 0 : getMaxOffset()
  }, [isExpanded, getMaxOffset])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDraggingRef.current) return
    const deltaY = e.touches[0].clientY - startYRef.current
    const maxOffset = getMaxOffset()
    const offset = Math.max(0, Math.min(startOffsetRef.current + deltaY, maxOffset))
    // Ref for immediate read in touchEnd; state for rendering
    dragOffsetRef.current = offset
    setRenderOffset(offset)
  }, [getMaxOffset])

  const handleTouchEnd = useCallback(() => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false

    // Read from ref — always has the latest value, no stale closure
    const finalOffset = dragOffsetRef.current
    dragOffsetRef.current = null
    setRenderOffset(null)

    if (finalOffset === null) return

    const maxOffset = getMaxOffset()
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
  }, [isExpanded, onExpandedChange, getMaxOffset])

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
      : `translateY(calc(${SHEET_HEIGHT_DVH}dvh - ${peekHeight}px))`

  return (
    <div
      ref={sheetRef}
      className={`fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-3xl bg-neutral-950 ${
        isDragging ? "duration-0" : "transition-transform duration-300 ease-out"
      }`}
      style={{
        height: `${SHEET_HEIGHT_DVH}dvh`,
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
      <div className={`relative min-h-0 flex-1 px-3 pb-6 ${
        isExpanded && !isDragging ? "overflow-y-auto overscroll-contain" : "overflow-hidden"
      }`}>
        {/* Peek content — absolute so it doesn't push expanded content down */}
        <div
          className="absolute inset-x-3 top-0 z-10 transition-opacity duration-150"
          style={{
            opacity: Math.max(0, 1 - progress * 2.5),
            pointerEvents: progress > 0.4 ? "none" : "auto",
          }}
        >
          {peek}
        </div>

        {/* Expanded content — fills full area, revealed by sheet sliding up */}
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
