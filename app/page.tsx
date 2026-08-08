import { SiteHeader } from './site-header'

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main
        className="site-placeholder"
        aria-labelledby="site-placeholder-title"
      >
        <h1 id="site-placeholder-title">The public site is taking shape.</h1>
      </main>
    </>
  )
}
