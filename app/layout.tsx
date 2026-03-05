import React from "react"
import type { Metadata } from 'next'
import localFont from "next/font/local"
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/components/auth-provider'
import { VideoProvider } from '@/providers/video-context'
import { LayoutShell } from '@/components/layout-shell'
import './globals.css'

const geistPixel = localFont({
  src: "../public/fonts/GeistPixelBETA-Circle.otf",
  variable: "--font-geist-pixel",
  display: "swap",
})

export const metadata: Metadata = {
  title: 'v0 Face Swap',
  description: 'Record yourself and swap into any character using AI',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={geistPixel.variable}>
      <body className={`${geistPixel.className} antialiased`}>
        <AuthProvider>
          <VideoProvider>
            <LayoutShell>
              {children}
            </LayoutShell>
          </VideoProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
