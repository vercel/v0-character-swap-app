"use client"

import React from "react"

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react"

interface BottomSheetProps {
  children: ReactNode
  isExpanded: boolean
  onExpandedChange: (expanded: boolean) => void
  peekHeight?: number
}

export function BottomSheet({
  children,
  isExpanded,
  onExpandedChange,
  peekHeight = 140
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const startYRef = useRef(0)
  const currentYRef = useRef(0)
  const [dragTransform, setDragTransform] = useState<string | undefined>(undefined)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    isDraggingRef.current = true
    startYRef.current = e.touches[0].clientY
    currentYRef.current = 0
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDraggingRef.current) return
    const deltaY = e.touches[0].clientY - startYRef.current
    currentYRef.current = deltaY

    if (isExpanded) {
      setDragTransform(`translateY(${Math.max(0, deltaY)}px)`)
    } else {
      setDragTransform(`translateY(${Math.min(0, deltaY)}px)`)
    }
  }, [isExpanded])

  const handleTouchEnd = useCallback(() => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false

    if (Math.abs(currentYRef.current) > 50) {
      if (currentYRef.current < 0 && !isExpanded) {
        onExpandedChange(true)
      } else if (currentYRef.current > 0 && isExpanded) {
        onExpandedChange(false)
      }
    }
    currentYRef.current = 0
    setDragTransform(undefined)
  }, [isExpanded, onExpandedChange])

  // Register passive touch listeners
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

  return (
    <div
      ref={sheetRef}
      className={`fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col rounded-t-3xl bg-neutral-950 transition-all ${
        dragTransform ? "duration-0" : "duration-300 ease-out"
      }`}
      style={{
        height: isExpanded ? "auto" : `${peekHeight}px`,
        minHeight: isExpanded ? "50vh" : undefined,
        transform: dragTransform,
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
      <div className={`overscroll-contain px-3 pb-6 ${isExpanded ? "overflow-y-auto" : "overflow-hidden"}`}>
        {children}
      </div>
    </div>
  )
}
