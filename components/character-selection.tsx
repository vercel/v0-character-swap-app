"use client"

import { CharacterGrid } from "@/components/character-grid"
import { StepsIndicator } from "@/components/steps-indicator"
import type { Character } from "@/lib/types"

interface CharacterSelectionProps {
  selectedId: number | null
  onSelect: (id: number) => void
  customCharacters: Character[]
  onAddCustom: (character: Character) => void
  onDeleteCustom?: (id: number) => void
  onExpand?: (imageUrl: string, characterId: number, isCustom: boolean) => void
}

export function CharacterSelection({
  selectedId,
  onSelect,
  customCharacters,
  onAddCustom,
  onDeleteCustom,
  onExpand,
}: CharacterSelectionProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-6">
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
      </div>
    </div>
  )
}
