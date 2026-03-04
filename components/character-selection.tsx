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
    <div className="relative flex h-full w-full flex-col overflow-y-auto bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top,1rem))] md:px-6 md:pt-5">
          <h1 className="text-xl font-pixel text-black md:text-2xl">v0 FaceSwap</h1>
          <StepsIndicator currentStep={1} />
        </div>
      </div>

      {/* Content — always vertically centered */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-4 md:px-6">
        <div className="w-full max-w-lg text-center">
          <div className="mb-5 md:mb-7">
            <h2 className="mb-1.5 text-2xl font-bold text-black md:text-3xl">Choose a cartoon</h2>
            <p className="text-[15px] leading-relaxed text-black/45">
              Pick one, or create your own with AI
            </p>
          </div>
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
            showTitle={false}
          />
        </div>
      </div>

      {/* Sticky Next button — extra padding on mobile for bottom bar */}
      <div className="sticky bottom-0 z-10 border-t border-neutral-100 bg-white/95 px-5 pb-[max(3.5rem,calc(env(safe-area-inset-bottom,0.75rem)+2.5rem))] pt-3 backdrop-blur-sm md:pb-3 md:px-6">
        <div className="mx-auto w-full max-w-lg">
          <button
            onClick={onNext}
            disabled={!selectedId}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition-all active:scale-[0.98]",
              selectedId
                ? "bg-black text-white shadow-sm hover:bg-gray-800"
                : "cursor-not-allowed bg-neutral-100 text-black/25"
            )}
          >
            {selectedId ? (
              <>
                Next: Record video
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
