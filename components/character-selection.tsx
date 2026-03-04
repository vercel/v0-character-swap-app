"use client"

import { CharacterGrid } from "@/components/character-grid"
import { StepsIndicator } from "@/components/steps-indicator"
import { cn } from "@/lib/utils"
import type { Character } from "@/lib/types"

interface CharacterSelectionProps {
  selectedId: number | null
  onSelect: (id: number) => void
  onNext: () => void
  customCharacters: Character[]
  onAddCustom: (character: Character) => void
  onDeleteCustom?: (id: number) => void
  onExpand?: (imageUrl: string, characterId: number, isCustom: boolean) => void
}

export function CharacterSelection({
  selectedId,
  onSelect,
  onNext,
  customCharacters,
  onAddCustom,
  onDeleteCustom,
  onExpand,
}: CharacterSelectionProps) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center px-6">
      {/* Title top-left */}
      <h1 className="absolute left-6 top-5 text-2xl font-pixel text-black">v0 FaceSwap</h1>
      <div className="w-full max-w-md">
        <div className="mb-6">
          <StepsIndicator currentStep={1} />
        </div>
        <h1 className="mb-1 text-3xl font-pixel text-black">Choose a cartoon</h1>
        <p className="mb-6 text-sm text-black/50">
          Pick a cartoon or create your own with AI
        </p>
        <CharacterGrid
          selectedId={selectedId}
          onSelect={onSelect}
          customCharacters={customCharacters}
          onAddCustom={onAddCustom}
          onDeleteCustom={onDeleteCustom}
          onExpand={onExpand}
          hasVideo={true}
          hasCharacter={!!selectedId}
          showGenerateButton={false}
        />
        <button
          onClick={onNext}
          disabled={!selectedId}
          className={cn(
            "mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.98]",
            selectedId
              ? "bg-black text-white hover:bg-gray-800"
              : "cursor-not-allowed bg-neutral-100 text-black/30"
          )}
        >
          {selectedId ? (
            <>
              Next: Record video
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </>
          ) : (
            "Select a cartoon to continue"
          )}
        </button>
      </div>
    </div>
  )
}
