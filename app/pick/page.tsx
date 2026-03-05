"use client"

import { useRouter } from "next/navigation"
import { CharacterSelection } from "@/components/character-selection"
import { useCharacters } from "@/hooks/use-characters"
import { useAuth } from "@/components/auth-provider"

export default function PickPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const {
    selectedCharacter,
    setSelectedCharacter,
    addCustomCharacter,
    allCharacters,
  } = useCharacters({ user, authLoading })

  return (
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
      onAddCustom={addCustomCharacter}
    />
  )
}
