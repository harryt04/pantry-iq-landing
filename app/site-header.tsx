import Link from 'next/link'

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link
          className="site-header__wordmark"
          href="/"
          aria-label="PantryIQ home"
        >
          PantryIQ
        </Link>

        <nav className="site-header__nav" aria-label="Primary navigation">
          <Link className="site-header__link" href="/pricing">
            Pricing
          </Link>
          <Link className="site-header__link" href="/sign-in">
            Sign in
          </Link>
          <Link className="site-header__start" href="/sign-up">
            Start free
          </Link>
        </nav>
      </div>
    </header>
  )
}
