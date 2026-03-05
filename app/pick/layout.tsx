import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Choose a Character — v0 FaceSwap",
  description: "Pick a cartoon character to swap your face into using AI",
}

export default function PickLayout({ children }: { children: React.ReactNode }) {
  return children
}
