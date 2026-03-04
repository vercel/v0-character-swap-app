"use client"

import { useState, useEffect } from "react"

interface CharacterSubmission {
  id: number
  image_url: string
  suggested_name: string | null
  user_id: string | null
  status: string
  created_at: string
  type: "character"
}

interface VideoSubmission {
  id: number
  video_url: string
  character_image_url: string | null
  character_name: string | null
  user_id: string | null
  status: string
  created_at: string
  type: "video"
}

export default function AdminPage() {
  const [characters, setCharacters] = useState<CharacterSubmission[]>([])
  const [videos, setVideos] = useState<VideoSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<"characters" | "videos">("characters")

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/submissions")
      if (!res.ok) {
        if (res.status === 401) {
          setError("Unauthorized — admin access required")
          setLoading(false)
          return
        }
        throw new Error("Failed to fetch")
      }
      const data = await res.json()
      setCharacters(data.characters || [])
      setVideos(data.videos || [])
    } catch {
      setError("Failed to load submissions")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleAction = async (id: number, status: "approved" | "rejected", type: "character" | "video") => {
    await fetch("/api/admin/submissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, type }),
    })
    fetchData()
  }

  const handleDelete = async (id: number, type: "character" | "video") => {
    await fetch("/api/admin/submissions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type }),
    })
    fetchData()
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-200 border-t-black" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <p className="text-sm text-black/50">{error}</p>
      </div>
    )
  }

  const pendingChars = characters.filter(c => c.status === "pending")
  const pendingVids = videos.filter(v => v.status === "pending")

  return (
    <div className="min-h-screen bg-white p-6">
      <h1 className="mb-6 text-3xl font-pixel text-black">Admin — Submissions</h1>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setTab("characters")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === "characters" ? "bg-black text-white" : "bg-neutral-100 text-black/50 hover:text-black"
          }`}
        >
          Cartoons ({pendingChars.length} pending)
        </button>
        <button
          onClick={() => setTab("videos")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === "videos" ? "bg-black text-white" : "bg-neutral-100 text-black/50 hover:text-black"
          }`}
        >
          Videos ({pendingVids.length} pending)
        </button>
      </div>

      {tab === "characters" && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {characters.map((sub) => (
            <div key={sub.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
              <div className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sub.image_url} alt={sub.suggested_name || ""} className="h-full w-full object-cover" />
                <div className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  sub.status === "approved" ? "bg-green-100 text-green-700"
                    : sub.status === "rejected" ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                }`}>
                  {sub.status}
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-black">{sub.suggested_name || "Unnamed"}</p>
                <p className="text-[11px] text-black/40">{new Date(sub.created_at).toLocaleDateString()}</p>
                {sub.status === "pending" && (
                  <div className="mt-2 flex gap-1.5">
                    <button
                      onClick={() => handleAction(sub.id, "approved", "character")}
                      className="flex-1 rounded-lg bg-green-500 py-1.5 text-xs font-medium text-white hover:bg-green-600"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(sub.id, "rejected", "character")}
                      className="flex-1 rounded-lg bg-red-500 py-1.5 text-xs font-medium text-white hover:bg-red-600"
                    >
                      Reject
                    </button>
                  </div>
                )}
                <button
                  onClick={() => handleDelete(sub.id, "character")}
                  className="mt-1.5 w-full text-[11px] text-black/30 hover:text-red-500"
                >
                  delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "videos" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {videos.map((sub) => (
            <div key={sub.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
              <div className="relative aspect-video bg-black">
                <video
                  src={sub.video_url}
                  className="h-full w-full object-contain"
                  controls
                  muted
                  playsInline
                  preload="metadata"
                />
                <div className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  sub.status === "approved" ? "bg-green-100 text-green-700"
                    : sub.status === "rejected" ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                }`}>
                  {sub.status}
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-center gap-2">
                  {sub.character_image_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={sub.character_image_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-black">{sub.character_name || "Unknown"}</p>
                    <p className="text-[11px] text-black/40">{new Date(sub.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                {sub.status === "pending" && (
                  <div className="mt-2 flex gap-1.5">
                    <button
                      onClick={() => handleAction(sub.id, "approved", "video")}
                      className="flex-1 rounded-lg bg-green-500 py-1.5 text-xs font-medium text-white hover:bg-green-600"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(sub.id, "rejected", "video")}
                      className="flex-1 rounded-lg bg-red-500 py-1.5 text-xs font-medium text-white hover:bg-red-600"
                    >
                      Reject
                    </button>
                  </div>
                )}
                <button
                  onClick={() => handleDelete(sub.id, "video")}
                  className="mt-1.5 w-full text-[11px] text-black/30 hover:text-red-500"
                >
                  delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
