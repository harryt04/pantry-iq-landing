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
  MenuEngineeringQuadrant,
  MenuEngineeringResult,
} from '@/src/server/menu/menu-engineering'

const quadrantOrder: MenuEngineeringQuadrant[] = [
  'star',
  'puzzle',
  'plowhorse',
  'dog',
]

function money(value: string) {
  return value.startsWith('-') ? `-$${value.slice(1)}` : `$${value}`
}

function quadrantTitle(quadrant: MenuEngineeringQuadrant) {
  return {
    star: 'Stars',
    puzzle: 'Puzzles',
    plowhorse: 'Plowhorses',
    dog: 'Dogs',
  }[quadrant]
}

export function MenuEngineeringView({
  result,
}: {
  result: MenuEngineeringResult
}) {
  const rowsByQuadrant = new Map(
    quadrantOrder.map((quadrant) => [
      quadrant,
      result.rows.filter((row) => row.quadrant === quadrant),
    ]),
  )

  return (
    <main className="menu-engineering-page">
      <header className="menu-engineering-header">
        <div>
          <p className="menu-engineering-eyebrow">
            PantryIQ / menu engineering
          </p>
          <h1>See what earns its place.</h1>
          <p>
            Popularity is units sold. Profitability is recipe-derived plate
            margin. The table is the source of truth; the matrix is a quick way
            to scan the same numbers.
          </p>
        </div>
        <a className="menu-engineering-back-link" href="/account">
          Back to account
        </a>
      </header>

      <div className="menu-engineering-summary" role="status">
        <span>
          {result.rows.length} item{result.rows.length === 1 ? '' : 's'} in the
          matrix
        </span>
        <span>{result.observedWeeks} business weeks observed</span>
        <span>Needs {result.minimumHistoryWeeks} weeks minimum</span>
      </div>

      {result.status === 'insufficient-data' && (
        <Card className="state-edge--watch">
          <CardHeader>
            <CardTitle>Not enough comparable data yet</CardTitle>
            <CardDescription>
              Items stay out of the matrix until their history and
              recipe-derived margin are strong enough to compare.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {result.status === 'calculated' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Ranked menu items</CardTitle>
              <CardDescription>
                Ranked by estimated contribution margin for the observed sales
                period. Quadrant words are printed on every row.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableCaption>
                  Thresholds: {result.popularityThreshold} units sold and{' '}
                  {money(result.marginThreshold ?? '0')} plate margin, both
                  calculated across included items.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Menu item</TableHead>
                    <TableHead>Quadrant</TableHead>
                    <TableHead className="figure">Units sold</TableHead>
                    <TableHead className="figure">Plate margin</TableHead>
                    <TableHead className="figure">Contribution</TableHead>
                    <TableHead className="figure">Weeks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row) => (
                    <TableRow key={row.menuItemId}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>
                        <span
                          className={`menu-quadrant menu-quadrant--${row.quadrant}`}
                        >
                          {row.quadrantLabel}
                        </span>
                      </TableCell>
                      <TableCell className="figure">{row.unitsSold}</TableCell>
                      <TableCell className="figure">
                        {money(row.marginPerItem)}
                      </TableCell>
                      <TableCell className="figure">
                        {money(row.contributionMargin)}
                      </TableCell>
                      <TableCell className="figure">{row.salesWeeks}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Matrix view</CardTitle>
              <CardDescription>
                Position follows popularity and plate margin. Each cell and item
                repeats the quadrant in words, so color and position are never
                the only signal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="menu-matrix"
                aria-label="Menu engineering quadrant matrix"
                role="img"
              >
                <div className="menu-matrix-axis menu-matrix-axis--y">
                  Plate margin ↑
                </div>
                <div className="menu-matrix-grid">
                  {quadrantOrder.map((quadrant) => {
                    const quadrantRows = rowsByQuadrant.get(quadrant) ?? []
                    return (
                      <section
                        className={`menu-matrix-cell menu-matrix-cell--${quadrant}`}
                        key={quadrant}
                        aria-label={`${quadrantTitle(quadrant)}: ${quadrantRows.length} items`}
                      >
                        <h2>{quadrantTitle(quadrant)}</h2>
                        <p>{quadrantRows[0]?.quadrantLabel ?? 'No items'}</p>
                        {quadrantRows.length > 0 && (
                          <ul>
                            {quadrantRows.map((row) => (
                              <li key={row.menuItemId}>
                                <strong>{row.name}</strong>
                                <span>
                                  {row.unitsSold} sold ·{' '}
                                  {money(row.marginPerItem)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>
                    )
                  })}
                </div>
                <div className="menu-matrix-axis menu-matrix-axis--x">
                  Less popular ← Units sold → More popular
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {result.excluded.length > 0 && (
        <Card className="state-edge--watch">
          <CardHeader>
            <CardTitle>Items left out</CardTitle>
            <CardDescription>
              These items are listed instead of being treated as zero. They do
              not meet the comparison contract yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="menu-exclusion-list">
              {result.excluded.map((item) => (
                <li key={item.menuItemId}>
                  <strong>{item.name}</strong>
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
