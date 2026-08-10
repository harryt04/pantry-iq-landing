export type SalesFixtureRow = {
  externalId: string
  itemName: string
  qty: string
  totalRevenue: string
  transactedAt: string
}

export type InventorySnapshotFixtureRow = {
  countedAt: string
  externalId: string
  itemName: string
  qty: string
}

export type LocationFixture = {
  inventorySnapshots: InventorySnapshotFixtureRow[]
  locationId: string
  sales: SalesFixtureRow[]
}

const fixtureStart = new Date('2025-01-01T12:00:00.000Z')

function fixtureDate(dayOffset: number, hour = 12): string {
  const date = new Date(fixtureStart)
  date.setUTCDate(date.getUTCDate() + dayOffset)
  date.setUTCHours(hour, 0, 0, 0)
  return date.toISOString()
}

/** A parser fixture with headers, whitespace, quoting, and a blank row. */
export const messyCsvFixture =
  '\uFEFF Date , Item Name , Qty , Unit Price \n' +
  '2025-03-01, "Soup, tomato", 2, 8.50\n' +
  '\n' +
  '2025-03-02,Salad, 1 , 11.00\n'

export const partialDataLocationFixture: LocationFixture = {
  locationId: '10000000-0000-4000-8000-000000000001',
  sales: Array.from({ length: 14 }, (_, dayOffset) => ({
    externalId: `partial-sale-${String(dayOffset + 1).padStart(2, '0')}`,
    itemName: dayOffset % 2 === 0 ? 'Tomato Soup' : 'House Salad',
    qty: '2',
    totalRevenue: dayOffset % 2 === 0 ? '17.00' : '22.00',
    transactedAt: fixtureDate(dayOffset),
  })),
  inventorySnapshots: [],
}

/** A full non-leap year, independent of the wall clock, for prediction tests. */
export const fullYearLocationFixture: LocationFixture = {
  locationId: '10000000-0000-4000-8000-000000000002',
  sales: Array.from({ length: 365 }, (_, dayOffset) => ({
    externalId: `year-sale-${String(dayOffset + 1).padStart(3, '0')}`,
    itemName: dayOffset % 3 === 0 ? 'Tomato Soup' : 'House Salad',
    qty: String((dayOffset % 3) + 1),
    totalRevenue: ((dayOffset % 3) + 1) * (dayOffset % 3 === 0 ? 8.5 : 11),
    transactedAt: fixtureDate(dayOffset),
  })).map((row) => ({
    ...row,
    totalRevenue: row.totalRevenue.toFixed(2),
  })),
  inventorySnapshots: Array.from({ length: 52 }, (_, week) => ({
    countedAt: fixtureDate(week * 7, 8),
    externalId: `year-count-${String(week + 1).padStart(2, '0')}`,
    itemName: 'Tomato Soup',
    qty: String(12 - (week % 4)),
  })),
}
