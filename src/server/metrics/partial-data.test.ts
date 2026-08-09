import { describe, expect, it } from 'vitest'

import { buildPartialDataFindings } from './partial-data'

const metric = (
  metricKey: string,
  result: Record<string, unknown>,
): {
  metricKey: string
  status: 'calculated'
  value: string | null
  result: Record<string, unknown>
} => ({
  metricKey,
  status: 'calculated',
  value: typeof result.value === 'string' ? result.value : null,
  result,
})

const currentDate = new Date('2026-05-15T12:00:00.000Z')

describe('partial and conflicting data findings', () => {
  it('keeps short history observational and names the missing requirement', () => {
    const findings = buildPartialDataFindings({
      metrics: [
        metric('dataSufficiency', {
          value: '15',
          predictionEligible: false,
          inputs: { historyWeeks: '1', predictionHistoryWeeks: '4' },
        }),
      ],
      unit: 'lb',
      currentDate,
      quantities: ['5', '0', '2'],
    })

    expect(findings).toEqual([
      expect.objectContaining({
        code: 'insufficient-history',
        message:
          'There are 1 week of transaction history here, so this is an observation rather than a prediction.',
        details: expect.objectContaining({
          requiredHistoryWeeks: '4',
          supply: 'Add 4 weeks of transactions to enable a prediction.',
        }),
      }),
    ])
    expect(findings[0]?.message).not.toContain('0 weeks')
  })

  it('keeps quantities when prices are missing and never invents dollars', () => {
    const findings = buildPartialDataFindings({
      metrics: [
        metric('impact', {
          value: '31',
          dollarsAvailable: false,
          inputs: { qtyOrdered: '5', qtySold: '0' },
        }),
      ],
      unit: 'lb',
      currentDate,
      quantities: ['5', '0', null],
    })

    expect(findings).toEqual([
      expect.objectContaining({
        code: 'missing-prices',
        message: expect.stringContaining('unit cost is missing'),
        details: expect.objectContaining({
          missing: 'unit cost',
          unit: 'lb',
        }),
      }),
    ])
    expect(findings[0]?.message).not.toContain('$')
  })

  it('surfaces a material physical-count variance with possible explanations', () => {
    const findings = buildPartialDataFindings({
      metrics: [
        metric('spoilageEstimate', {
          value: '7',
          resolution: {
            variances: [
              {
                start: '2026-08-01T12:00:00.000Z',
                end: '2026-08-08T12:00:00.000Z',
                snapshotValue: '7',
                inferredValue: '4',
                difference: '3',
              },
            ],
          },
        }),
      ],
      unit: 'lb',
      currentDate,
      quantities: ['10', '2', '4'],
    })

    expect(findings).toEqual([
      expect.objectContaining({
        code: 'conflicting-data',
        message:
          'There is a 3 lb variance between the physical count and the order-and-sales calculation.',
        details: expect.objectContaining({
          physicalCountResult: '7',
          orderAndSalesResult: '4',
          possibleExplanations: expect.stringContaining('Waste'),
        }),
      }),
    ])
  })

  it('acknowledges a seasonal pattern while preserving the imported observation', () => {
    const findings = buildPartialDataFindings({
      metrics: [],
      unit: 'each',
      currentDate,
      sales: [
        { qty: '1', transactedAt: new Date('2025-12-10T12:00:00.000Z') },
        { qty: '2', transactedAt: new Date('2026-01-10T12:00:00.000Z') },
        { qty: '1', transactedAt: new Date('2026-02-10T12:00:00.000Z') },
      ],
    })

    expect(findings).toEqual([
      expect.objectContaining({
        code: 'seasonal-pattern',
        message:
          'Sales for this item appear limited to winter months, and there are no sales in May. It may be seasonal; the historical data is still shown.',
        details: expect.objectContaining({
          explanation: expect.stringContaining('observation'),
        }),
      }),
    ])
  })
})
