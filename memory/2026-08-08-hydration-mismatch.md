# Hydration mismatch: root theme class

## Symptom

React reported that `<html>` had an extra `dark` class on the client during
hydration.

## Root cause

`lib/theme-script.ts` intentionally runs before first paint and mutates
`document.documentElement.classList` using local storage and the system theme.
The server cannot know that client-only preference, so React compared the
server's font-only `class` attribute with the already-mutated client DOM.

## Fix

Added `suppressHydrationWarning` to the root `<html>` element in
`app/layout.tsx`. The script continues to own the pre-paint theme class, while
React is told that this root attribute is intentionally client-resolved.

## Verification

- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed; no test files currently exist.
- `pnpm build` passed on Next.js 15.5.23.
