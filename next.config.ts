import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.PANTRYIQ_E2E === '1' ? '.next-e2e' : '.next',
}

export default nextConfig
