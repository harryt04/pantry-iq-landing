import { SiteHeader } from './site-header'
import { ImportProof } from '@/components/marketing/import-proof'
import { RankedProof } from '@/components/marketing/ranked-proof'
import { RecommendationProof } from '@/components/marketing/recommendation-proof'
import { marketingExampleRowCount } from '@/components/marketing/marketing-example'

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="landing-page">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-container landing-hero__content">
            <h1 id="landing-title">Find it before the P&amp;L does.</h1>
            <p className="landing-hero__subhead">
              One spreadsheet in. A ranked list of what is costing you money,
              with the arithmetic attached to every figure.
            </p>
            <div className="landing-hero__actions" aria-label="Get started">
              <a
                className="landing-button landing-button--primary"
                href="/sign-up"
              >
                Start free
              </a>
              <a
                className="landing-button landing-button--secondary"
                href="#how-it-works"
              >
                See a worked example
              </a>
            </div>
            <p className="landing-hero__reassurance">
              One location at a time. No POS connection required.
            </p>
          </div>
        </section>

        <section className="landing-proof" aria-label="What you can expect">
          <div className="landing-container landing-proof__grid">
            <div className="landing-proof__item">
              <p className="landing-proof__value">One location</p>
              <p className="landing-proof__label">
                Scoped to one operating unit
              </p>
            </div>
            <div className="landing-proof__item">
              <p className="landing-proof__value">Show the work</p>
              <p className="landing-proof__label">
                Facts stay separate from predictions
              </p>
            </div>
            <div className="landing-proof__item">
              <p className="landing-proof__value">Your call</p>
              <p className="landing-proof__label">
                Recommendations stay recommendations
              </p>
            </div>
          </div>
        </section>

        <section
          className="landing-problem"
          aria-labelledby="landing-problem-title"
        >
          <div className="landing-container landing-problem__content">
            <p className="landing-eyebrow">The problem</p>
            <h2 id="landing-problem-title">You know it&apos;s happening.</h2>
            <div className="landing-problem__copy">
              <p>
                You bought three cases of salmon because you always do. You sold
                it twice. The rest went grey in the walk-in on a Tuesday and you
                found out when you emptied the bin.
              </p>
              <p>
                You know it&apos;s happening. You don&apos;t know what it costs.
                And by the time the P&amp;L tells you, it&apos;s three months
                old.
              </p>
            </div>
          </div>
        </section>

        <section
          className="landing-surfaces"
          id="how-it-works"
          aria-labelledby="landing-how-title"
        >
          <div className="landing-container">
            <div className="landing-section-heading">
              <p className="landing-eyebrow">How it works</p>
              <h2 id="landing-how-title">
                Three screens, and the numbers on all of them.
              </h2>
              <p className="landing-section-heading__note">
                Every figure below comes out of one worked example —{' '}
                <span className="figure">{marketingExampleRowCount}</span> rows
                of one restaurant&apos;s sales, purchase, and count data, run
                through the same engine the product runs.
              </p>
            </div>

            <ol className="surface-proof__list">
              <li className="surface-proof">
                <div className="surface-proof__intro">
                  <p className="landing-eyebrow">Step 01</p>
                  <h3>You map your columns once.</h3>
                  <p>
                    PantryIQ reads the header names your system already exports
                    and tells you why it matched each one. No recipe library, no
                    integration call.
                  </p>
                </div>
                <ImportProof />
              </li>

              <li className="surface-proof surface-proof--wide">
                <div className="surface-proof__intro">
                  <p className="landing-eyebrow">Step 02</p>
                  <h3>You get a ranked list, not a dashboard to interpret.</h3>
                  <p>
                    Biggest dollar first. The figure sits on the row, so nothing
                    needs decoding and nothing depends on telling two colours
                    apart.
                  </p>
                </div>
                <RankedProof />
              </li>

              <li className="surface-proof">
                <div className="surface-proof__intro">
                  <p className="landing-eyebrow">Step 03</p>
                  <h3>Each one comes with its receipt.</h3>
                  <p>
                    The arithmetic, the files it was read from, and the one
                    thing PantryIQ had to assume. You decide what happens next;
                    it never orders anything.
                  </p>
                </div>
                <RecommendationProof />
              </li>
            </ol>
          </div>
        </section>

        <section
          className="landing-pricing"
          id="pricing"
          aria-labelledby="landing-pricing-title"
        >
          <div className="landing-container landing-pricing__content">
            <div className="landing-section-heading">
              <p className="landing-eyebrow">Pricing</p>
              <h2 id="landing-pricing-title">One location. One clear price.</h2>
            </div>
            <div className="landing-pricing__card">
              <div
                className="landing-pricing__price"
                aria-label="$20 per location per month"
              >
                <span className="landing-pricing__amount figure">$20</span>
                <span className="landing-pricing__period">
                  per location
                  <br />
                  per month
                </span>
              </div>
              <p>
                Start with the sales and purchasing data you already have.
                PantryIQ gives you a clear place to begin.
              </p>
              <a
                className="landing-button landing-button--primary"
                href="/sign-up"
              >
                Start free
              </a>
            </div>
          </div>
        </section>

        <section
          className="landing-final-cta"
          aria-labelledby="landing-final-title"
        >
          <div className="landing-container landing-final-cta__content">
            <h2 id="landing-final-title">
              Start with one spreadsheet. See what it tells you.
            </h2>
            <a
              className="landing-button landing-button--primary"
              href="/sign-up"
            >
              Start free
            </a>
          </div>
        </section>
      </main>
    </>
  )
}
