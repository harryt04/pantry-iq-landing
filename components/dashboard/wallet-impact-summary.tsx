import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type {
  WalletImpactSummary,
  WalletValue,
} from '@/src/server/metrics/wallet'

function money(value: WalletValue) {
  return value.status === 'calculated' && value.amount !== null
    ? `$${value.amount}`
    : null
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

function ValueNote({
  value,
  asDefinition,
}: {
  value: WalletValue
  asDefinition?: boolean
}) {
  if (value.status === 'calculated') return null
  return asDefinition ? (
    <dd className="wallet-impact-card__note">{value.reason}</dd>
  ) : (
    <p className="wallet-impact-card__note">{value.reason}</p>
  )
}

export function WalletImpactSummary({
  summary,
}: {
  summary: WalletImpactSummary
}) {
  const margin = summary.marginTrend
  const moneyAtRisk = money(summary.moneyAtRisk)
  const estimatedSpoilage = money(summary.estimatedSpoilageThisWeek)
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
          {moneyAtRisk ? (
            <p className="wallet-impact-card__lead figure">{moneyAtRisk}</p>
          ) : null}
          <ValueNote value={summary.moneyAtRisk} />
          <dl className="wallet-impact-card__details">
            <div>
              <dt>Estimated spoilage this week</dt>
              {estimatedSpoilage ? (
                <dd className="figure">{estimatedSpoilage}</dd>
              ) : null}
              <ValueNote
                asDefinition
                value={summary.estimatedSpoilageThisWeek}
              />
            </div>
            <div>
              <dt>Margin this week</dt>
              {margin.currentValue !== null ? (
                <dd className="figure">{margin.currentValueLabel}</dd>
              ) : null}
              <dd className="wallet-impact-card__note">
                {margin.directionLabel}
              </dd>
              <dd className="wallet-impact-card__note">
                {margin.comparisonLabel}
              </dd>
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
