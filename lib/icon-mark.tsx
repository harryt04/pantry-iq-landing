// Shared "ascending bars" mark used everywhere an icon is rendered via
// next/og's ImageResponse (apple-icon, PWA manifest icons). Percentages
// mirror the fixed 512-unit geometry in app/icon.svg / public/icon-dark.svg
// so every rendered size stays visually identical.

const LIGHT = {
  bg: '#F7F6F3',
  muted: '#C9C4B8',
  fg: '#171614',
  accent: '#0B5FA5',
}

const DARK = {
  bg: '#131311',
  muted: '#4A4A44',
  fg: '#EDEBE6',
  accent: '#6BB0E8',
}

export function IconMark({ scheme = 'light' }: { scheme?: 'light' | 'dark' }) {
  const c = scheme === 'dark' ? DARK : LIGHT

  const bar = (leftPct: number, heightPct: number, color: string) => ({
    position: 'absolute' as const,
    left: `${leftPct}%`,
    bottom: '21.875%',
    width: '14.0625%',
    height: `${heightPct}%`,
    background: color,
  })

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        background: c.bg,
      }}
    >
      <div style={bar(23.4375, 21.09375, c.muted)} />
      <div style={bar(42.96875, 36.71875, c.fg)} />
      <div style={bar(62.5, 52.34375, c.accent)} />
      <div
        style={{
          position: 'absolute',
          left: '17.1875%',
          bottom: '20.3125%',
          width: '65.625%',
          height: '1.5625%',
          background: c.fg,
        }}
      />
    </div>
  )
}
