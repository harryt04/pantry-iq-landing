import { ThemeToggle } from '@/components/theme-toggle'

const palettes = [
  ['Stone', '--background', 'solid'],
  ['Ink', '--foreground', 'solid'],
  ['Card', '--card', 'solid'],
  ['Soft', '--muted', 'solid'],
  ['Line', '--border', 'solid'],
  ['Azure · ● Steady', '--signal-good', 'solid'],
  ['Iron · ◆ Watch · diagonal hatch', '--signal-watch', 'hatch'],
  ['Oxide · ▲ Act now · cross-hatch', '--signal-risk', 'cross'],
  ['Chart 4 · dots', '--chart-4', 'dots'],
  ['Chart 5 · vertical rule', '--chart-5', 'vertical'],
] as const

const typeScale = [
  ['11px', '--text-xs'],
  ['12px', '--text-sm'],
  ['13px', '--text-base-sm'],
  ['14px', '--text-base'],
  ['16px', '--text-md'],
  ['18px', '--text-lg'],
  ['22px', '--text-xl'],
  ['28px', '--text-2xl'],
  ['36px', '--text-3xl'],
  ['44px', '--text-4xl'],
] as const

const spaces = [4, 8, 12, 16, 20, 24, 32, 40, 56, 80]

export default function DesignTokensPage() {
  return (
    <main className="token-page">
      <header className="token-header">
        <div>
          <p className="token-eyebrow">PantryIQ / foundation</p>
          <h1>Tokens, rendered</h1>
          <p>
            Light and dark are equal citizens. Signals carry a glyph and a
            pattern, never color alone.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <section aria-labelledby="palette-heading">
        <h2 id="palette-heading">Palette</h2>
        <div className="token-swatches">
          {palettes.map(([label, token, pattern]) => (
            <article key={token} className="token-swatch">
              <div
                aria-hidden="true"
                className={`token-swatch-colour pat pat--${pattern}`}
                style={{ background: `var(${token})` }}
              />
              <p>{label}</p>
              <code>{token}</code>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="type-heading">
        <h2 id="type-heading">Type scale</h2>
        <div className="token-type-list">
          {typeScale.map(([label, token]) => (
            <p key={token} style={{ fontSize: `var(${token})` }}>
              <span className="figure">{label}</span> Plain numbers are never
              the figure treatment
            </p>
          ))}
        </div>
      </section>

      <section aria-labelledby="spacing-heading">
        <h2 id="spacing-heading">Spacing scale</h2>
        <div className="token-space-list">
          {spaces.map((space) => (
            <div key={space}>
              <span className="figure">{space}px</span>
              <span
                aria-hidden="true"
                className="token-space-bar"
                style={{ width: `${space}px` }}
              />
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="figures-heading">
        <h2 id="figures-heading">Figures</h2>
        <p className="token-figure figure">$12,480.00 · 23.4% · 2026-08-08</p>
      </section>
    </main>
  )
}
