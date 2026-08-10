import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  LaborEfficiencyPeriod,
  LaborEfficiencyResult,
} from '@/src/server/staffing/labor-efficiency'
import type { DemandForecastPeriod } from '@/src/server/staffing/demand-forecast'
import type { StaffingRecommendationRecord } from '@/src/server/metrics/recommendations'

function figure(value: string | null, suffix = '') {
  return value === null ? '—' : `${value}${suffix}`
}

function metric(
  period: LaborEfficiencyPeriod,
  key:
    | 'salesPerLaborHour'
    | 'laborCostPercentage'
    | 'primeCost'
    | 'primeCostPercentage',
  suffix = '',
) {
  const result = period[key]
  return result.status === 'calculated' ? figure(result.value, suffix) : '—'
}

function periodHeading(dimension: LaborEfficiencyPeriod['dimension']) {
  if (dimension === 'shift') return 'By shift'
  if (dimension === 'day-part') return 'By day part'
  return 'By day of week'
}

function PeriodTable({
  dimension,
  periods,
}: {
  dimension: LaborEfficiencyPeriod['dimension']
  periods: LaborEfficiencyPeriod[]
}) {
  const rows = periods.filter((period) => period.dimension === dimension)
  if (rows.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{periodHeading(dimension)}</CardTitle>
        <CardDescription>
          Sales and labor are shown only where both sides of the period have
          data. A dash means the requested number cannot be calculated from the
          imported rows.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableCaption>
              Actual hours power sales per labor hour. Prime cost is food cost
              plus labor cost.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead className="figure">Sales</TableHead>
                <TableHead className="figure">Actual hours</TableHead>
                <TableHead className="figure">Sales / labor hour</TableHead>
                <TableHead className="figure">Labor %</TableHead>
                <TableHead className="figure">Prime cost</TableHead>
                <TableHead className="figure">Prime %</TableHead>
                <TableHead className="figure">Actual − scheduled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((period) => (
                <TableRow key={period.id}>
                  <TableCell>
                    <strong>{period.label}</strong>
                  </TableCell>
                  <TableCell className="figure">
                    {figure(period.sales, period.sales === null ? '' : ' USD')}
                  </TableCell>
                  <TableCell className="figure">
                    {figure(
                      period.actualHours,
                      period.actualHours === null ? '' : ' h',
                    )}
                  </TableCell>
                  <TableCell className="figure">
                    {metric(period, 'salesPerLaborHour', ' USD/h')}
                  </TableCell>
                  <TableCell className="figure">
                    {metric(period, 'laborCostPercentage', '%')}
                  </TableCell>
                  <TableCell className="figure">
                    {metric(period, 'primeCost', ' USD')}
                  </TableCell>
                  <TableCell className="figure">
                    {metric(period, 'primeCostPercentage', '%')}
                  </TableCell>
                  <TableCell className="figure">
                    {figure(
                      period.scheduledActualVariance,
                      period.scheduledActualVariance === null ? '' : ' h',
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

export function LaborEfficiencyView({
  result,
}: {
  result: LaborEfficiencyResult & {
    forecast: {
      status: 'calculated' | 'suppressed'
      method: string
      historyRequirement: string
      historyDays: number
      periods: DemandForecastPeriod[]
      accuracy: {
        status: 'calculated' | 'cannot-calculate'
        observations: number
        coversMae: string | null
        salesMae: string | null
        coversMape: string | null
        salesMape: string | null
        reason?: string
      }
      trace: { calculations: unknown[] }
      externalSignals: {
        status: 'applied' | 'not-demonstrated' | 'unavailable'
        appliedCount: number
        correlations: Array<{
          source: string
          feature: string
          observations: number
          coefficient: string | null
          qualified: boolean
          reason: string
        }>
      }
      reason?: string
    }
    shiftRecommendations: StaffingRecommendationRecord[]
  }
}) {
  return (
    <main className="app-page" aria-labelledby="staffing-title">
      <p className="app-page__eyebrow">Staffing / labor efficiency</p>
      <h1 id="staffing-title">See labor beside the sales it supported.</h1>
      <p className="app-page__lede">
        These are observations from the last 365 days of imported sales and
        labor data. PantryIQ does not turn a missing number into a zero.
      </p>

      {result.periods.length === 0 ? (
        <Card className="state-edge--watch">
          <CardHeader>
            <CardTitle>There is not a comparable period yet.</CardTitle>
            <CardDescription>
              Import sales and labor shifts with matching dates. Shift metrics
              also need a start and end time.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-6">
          <PeriodTable dimension="shift" periods={result.periods} />
          <PeriodTable dimension="day-part" periods={result.periods} />
          <PeriodTable dimension="day-of-week" periods={result.periods} />
        </div>
      )}

      <DemandForecastView forecast={result.forecast} />

      <ShiftRecommendationsView recommendations={result.shiftRecommendations} />

      {result.exclusions.length > 0 ? (
        <Card className="state-edge--watch">
          <CardHeader>
            <CardTitle>Periods left out</CardTitle>
            <CardDescription>
              Sales-only and labor-only periods are excluded rather than
              compared to an invented zero. Ambiguous shift overlaps are also
              left visible here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul>
              {result.exclusions.map((exclusion, index) => (
                <li key={`${exclusion.dimension}-${exclusion.period}-${index}`}>
                  <strong>{exclusion.period}</strong>: {exclusion.reason}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>How these figures line up</CardTitle>
          <CardDescription>
            The boundary and completeness rules stay visible so the result can
            be checked against the source exports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul>
            {result.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  )
}

function riskLabel(
  status: StaffingRecommendationRecord['risks']['understaffing']['status'],
) {
  if (status === 'possible') return 'Possible'
  if (status === 'not-indicated') return 'Not indicated'
  return 'Cannot calculate'
}

function ShiftRecommendationsView({
  recommendations,
}: {
  recommendations: StaffingRecommendationRecord[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Consider staffing by shift</CardTitle>
        <CardDescription>
          These are suggestions from the demand forecast and historical sales
          per labor hour. PantryIQ does not publish a schedule or write to a
          rostering system.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {recommendations.length === 0 ? (
          <p>
            There is not enough comparable forecast and role history to make a
            shift suggestion yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableCaption>
                Forecast ranges use held-out sales error when it can be
                calculated. Both staffing risks stay visible.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Shift</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="figure">Forecast sales</TableHead>
                  <TableHead className="figure">Consider hours</TableHead>
                  <TableHead>Forecast basis</TableHead>
                  <TableHead>Risks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recommendations.map((recommendation) => (
                  <TableRow key={recommendation.id}>
                    <TableCell>
                      <strong>{recommendation.businessDate}</strong>
                      <br />
                      {recommendation.dayPart}
                    </TableCell>
                    <TableCell>{recommendation.role}</TableCell>
                    <TableCell className="figure">
                      {recommendation.forecastSales} USD
                    </TableCell>
                    <TableCell className="figure">
                      {recommendation.recommendedHours} h
                    </TableCell>
                    <TableCell>
                      <p>{recommendation.forecastBasis}.</p>
                      <p>{recommendation.uncertainty.detail}</p>
                    </TableCell>
                    <TableCell>
                      <p>
                        <strong>Under:</strong>{' '}
                        {riskLabel(recommendation.risks.understaffing.status)}:{' '}
                        {recommendation.risks.understaffing.detail}
                      </p>
                      <p>
                        <strong>Over:</strong>{' '}
                        {riskLabel(recommendation.risks.overstaffing.status)}:{' '}
                        {recommendation.risks.overstaffing.detail}
                      </p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function forecastFigure(
  value: string | null,
  units: string,
  status: DemandForecastPeriod['covers']['status'],
) {
  if (status !== 'calculated' || value === null) return '—'
  return `${value} ${units}`
}

function DemandForecastView({
  forecast,
}: {
  forecast: {
    status: 'calculated' | 'suppressed'
    method: string
    historyRequirement: string
    historyDays: number
    periods: DemandForecastPeriod[]
    accuracy: {
      status: 'calculated' | 'cannot-calculate'
      observations: number
      coversMae: string | null
      salesMae: string | null
      coversMape: string | null
      salesMape: string | null
      reason?: string
    }
    trace: { calculations: unknown[] }
    externalSignals: {
      status: 'applied' | 'not-demonstrated' | 'unavailable'
      appliedCount: number
      correlations: Array<{
        source: string
        feature: string
        observations: number
        coefficient: string | null
        qualified: boolean
        reason: string
      }>
    }
    reason?: string
  }
}) {
  const byDate = new Map<string, DemandForecastPeriod[]>()
  for (const period of forecast.periods) {
    const rows = byDate.get(period.businessDate) ?? []
    rows.push(period)
    byDate.set(period.businessDate, rows)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Demand forecast</CardTitle>
        <CardDescription>
          A prediction for the next seven business days. It uses imported
          transaction quantity as the source&apos;s cover or unit measure, plus
          revenue, grouped by business day and day part.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {forecast.status === 'suppressed' ? (
          <p>
            {forecast.reason} You have {forecast.historyDays} of the required{' '}
            {forecast.historyRequirement.toLowerCase()}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableCaption>
                  Every prediction states its weekday/day-part basis. A dash
                  means there are not two comparable periods to use.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Day part</TableHead>
                    <TableHead className="figure">Predicted covers</TableHead>
                    <TableHead className="figure">Predicted sales</TableHead>
                    <TableHead>Basis</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...byDate.entries()].flatMap(([date, periods]) =>
                    periods.map((period) => (
                      <TableRow key={period.id}>
                        <TableCell>
                          <strong>{date}</strong>
                          <br />
                          {period.dayOfWeek}
                        </TableCell>
                        <TableCell>{period.dayPart}</TableCell>
                        <TableCell className="figure">
                          {forecastFigure(
                            period.covers.value,
                            'units',
                            period.covers.status,
                          )}
                        </TableCell>
                        <TableCell className="figure">
                          {forecastFigure(
                            period.sales.value,
                            'USD',
                            period.sales.status,
                          )}
                        </TableCell>
                        <TableCell>{period.basis}</TableCell>
                      </TableRow>
                    )),
                  )}
                </TableBody>
              </Table>
            </div>
            <p>
              <strong>Method:</strong> {forecast.method}{' '}
              {forecast.accuracy.status === 'calculated'
                ? `Held-out accuracy covers ${forecast.accuracy.observations} observations: ${forecast.accuracy.coversMae} units covers MAE and ${forecast.accuracy.salesMae} USD sales MAE.`
                : forecast.accuracy.reason}
            </p>
            <p>
              <strong>Trace:</strong> {forecast.trace.calculations.length}{' '}
              forecast calculations are available for the show-your-work record.
            </p>
            <p>
              <strong>External signals:</strong>{' '}
              {forecast.externalSignals.status === 'applied'
                ? `${forecast.externalSignals.appliedCount} demonstrated signal condition${forecast.externalSignals.appliedCount === 1 ? '' : 's'} used to select comparable history.`
                : forecast.externalSignals.status === 'not-demonstrated'
                  ? 'Provider data is retained, but no signal has enough demonstrated correlation to change this forecast.'
                  : 'No weather or local-event provider data is available; the imported-sales forecast remains in use.'}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
