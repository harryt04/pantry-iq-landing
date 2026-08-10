import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { plexMono, plexSans } from '@/lib/fonts'
import { themeInitScript } from '@/lib/theme-script'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PantryIQ',
  description: 'Decision support for restaurant operators.',
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
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  )
}
