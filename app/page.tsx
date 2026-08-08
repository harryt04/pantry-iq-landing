import { SiteHeader } from './site-header'

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="landing-page">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-container landing-hero__content">
            <h1 id="landing-title">
              Waste less. Feed more. Keep the difference.
            </h1>
            <p className="landing-hero__subhead">
              Upload your sales and purchasing data. PantryIQ tells you what
              waste is costing you this week, what to do about it, and exactly
              how it got the number — then helps you get the surplus to a
              shelter nearby.
            </p>
            <div className="landing-hero__actions" aria-label="Get started">
              <a
                className="landing-button landing-button--primary"
                href="/sign-up"
              >
                Import a CSV
              </a>
              <a
                className="landing-button landing-button--secondary"
                href="#how-it-works"
              >
                See a worked example
              </a>
            </div>
            <p className="landing-hero__reassurance">
              No POS connection required. Works with a spreadsheet export.
            </p>
          </div>
        </section>

        <section className="landing-proof" aria-label="What you can expect">
          <div className="landing-container landing-proof__grid">
            <div className="landing-proof__item">
              <p className="landing-proof__value">Under 5 min</p>
              <p className="landing-proof__label">Upload to first insight</p>
            </div>
            <div className="landing-proof__item">
              <p className="landing-proof__value">Every claim</p>
              <p className="landing-proof__label">
                Traceable to a row you uploaded
              </p>
            </div>
            <div className="landing-proof__item">
              <p className="landing-proof__value">You decide</p>
              <p className="landing-proof__label">
                Nothing changes without you
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
          className="landing-how-it-works"
          id="how-it-works"
          aria-labelledby="landing-how-title"
        >
          <div className="landing-container">
            <div className="landing-section-heading">
              <p className="landing-eyebrow">How it works</p>
              <h2 id="landing-how-title">
                A clear answer from the data you already have.
              </h2>
            </div>
            <ol className="landing-steps">
              <li className="landing-step">
                <span className="landing-step__number" aria-hidden="true">
                  01
                </span>
                <div>
                  <h3>Upload what you already have.</h3>
                  <p>
                    A sales export, a purchase order, an inventory count. CSV
                    from any POS. Messy is fine — PantryIQ asks about the
                    columns it can&apos;t read rather than rejecting the file.
                  </p>
                </div>
              </li>
              <li className="landing-step">
                <span className="landing-step__number" aria-hidden="true">
                  02
                </span>
                <div>
                  <h3>See what&apos;s costing you.</h3>
                  <p>
                    Ranked by money at risk, most urgent first. Each one says
                    what it saw, what it costs, and what to consider doing.
                  </p>
                </div>
              </li>
              <li className="landing-step">
                <span className="landing-step__number" aria-hidden="true">
                  03
                </span>
                <div>
                  <h3>Ask it anything.</h3>
                  <p>
                    &ldquo;Why is my halibut margin so bad lately?&rdquo;
                    Answers come from your data, with the rows attached.
                  </p>
                </div>
              </li>
            </ol>
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
              Import a CSV
            </a>
          </div>
        </section>
      </main>
    </>
  )
}
