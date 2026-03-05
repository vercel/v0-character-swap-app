import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Generate — v0 FaceSwap",
  description: "AI is generating your face swap video",
}

export default function GenerateLayout({ children }: { children: React.ReactNode }) {
  return children
}
