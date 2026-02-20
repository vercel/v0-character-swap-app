import pkg from "workflow/next";
const { withWorkflow } = pkg;

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // TODO: fix TS errors in workflow SDK types, ffmpeg worker, and Vercel Blob types
    ignoreBuildErrors: true,
  },
  // Required for SharedArrayBuffer (video processing worker needs COOP/COEP headers)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "hebbkx1anhila5yf.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
    // Enable Next.js image optimization for faster loading
    // Images will be resized and compressed for the UI
    // Original HD images are still sent to the AI model via characterImageUrl
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 160, 256],
    qualities: [60, 75],
  },
  poweredByHeader: false,
}

export default withWorkflow(nextConfig)
