"use client"

import { useRouter } from "next/navigation"
import { CharacterSelection } from "@/components/character-selection"
import { useCharacters } from "@/hooks/use-characters"
import { useAuth } from "@/components/auth-provider"
import { useState } from "react"

export default function PickPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const {
    customCharacters,
    selectedCharacter,
    setSelectedCharacter,
    addCustomCharacter,
    deleteCustomCharacter,
    allCharacters,
    isReady: charactersReady,
  } = useCharacters({ user, authLoading })

  const [expandedCharacter, setExpandedCharacter] = useState<{
    imageUrl: string
    id: number
    isCustom: boolean
  } | null>(null)

  return (
    <>
      <CharacterSelection
        selectedId={selectedCharacter}
        onSelect={setSelectedCharacter}
        onNext={() => {
          if (selectedCharacter) {
            router.push(`/record?char=${selectedCharacter}`)
          }
        }}
        onHome={() => router.push("/")}
        allCharacters={allCharacters}
        customCharacters={charactersReady ? customCharacters : []}
        onAddCustom={addCustomCharacter}
        onDeleteCustom={deleteCustomCharacter}
        onExpand={(imageUrl, id, isCustom) => setExpandedCharacter({ imageUrl, id, isCustom })}
      />

      {/* Expanded Character Image Overlay */}
      {expandedCharacter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setExpandedCharacter(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setExpandedCharacter(null)
          }}
          tabIndex={0}
          ref={(el) => el?.focus()}
        >
          <div className="absolute right-4 top-4 flex items-center gap-2">
            <button
              onClick={async (e) => {
                e.stopPropagation()
                try {
                  const res = await fetch(expandedCharacter.imageUrl)
                  const blob = await res.blob()
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url
                  const char = allCharacters.find(c => c.id === expandedCharacter.id)
                  a.download = `${char?.name || "character"}.png`
                  a.click()
                  URL.revokeObjectURL(url)
                } catch {
                  window.open(expandedCharacter.imageUrl, "_blank")
                }
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              title="Download image"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            <button
              onClick={() => setExpandedCharacter(null)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={expandedCharacter.imageUrl}
            alt="Character preview"
            className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
