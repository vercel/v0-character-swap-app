import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Record Video — v0 FaceSwap",
  description: "Record a short video of yourself for AI face swap",
}

export default function RecordLayout({ children }: { children: React.ReactNode }) {
  return children
}
