"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import type { CharacterCategory } from "@/lib/types"

interface Submission {
  id: number
  image_url: string
  suggested_name: string | null
  suggested_category: CharacterCategory | null
  status: "pending" | "approved" | "rejected"
  created_at: string
}

const CATEGORIES: CharacterCategory[] = ["memes", "cartoons", "celebs"]

export default function AdminPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState("")
  const [editCategory, setEditCategory] = useState<CharacterCategory>("memes")

  useEffect(() => {
    fetchSubmissions()
  }, [])

  const fetchSubmissions = async () => {
    try {
      const res = await fetch("/api/admin/submissions")
      const data = await res.json()
      setSubmissions(data.submissions || [])
    } catch (error) {
      console.error("Failed to fetch:", error)
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (id: number, status: "approved" | "rejected", name?: string, category?: CharacterCategory) => {
    try {
      await fetch("/api/admin/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, name, category }),
      })
      setSubmissions(prev =>
        prev.map(s => s.id === id ? { ...s, status, suggested_name: name || s.suggested_name, suggested_category: category || s.suggested_category } : s)
      )
      setEditingId(null)
    } catch (error) {
      console.error("Failed to update:", error)
    }
  }

  const deleteSubmission = async (id: number) => {
    if (!confirm("Delete this submission?")) return
    try {
      await fetch("/api/admin/submissions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      setSubmissions(prev => prev.filter(s => s.id !== id))
    } catch (error) {
      console.error("Failed to delete:", error)
    }
  }

  const startEditing = (submission: Submission) => {
    setEditingId(submission.id)
    setEditName(submission.suggested_name || "")
    setEditCategory(submission.suggested_category || "memes")
  }

  const filteredSubmissions = filter === "all" 
    ? submissions 
    : submissions.filter(s => s.status === filter)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <p className="font-mono text-neutral-500">loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-mono text-xl">character submissions</h1>
          <a href="/" className="font-mono text-sm text-neutral-500 hover:text-white">
            ← back to app
          </a>
        </div>

        {/* Filter tabs */}
        <div className="mb-6 flex gap-2">
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 font-mono text-xs transition-colors ${
                filter === f
                  ? "bg-white text-black"
                  : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
              }`}
            >
              {f} ({submissions.filter(s => f === "all" || s.status === f).length})
            </button>
          ))}
        </div>

        {/* Submissions grid */}
        {filteredSubmissions.length === 0 ? (
          <p className="font-mono text-sm text-neutral-500">no {filter} submissions</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSubmissions.map((submission) => (
              <div
                key={submission.id}
                className="rounded-lg border border-neutral-800 bg-neutral-900 p-4"
              >
                {/* Image */}
                <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-neutral-800">
                  <Image
                    src={submission.image_url}
                    alt="Submission"
                    fill
                    className="object-cover"
                  />
                </div>

                {/* Status badge */}
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                      submission.status === "pending"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : submission.status === "approved"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {submission.status}
                  </span>
                  {submission.suggested_category && (
                    <span className="rounded-full bg-neutral-800 px-2 py-0.5 font-mono text-[10px] text-neutral-400">
                      {submission.suggested_category}
                    </span>
                  )}
                </div>

                {/* Info */}
                <p className="mb-1 font-mono text-sm text-neutral-300">
                  {submission.suggested_name || "Unnamed"}
                </p>
                <p className="mb-3 font-mono text-[10px] text-neutral-600">
                  {new Date(submission.created_at).toLocaleDateString()}
                </p>

                {/* Actions */}
                {editingId === submission.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Character name"
                      className="w-full rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-white placeholder:text-neutral-600"
                    />
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value as CharacterCategory)}
                      className="w-full rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-white"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateStatus(submission.id, "approved", editName, editCategory)}
                        className="flex-1 rounded bg-green-600 px-2 py-1 font-mono text-xs text-white hover:bg-green-500"
                      >
                        approve
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded bg-neutral-700 px-2 py-1 font-mono text-xs text-white hover:bg-neutral-600"
                      >
                        cancel
                      </button>
                    </div>
                  </div>
                ) : submission.status === "pending" ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditing(submission)}
                      className="flex-1 rounded bg-green-600 px-2 py-1 font-mono text-xs text-white hover:bg-green-500"
                    >
                      approve
                    </button>
                    <button
                      onClick={() => updateStatus(submission.id, "rejected")}
                      className="flex-1 rounded bg-neutral-700 px-2 py-1 font-mono text-xs text-white hover:bg-neutral-600"
                    >
                      reject
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => deleteSubmission(submission.id)}
                    className="w-full rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400 hover:bg-neutral-700 hover:text-white"
                  >
                    delete
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
