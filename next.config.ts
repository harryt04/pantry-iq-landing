import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: '/favicon.ico',
        destination: '/favicon/favicon.ico',
      },
      {
        source: '/apple-touch-icon.png',
        destination: '/favicon/apple-touch-icon.png',
      },
      {
        source: '/favicon-32x32.png',
        destination: '/favicon/favicon-32x32.png',
      },
      {
        source: '/favicon-16x16.png',
        destination: '/favicon/favicon-16x16.png',
      },
      {
        source: '/android-chrome-192x192.png',
        destination: '/favicon/android-chrome-192x192.png',
      },
      {
        source: '/android-chrome-512x512.png',
        destination: '/favicon/android-chrome-512x512.png',
      },
      {
        source: '/site.webmanifest',
        destination: '/favicon/site.webmanifest',
      },
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
      {
        source: '/ingest/decide',
        destination: 'https://us.i.posthog.com/decide',
      },
    ]
  },
}

export default nextConfig
