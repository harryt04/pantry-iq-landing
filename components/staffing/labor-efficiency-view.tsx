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
  result: LaborEfficiencyResult
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
