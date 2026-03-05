"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export interface ViewerData {
  videoUrl: string
  sourceVideoUrl: string | null
  sourceAspectRatio: "9:16" | "16:9" | "fill"
  generatedAspectRatio: "9:16" | "16:9" | "fill"
  characterName: string | null
  characterImageUrl: string | null
}

export interface ViewerError {
  message: string
  characterName: string | null
  characterImageUrl: string | null
}

interface ViewerContextValue {
  /** Currently viewed generation (video or error) */
  data: ViewerData | null
  error: ViewerError | null
  /** Open the video player overlay */
  viewVideo: (data: ViewerData) => void
  /** Show an error overlay */
  viewError: (error: ViewerError) => void
  /** Close the overlay */
  close: () => void
}

const ViewerContext = createContext<ViewerContextValue | null>(null)

export function ViewerProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ViewerData | null>(null)
  const [error, setError] = useState<ViewerError | null>(null)

  const viewVideo = useCallback((d: ViewerData) => {
    setError(null)
    setData(d)
  }, [])

  const viewError = useCallback((e: ViewerError) => {
    setData(null)
    setError(e)
  }, [])

  const close = useCallback(() => {
    setData(null)
    setError(null)
  }, [])

  return (
    <ViewerContext.Provider value={{ data, error, viewVideo, viewError, close }}>
      {children}
    </ViewerContext.Provider>
  )
}

export function useViewer(): ViewerContextValue {
  const ctx = useContext(ViewerContext)
  if (!ctx) throw new Error("useViewer must be used within ViewerProvider")
  return ctx
}
