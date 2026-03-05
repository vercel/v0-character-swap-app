"use client"

import { useState, useCallback, type ReactNode } from "react"
import { SidebarStrip } from "@/components/sidebar-strip"
import { useCredits } from "@/hooks/use-credits"
import { useRouter } from "next/navigation"

export function LayoutShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { balance, creditsLoading, error: creditsError, refresh: refreshCredits } = useCredits()

  // Buy credits modal state
  const [showBuyOptions, setShowBuyOptions] = useState(false)
  const [buyAmount, setBuyAmount] = useState("")
  const [purchasing, setPurchasing] = useState(false)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)

  const parsedBuyAmount = Number.parseFloat(buyAmount)
  const isValidBuyAmount = buyAmount !== "" && Number.isFinite(parsedBuyAmount) && parsedBuyAmount > 0

  const handleBuyCredits = useCallback(async (amount: number) => {
    if (!amount || amount <= 0) return
    setPurchasing(true)
    setPurchaseError(null)
    try {
      const res = await fetch("/api/credits/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPurchaseError(data.error || `Purchase failed (${res.status})`)
        return
      }
      if (data.checkoutSessionUrl) {
        window.location.href = data.checkoutSessionUrl
        return
      }
      refreshCredits()
      setShowBuyOptions(false)
      setBuyAmount("")
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setPurchasing(false)
    }
  }, [refreshCredits])

  return (
    <main className="relative flex h-[100dvh] flex-row overflow-hidden bg-white">
      {/* Main content area */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-hidden">
        {children}
      </div>

      {/* Sidebar Strip */}
      <SidebarStrip
        onSelectVideo={(generationId) => router.push(`/generate?v=${generationId}`)}
        onSelectError={(generationId) => router.push(`/generate?v=${generationId}`)}
        onBuyCredits={() => { setShowBuyOptions(true); setPurchaseError(null); setBuyAmount("") }}
      />

      {/* Buy Credits Modal */}
      {showBuyOptions && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => { setShowBuyOptions(false); setBuyAmount(""); setPurchaseError(null) }}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-semibold text-black">Buy Credits</h2>
            <p className="mb-4 text-sm text-black/50">
              {!creditsLoading && !creditsError && (
                <>Current balance: <span className="tabular-nums font-medium text-black">${Number.parseFloat(balance).toFixed(2)}</span></>
              )}
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 25, 50].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setBuyAmount(String(amount))}
                    disabled={purchasing}
                    className={`rounded-xl border py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      buyAmount === String(amount)
                        ? "border-black bg-black text-white"
                        : "border-neutral-200 text-black hover:border-neutral-400 hover:text-black"
                    }`}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-black/40">$</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    placeholder="Custom amount"
                    value={buyAmount}
                    onChange={(e) => { setBuyAmount(e.target.value); setPurchaseError(null) }}
                    disabled={purchasing}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 pl-7 pr-3 text-sm tabular-nums text-black placeholder:text-black/40 focus:border-neutral-400 focus:outline-none disabled:opacity-40"
                  />
                </div>
              </div>
              {purchaseError && (
                <p className="text-xs text-red-500">{purchaseError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setShowBuyOptions(false); setBuyAmount(""); setPurchaseError(null) }}
                  disabled={purchasing}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm text-black/50 transition-colors hover:text-black disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleBuyCredits(parsedBuyAmount)}
                  disabled={!isValidBuyAmount || purchasing}
                  className="flex-1 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {purchasing ? "Processing..." : "Purchase"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
