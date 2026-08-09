import { SiteHeader } from './site-header'
import { RecommendationProof } from '@/components/marketing/recommendation-proof'

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="landing-page">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-container landing-hero__content">
            <h1 id="landing-title">See what your kitchen data can tell you.</h1>
            <p className="landing-hero__subhead">
              PantryIQ is being built for restaurant operators who want a
              clearer view of sales, purchasing, and waste. The product keeps
              the operator in control and makes room for the numbers behind each
              decision.
            </p>
            <div className="landing-hero__actions" aria-label="Get started">
              <a
                className="landing-button landing-button--primary"
                href="/sign-up"
              >
                See the product direction
              </a>
              <a
                className="landing-button landing-button--secondary"
                href="#how-it-works"
              >
                Read the problem it is built to solve
              </a>
            </div>
            <p className="landing-hero__reassurance">
              Built for one location at a time. No POS connection required.
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

        <RecommendationProof />

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
          className="landing-how-it-works"
          id="how-it-works"
          aria-labelledby="landing-how-title"
        >
          <div className="landing-container">
            <div className="landing-section-heading">
              <p className="landing-eyebrow">How it works</p>
              <h2 id="landing-how-title">
                A clearer way to reason from the data you already have.
              </h2>
            </div>
            <ol className="landing-steps">
              <li className="landing-step">
                <span className="landing-step__number" aria-hidden="true">
                  01
                </span>
                <div>
                  <h3>Start with the data you already have.</h3>
                  <p>
                    The MVP is designed around sales exports, purchase orders,
                    and inventory counts, with CSV as the trust fallback.
                  </p>
                </div>
              </li>
              <li className="landing-step">
                <span className="landing-step__number" aria-hidden="true">
                  02
                </span>
                <div>
                  <h3>Separate facts from predictions.</h3>
                  <p>
                    PantryIQ&apos;s product contract keeps observed numbers
                    distinct from predictions and says what the data cannot
                    support.
                  </p>
                </div>
              </li>
              <li className="landing-step">
                <span className="landing-step__number" aria-hidden="true">
                  03
                </span>
                <div>
                  <h3>Keep the decision with the operator.</h3>
                  <p>
                    The system is designed to recommend and explain. You decide
                    what happens next; PantryIQ does not act for you.
                  </p>
                </div>
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
              See the product direction
            </a>
          </div>
        </section>
      </main>
    </>
  )
}
