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
  TableCell,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { UsageVarianceResult } from '@/src/server/menu/usage-variance'

function quantity(value: string | null, unit: string) {
  return value === null ? '—' : `${value} ${unit}`
}

function signed(value: string | null, unit: string) {
  if (value === null) return '—'
  return `${value.startsWith('-') ? '' : '+'}${value} ${unit}`
}

export function UsageVarianceView({ result }: { result: UsageVarianceResult }) {
  return (
    <main className="usage-variance-page">
      <header className="usage-variance-header">
        <div>
          <p className="usage-variance-eyebrow">PantryIQ / ingredient usage</p>
          <h1>See what left the shelf.</h1>
          <p>
            Recipe-derived usage is compared with what your counts and purchases
            show. A positive variance is an observation, not a verdict about why
            it happened.
          </p>
        </div>
        <a className="usage-variance-back-link" href="/recipes">
          Review recipes
        </a>
      </header>

      {result.rows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Theoretical versus actual</CardTitle>
            <CardDescription>
              Actual usage uses the latest two physical counts in the selected
              period. Purchases bridge those counts; snapshots stay in charge.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="usage-variance-table-wrap">
              <Table>
                <TableCaption>
                  Quantities are in each ingredient&apos;s recorded unit. The
                  table does not treat missing counts as zero.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead className="figure">Theoretical</TableHead>
                    <TableHead className="figure">Actual</TableHead>
                    <TableHead className="figure">Variance</TableHead>
                    <TableHead className="figure">Variance %</TableHead>
                    <TableHead>Reading</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row) => (
                    <TableRow key={row.ingredientItemId}>
                      <TableCell>
                        <strong>{row.ingredientName}</strong>
                        <span className="usage-variance-unit">{row.unit}</span>
                      </TableCell>
                      <TableCell className="figure">
                        {quantity(row.theoreticalUsage, row.unit)}
                      </TableCell>
                      <TableCell className="figure">
                        {quantity(row.actualUsage, row.unit)}
                      </TableCell>
                      <TableCell className="figure">
                        {signed(row.variance, row.unit)}
                      </TableCell>
                      <TableCell className="figure">
                        {row.variancePercent === null
                          ? '—'
                          : `${row.variancePercent}%`}
                      </TableCell>
                      <TableCell>
                        {row.status === 'calculated' ? (
                          <details className="usage-variance-details">
                            <summary>Possible explanations</summary>
                            <ul>
                              {row.possibleExplanations.map((explanation) => (
                                <li key={explanation}>{explanation}</li>
                              ))}
                            </ul>
                          </details>
                        ) : (
                          <span>{row.reason}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="state-edge--watch">
          <CardHeader>
            <CardTitle>Nothing to compare yet.</CardTitle>
            <CardDescription>
              Add active recipes and sales for this location. Ingredients used
              by menu items without recipes stay out of the comparison.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {result.excluded.length > 0 && (
        <Card className="state-edge--watch">
          <CardHeader>
            <CardTitle>Items left out</CardTitle>
            <CardDescription>
              These sales were not turned into ingredient usage because doing so
              would require an assumption.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="usage-variance-exclusions">
              {result.excluded.map((item) => (
                <li key={item.menuItemId}>
                  <strong>{item.menuItemId}</strong>
                  <span>{item.reason}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
