import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type {
  WalletImpactSummary,
  WalletValue,
} from '@/src/server/metrics/wallet'

function money(value: WalletValue) {
  return value.status === 'calculated' && value.amount !== null
    ? `$${value.amount}`
    : 'Not available'
}

function computedLabel(computedAt: string | null) {
  if (!computedAt) return 'Not computed yet.'
  const date = new Date(computedAt)
  if (Number.isNaN(date.getTime())) return 'Computed time unavailable.'
  return `Last computed ${new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date)} UTC.`
}

function ValueNote({ value }: { value: WalletValue }) {
  if (value.status === 'calculated') return null
  return <p className="wallet-impact-card__note">{value.reason}</p>
}

export function WalletImpactSummary({
  summary,
}: {
  summary: WalletImpactSummary
}) {
  const margin = summary.marginTrend
  return (
    <section className="wallet-impact" aria-labelledby="wallet-impact-title">
      <div className="wallet-impact__heading">
        <div>
          <p className="app-page__eyebrow">Wallet impact</p>
          <h2 id="wallet-impact-title">What is costing you money?</h2>
        </div>
        <p className="app-page__help">
          These figures use the latest completed metric run for this location.
        </p>
      </div>
      <Card className="wallet-impact-card">
        <CardHeader>
          <CardTitle>Money at risk if trends continue</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="wallet-impact-card__lead figure">
            {money(summary.moneyAtRisk)}
          </p>
          <ValueNote value={summary.moneyAtRisk} />
          <dl className="wallet-impact-card__details">
            <div>
              <dt>Estimated spoilage this week</dt>
              <dd className="figure">
                {money(summary.estimatedSpoilageThisWeek)}
              </dd>
              <ValueNote value={summary.estimatedSpoilageThisWeek} />
            </div>
            <div>
              <dt>Margin this week</dt>
              <dd className="figure">{margin.currentValueLabel}</dd>
              <p>{margin.directionLabel}</p>
              <p>{margin.comparisonLabel}</p>
            </div>
          </dl>
          <p className="wallet-impact-card__computed">
            {computedLabel(summary.computedAt)}
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
