"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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

const COMMUNITY_ID_OFFSET = 5000

export function useCharacters({ user, authLoading = false }: UseCharactersOptions): UseCharactersReturn {
  const [customCharacters, setCustomCharacters] = useState<Character[]>([])
  const [communityCharacters, setCommunityCharacters] = useState<Character[]>([])
  const [selectedCharacter, setSelectedCharacter] = useState<number | null>(null)
  const [customLoaded, setCustomLoaded] = useState(false)
  const [communityLoaded, setCommunityLoaded] = useState(false)
  const communityFetched = useRef(false)

  // Load community-approved characters (once, immediately)
  useEffect(() => {
    if (communityFetched.current) return
    communityFetched.current = true
    fetch("/api/approved-characters")
      .then(res => res.json())
      .then(data => {
        if (data.characters) {
          setCommunityCharacters(data.characters.map((c: { id: number; src: string; name: string }) => ({
            id: COMMUNITY_ID_OFFSET + c.id,
            src: c.src,
            name: c.name || "Community",
          })))
        }
      })
      .catch(() => {})
      .finally(() => setCommunityLoaded(true))
  }, [])

  // Load user's reference images from database
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

  const trackCharacterUsage = useCallback((characterId: number) => {
    fetch("/api/character-usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: String(characterId) }),
    }).catch(console.error)
  }, [])

  // All characters in one pass — no reflow
  const allCharacters = [...DEFAULT_CHARACTERS, ...communityCharacters, ...customCharacters]

  // Only ready when both community and custom are loaded
  const isReady = communityLoaded && customLoaded

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
