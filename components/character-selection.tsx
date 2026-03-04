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
    <div className="relative flex h-full w-full flex-col overflow-y-auto">
      {/* Title top-left */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-5 pb-2 pt-4 md:px-6">
        <h1 className="text-2xl font-pixel text-black">v0 FaceSwap</h1>
      </div>

      {/* Content — centered on desktop, scrollable on mobile */}
      <div className="flex flex-1 flex-col items-center px-5 pb-6 md:justify-center md:px-6">
        <div className="w-full max-w-md">
          <div className="mb-4 md:mb-6">
            <StepsIndicator currentStep={1} />
          </div>
          <h2 className="mb-1 text-2xl font-pixel text-black md:text-3xl">Choose a cartoon</h2>
          <p className="mb-4 text-sm text-black/50 md:mb-6">
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
        </div>
      </div>

      {/* Sticky Next button at bottom */}
      <div className="sticky bottom-0 border-t border-neutral-100 bg-white px-5 py-3 md:px-6">
        <div className="mx-auto w-full max-w-md">
          <button
            onClick={onNext}
            disabled={!selectedId}
            className={cn(
              "flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.98]",
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
    </div>
  )
}
