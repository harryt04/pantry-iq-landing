import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { DashboardDataState } from './dashboard-data-state'
import type { DashboardDataState as DataState } from '@/src/server/metrics/dashboard-state'

/**
 * Replaces tests/dashboard-data-state-contract.test.ts, which asserted the
 * source file contained the strings 'Import a CSV', 'transactionDays' and
 * 'remainingDays'. Those pass whether or not the numbers reach the screen.
 */

const LOCATION_ID = 'location-1'

function render(state: DataState) {
  return renderToStaticMarkup(
    <DashboardDataState locationId={LOCATION_ID} state={state} />,
  )
}

describe('dashboard data state', () => {
  it('renders nothing once the dashboard is ready', () => {
    const markup = render({
      status: 'ready',
      transactionDays: 30,
      requiredDays: 7,
      remainingDays: 0,
    })

    expect(markup).toBe('')
  })

  it('states the real day counts for an empty location', () => {
    const markup = render({
      status: 'empty',
      transactionDays: 0,
      requiredDays: 7,
      remainingDays: 7,
    })

    expect(markup).toContain('Nothing to show yet.')
    expect(markup).toContain('0 / 7 days')
    expect(markup).toContain('You have 0 days of transaction data')
    expect(markup).toContain('Add 7 more days of transaction history')
  })

  it('counts down the remaining days while data is still arriving', () => {
    const markup = render({
      status: 'insufficient',
      transactionDays: 3,
      requiredDays: 7,
      remainingDays: 4,
    })

    expect(markup).toContain('Your dashboard is taking shape.')
    expect(markup).toContain('3 / 7 days')
    expect(markup).toContain('Add 4 more days')
    expect(markup).toContain('I need about 7 days')
  })

  it('labels the progress figure for screen readers', () => {
    const markup = render({
      status: 'insufficient',
      transactionDays: 3,
      requiredDays: 7,
      remainingDays: 4,
    })

    expect(markup).toContain('aria-label="3 of 7 transaction days available"')
  })

  it('offers exactly one action, pointed at the caller location', () => {
    const markup = render({
      status: 'empty',
      transactionDays: 0,
      requiredDays: 7,
      remainingDays: 7,
    })

    // More than one link here turns a single obvious next step into a choice.
    expect(markup.match(/<a\b/g)).toHaveLength(1)
    expect(markup).toContain('Import a CSV')
    expect(markup).toContain(`href="/import?locationId=${LOCATION_ID}"`)
  })

  it('escapes a location id that would otherwise break out of the query', () => {
    const markup = renderToStaticMarkup(
      <DashboardDataState
        locationId="a&b=c"
        state={{
          status: 'empty',
          transactionDays: 0,
          requiredDays: 7,
          remainingDays: 7,
        }}
      />,
    )

    expect(markup).toContain('href="/import?locationId=a%26b%3Dc"')
  })
})
