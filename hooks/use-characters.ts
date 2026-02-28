"use client"

import { useState, useEffect, useCallback } from "react"
import type { Character, User, ReferenceImage } from "@/lib/types"
import { CUSTOM_CHARACTER_ID_OFFSET, DEFAULT_CHARACTERS } from "@/lib/constants"

interface UseCharactersOptions {
  user: User | null
  authLoading?: boolean
}

interface UseCharactersReturn {
  customCharacters: Character[]
  selectedCharacter: number | null
  setSelectedCharacter: (id: number | null) => void
  addCustomCharacter: (character: Character) => Promise<void>
  deleteCustomCharacter: (id: number) => Promise<void>
  allCharacters: Character[]
  trackCharacterUsage: (characterId: number) => void
  isReady: boolean
}

export function useCharacters({ user, authLoading = false }: UseCharactersOptions): UseCharactersReturn {
  const [customCharacters, setCustomCharacters] = useState<Character[]>([])
  const [selectedCharacter, setSelectedCharacter] = useState<number | null>(null)
  const [customLoaded, setCustomLoaded] = useState(false)

  // Load user's reference images from database
  // Wait for auth to resolve before marking custom as loaded
  useEffect(() => {
    if (authLoading) return
    if (user) {
      setCustomLoaded(false)
      fetch("/api/reference-images", { credentials: "include" })
        .then(res => res.json())
        .then(data => {
          if (data.images) {
            const loadedCharacters: Character[] = data.images.map((img: ReferenceImage) => ({
              id: CUSTOM_CHARACTER_ID_OFFSET + img.id,
              name: img.name,
              src: img.image_url,
              dbId: img.id,
            }))
            setCustomCharacters(loadedCharacters)
          }
        })
        .catch(console.error)
        .finally(() => setCustomLoaded(true))
    } else {
      setCustomCharacters([])
      setCustomLoaded(true)
    }
  }, [user, authLoading])

  const addCustomCharacter = useCallback(async (character: Character) => {
    if (user) {
      try {
        const res = await fetch("/api/reference-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: character.name,
            imageUrl: character.src,
          }),
        })
        const data = await res.json()
        if (data.id) {
          setCustomCharacters(prev => [...prev, {
            ...character,
            id: CUSTOM_CHARACTER_ID_OFFSET + data.id,
            dbId: data.id,
          }])
          return
        }
      } catch (error) {
        console.error("Failed to save reference image:", error)
      }
    }
    // Fallback: just add locally
    setCustomCharacters(prev => [...prev, character])
  }, [user])

  const deleteCustomCharacter = useCallback(async (id: number) => {
    const character = customCharacters.find(c => c.id === id)

    if (character?.dbId) {
      try {
        await fetch(`/api/reference-images/${character.dbId}`, {
          method: "DELETE",
          credentials: "include",
        })
      } catch (error) {
        console.error("Failed to delete reference image:", error)
      }
    }

    setCustomCharacters(prev => prev.filter(c => c.id !== id))
    if (selectedCharacter === id) {
      setSelectedCharacter(null)
    }
  }, [selectedCharacter, customCharacters])

  // Track character usage (call when generating video)
  const trackCharacterUsage = useCallback((characterId: number) => {
    fetch("/api/character-usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: String(characterId) }),
    }).catch(console.error)
  }, [])

  const allCharacters = [...DEFAULT_CHARACTERS, ...customCharacters]

  const isReady = customLoaded

  return {
    customCharacters,
    selectedCharacter,
    setSelectedCharacter,
    addCustomCharacter,
    deleteCustomCharacter,
    allCharacters,
    trackCharacterUsage,
    isReady,
  }
}
