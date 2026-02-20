"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: "#000", color: "#fff", fontFamily: "monospace" }}>
        <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1rem", textAlign: "center" }}>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>something went wrong</h2>
          <p style={{ fontSize: "0.875rem", color: "#999", marginBottom: "1.5rem", maxWidth: "28rem" }}>
            {error.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={reset}
            style={{ backgroundColor: "#fff", color: "#000", border: "none", borderRadius: "0.5rem", padding: "0.625rem 1.25rem", fontSize: "0.875rem", cursor: "pointer" }}
          >
            try again
          </button>
        </div>
      </body>
    </html>
  )
}
