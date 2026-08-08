import localFont from 'next/font/local';

// The exact weight set in ui-implementation.md §2, checked into the app
// rather than fetched at build or runtime.
export const plexSans = localFont({
  src: [
    { path: '../public/fonts/ibm-plex-sans-400.woff2', weight: '400' },
    { path: '../public/fonts/ibm-plex-sans-500.woff2', weight: '500' },
    { path: '../public/fonts/ibm-plex-sans-600.woff2', weight: '600' },
    { path: '../public/fonts/ibm-plex-sans-700.woff2', weight: '700' },
  ],
  variable: '--font-sans',
  display: 'swap',
});

export const plexMono = localFont({
  src: [
    { path: '../public/fonts/ibm-plex-mono-400.woff2', weight: '400' },
    { path: '../public/fonts/ibm-plex-mono-500.woff2', weight: '500' },
    { path: '../public/fonts/ibm-plex-mono-600.woff2', weight: '600' },
  ],
  variable: '--font-mono',
  display: 'swap',
});
