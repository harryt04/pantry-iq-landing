import { describe, expect, it } from 'vitest'

import { buildMenuEngineeringMatrix, businessWeekKey } from './menu-engineering'

const options = {
  timezone: 'America/Denver',
  businessDayBoundary: '04:00:00',
}

function sale(menuItemId: string, date: string, qty: string) {
  return { menuItemId, transactedAt: `${date}T18:00:00.000Z`, qty }
}

describe('menu engineering matrix', () => {
  it('uses exact averages to classify and ranks by contribution margin', () => {
    const result = buildMenuEngineeringMatrix(
      [
        { menuItemId: 'star', name: 'Star', marginPerItem: '8.25' },
        { menuItemId: 'puzzle', name: 'Puzzle', marginPerItem: '12.50' },
        { menuItemId: 'plowhorse', name: 'Plowhorse', marginPerItem: '3.00' },
        { menuItemId: 'dog', name: 'Dog', marginPerItem: '1.25' },
      ],
      [
        ...['2026-07-06', '2026-07-13', '2026-07-20', '2026-07-27'].flatMap(
          (date) => [
            sale('star', date, '10'),
            sale('puzzle', date, '2'),
            sale('plowhorse', date, '14'),
            sale('dog', date, '1'),
          ],
        ),
      ],
      options,
    )

    expect(result.status).toBe('calculated')
    expect(result.popularityThreshold).toBe('27')
    expect(result.marginThreshold).toBe('6.25')
    expect(result.rows.map((row) => [row.name, row.quadrant])).toEqual([
      ['Star', 'star'],
      ['Plowhorse', 'plowhorse'],
      ['Puzzle', 'puzzle'],
      ['Dog', 'dog'],
    ])
    expect(result.rows[0]).toMatchObject({
      unitsSold: '40',
      contributionMargin: '330',
      quadrantLabel: 'Star — popular and profitable',
    })
  })

  it('excludes items without four business weeks and says why', () => {
    const result = buildMenuEngineeringMatrix(
      [
        { menuItemId: 'new', name: 'New dish', marginPerItem: '5' },
        { menuItemId: 'unpriced', name: 'Unpriced dish', marginPerItem: null },
      ],
      [
        sale('new', '2026-07-20', '10'),
        sale('unpriced', '2026-07-06', '10'),
        sale('unpriced', '2026-07-13', '10'),
        sale('unpriced', '2026-07-20', '10'),
        sale('unpriced', '2026-07-27', '10'),
      ],
      options,
    )

    expect(result.status).toBe('insufficient-data')
    expect(result.rows).toHaveLength(0)
    expect(result.excluded).toEqual([
      {
        menuItemId: 'new',
        name: 'New dish',
        reason:
          'Only 1 complete business week of sales; at least 4 are needed.',
      },
      {
        menuItemId: 'unpriced',
        name: 'Unpriced dish',
        reason: 'A complete recipe-derived plate margin is not available.',
      },
    ])
  })

  it('applies the business-day boundary before finding the business week', () => {
    expect(
      businessWeekKey('2026-07-13T09:59:00.000Z', 'America/Denver', '04:00:00'),
    ).toBe('2026-07-06')
    expect(
      businessWeekKey('2026-07-13T10:00:00.000Z', 'America/Denver', '04:00:00'),
    ).toBe('2026-07-13')
  })
})
