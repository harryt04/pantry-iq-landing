import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.PANTRYIQ_E2E === '1' ? '.next-e2e' : '.next',
  // Required to support PostHog's trailing-slash API requests.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
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
