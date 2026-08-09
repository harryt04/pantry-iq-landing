import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const page = readFileSync(
  new URL('../app/(app)/dashboard/page.tsx', import.meta.url),
  'utf8',
)
const component = readFileSync(
  new URL('../components/dashboard/dashboard-data-state.tsx', import.meta.url),
  'utf8',
)

describe('dashboard insufficient-data contract', () => {
  it('renders the state from the owner-scoped data service and keeps supported trends visible', () => {
    expect(page).toContain('getDashboardDataState')
    expect(page).toContain('<DashboardDataState')
    expect(page).toContain('<TrendSummaries summaries={summaries} />')
  })

  it('gives each state one import action and uses concrete progress copy', () => {
    expect(component).toContain('Import a CSV')
    expect(component).toContain('transactionDays')
    expect(component).toContain('remainingDays')
    expect(component).not.toMatch(/simply|just|!/i)
    expect(component.match(/<Link\b/g)).toHaveLength(1)
  })
})
