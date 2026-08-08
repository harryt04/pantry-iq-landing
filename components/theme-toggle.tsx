'use client'

import { useEffect, useState } from 'react'

type ThemePreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'pantryiq-theme'

function applyTheme(pref: ThemePreference) {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = pref === 'dark' || (pref === 'system' && systemDark)
  document.documentElement.classList.toggle('dark', dark)
}

export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>('system')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null
    setPreference(stored ?? 'system')
  }, [])

  function setTheme(pref: ThemePreference) {
    setPreference(pref)
    localStorage.setItem(STORAGE_KEY, pref)
    applyTheme(pref)
  }

  return (
    <fieldset
      style={{
        border: 0,
        display: 'inline-flex',
        gap: 'var(--space-1)',
        margin: 0,
        padding: 0,
      }}
    >
      <legend className="sr-only">Theme</legend>
      {(['light', 'system', 'dark'] as const).map((pref) => (
        <button
          key={pref}
          type="button"
          aria-pressed={preference === pref}
          onClick={() => setTheme(pref)}
          style={{
            borderRadius: 'var(--radius-control)',
            border: '1px solid var(--border)',
            background: preference === pref ? 'var(--accent)' : 'var(--card)',
            color: 'var(--foreground)',
            padding: '6px 14px',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-base)',
            cursor: 'pointer',
            minHeight: 44,
          }}
        >
          {pref[0]?.toUpperCase()}
          {pref.slice(1)}
        </button>
      ))}
    </fieldset>
  )
}
