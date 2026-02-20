"use client"

import React, { useState } from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

interface Generation {
  id: number
  video_url: string | null
  character_name: string | null
  character_image_url: string | null
  status: "pending" | "processing" | "completed" | "failed" | "cancelled"
  created_at: string
  completed_at: string | null
  error_message: string | null
  error?: {
    kind: string
    message: string
    code?: string
    provider?: string
    model?: string
    summary?: string
    details?: string
  } | null
}

interface FailedGenerationProps {
  gen: Generation
}

// Map technical errors to user-friendly messages
function getUserFriendlyError(errorMessage: string | null, structuredError?: Generation["error"]): string {
  const message = structuredError?.summary ?? structuredError?.message ?? errorMessage
  if (structuredError?.kind === "provider_error" && message) {
    return message
  }

  if (!message) return "Something went wrong. Please try again."

  // Motion/movement related errors - Kling AI requires 2+ seconds of continuous motion
  if (message.toLowerCase().includes("motion") || message.toLowerCase().includes("continuous")) {
    return "Video needs at least 2 seconds of continuous movement. Try recording for 3+ seconds while moving your head or body steadily."
  }

  // Duration errors
  if (message.toLowerCase().includes("duration") || message.toLowerCase().includes("short") || message.toLowerCase().includes("2 second")) {
    return "Video too short. Record for at least 3 seconds with continuous movement."
  }

  // Face detection errors
  if (message.toLowerCase().includes("face") || message.toLowerCase().includes("detect")) {
    return "Make sure your face is clearly visible and well-lit in the video."
  }

  // Quality errors
  if (message.toLowerCase().includes("quality") || message.toLowerCase().includes("resolution")) {
    return "Try recording in better lighting conditions."
  }

  // Default: show original but cleaned up
  return message.replace(/^The input was rejected,?\s*/i, "").trim() || "Something went wrong. Please try again."
}

export function FailedGeneration({ gen }: FailedGenerationProps) {
  const [isOpen, setIsOpen] = useState(false)

  const friendlyError = gen.status === "cancelled"
    ? "Cancelled by user"
    : getUserFriendlyError(gen.error_message, gen.error)
  const shortMessage = gen.status === "cancelled"
    ? "Cancelled"
    : "Failed"

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button className="flex h-full w-full flex-col items-center justify-center gap-1 p-1">
          <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-center font-sans text-[8px] leading-tight text-neutral-400">
            {shortMessage}
          </span>
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Content
        side="top"
        align="center"
        sideOffset={4}
        collisionPadding={16}
        className="z-[60] w-72 rounded-md border border-neutral-800 bg-neutral-900 p-0 shadow-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-3">
          <div className="mb-2 flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-sans text-sm font-medium text-red-400">
              {gen.status === "cancelled" ? "Cancelled" : "Generation Failed"}
            </span>
          </div>
          <p className="font-sans text-xs leading-relaxed text-neutral-300">
            {friendlyError}
          </p>
        </div>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Root>
  )
}
