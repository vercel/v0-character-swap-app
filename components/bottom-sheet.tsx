"use client"

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react"

interface BottomSheetProps {
  children: ReactNode
  isExpanded: boolean
  onExpandedChange: (expanded: boolean) => void
  peekHeight?: number
}

const SHEET_HEIGHT_DVH = 70

/**
 * Mobile bottom sheet with two snap points: collapsed (peek) and expanded.
 *
 * The sheet is ALWAYS ${SHEET_HEIGHT_DVH}dvh tall and pinned to `bottom: 0`.
 * Position is controlled entirely via translateY:
 *   - Expanded:  translateY(0)                          → full sheet visible
 *   - Collapsed: translateY(${SHEET_HEIGHT_DVH}dvh - peek) → only peek visible
 *
 * During drag, translateY is interpolated between the two snap points
 * and strictly clamped — the sheet can never float or detach.
 * Content toggles at 30% drag progress so it appears while dragging.
 */
export function BottomSheet({
  children,
  isExpanded,
  onExpandedChange,
  peekHeight = 100
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const startYRef = useRef(0)
  const startOffsetRef = useRef(0)
  const [dragOffset, setDragOffset] = useState<number | null>(null)

  const isDragging = dragOffset !== null

  // Max translateY = collapsed position (pushed down so only peek shows)
  const getMaxOffset = useCallback(
    () => window.innerHeight * (SHEET_HEIGHT_DVH / 100) - peekHeight,
    [peekHeight],
  )

  const handleTouchStart = useCallback((e: TouchEvent) => {
    isDraggingRef.current = true
    startYRef.current = e.touches[0].clientY
    startOffsetRef.current = isExpanded ? 0 : getMaxOffset()
  }, [isExpanded, getMaxOffset])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDraggingRef.current) return
    const deltaY = e.touches[0].clientY - startYRef.current
    const maxOffset = getMaxOffset()
    // offset = start position + drag delta, clamped to [0, maxOffset]
    const offset = Math.max(0, Math.min(startOffsetRef.current + deltaY, maxOffset))
    setDragOffset(offset)

    // Toggle content mid-drag so it appears while dragging, not after
    const progress = 1 - offset / maxOffset // 0 = collapsed, 1 = expanded
    if (progress > 0.3 && !isExpanded) {
      onExpandedChange(true)
    } else if (progress < 0.3 && isExpanded) {
      onExpandedChange(false)
    }
  }, [getMaxOffset, isExpanded, onExpandedChange])

  const handleTouchEnd = useCallback(() => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    if (dragOffset === null) return

    const deltaY = dragOffset - startOffsetRef.current

    // If dragged more than 50px, use direction; otherwise snap to nearest
    let shouldExpand: boolean
    if (Math.abs(deltaY) > 50) {
      shouldExpand = deltaY < 0
    } else {
      shouldExpand = dragOffset < getMaxOffset() / 2
    }

    setDragOffset(null)

    if (shouldExpand !== isExpanded) {
      onExpandedChange(shouldExpand)
    }
  }, [dragOffset, isExpanded, onExpandedChange, getMaxOffset])

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

  // Determine transform
  const transform = isDragging
    ? `translateY(${dragOffset}px)`
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

      {/* Content */}
      <div className={`min-h-0 flex-1 overscroll-contain px-3 pb-6 ${
        isExpanded && !isDragging ? "overflow-y-auto" : "overflow-hidden"
      }`}>
        {children}
      </div>
    </div>
  )
}
