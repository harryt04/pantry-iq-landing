import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { plexMono, plexSans } from '@/lib/fonts'
import { themeInitScript } from '@/lib/theme-script'
import { PostHogProvider } from '@/providers/posthogProvider'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PantryIQ',
  description: 'Decision support for restaurant operators.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    title: 'PantryIQ',
    statusBarStyle: 'default',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link
          rel="icon"
          href="/icon-dark.svg"
          type="image/svg+xml"
          media="(prefers-color-scheme: dark)"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <PostHogProvider>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </PostHogProvider>
      </body>
    </html>
  )
}
