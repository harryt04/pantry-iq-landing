'use client'

import * as React from 'react'
import Link from 'next/link'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { getChartEncoding } from '@/components/charts/chart-primitives'
import type {
  ItemDeepDive,
  ItemDeepDiveGroups,
} from '@/src/server/metrics/item-deep-dives'

function displayValue(value: string | null, suffix = '') {
  return value === null ? 'Not enough data' : `${value}${suffix}`
}

function dollarValue(value: string | null) {
  return value === null ? 'Not available' : `$${value}`
}

function itemKey(item: ItemDeepDive) {
  return item.itemId
}

type ItemGroup = {
  label: string
  description: string
  items: readonly ItemDeepDive[]
  value: (item: ItemDeepDive) => string
  numericValue: (item: ItemDeepDive) => string | null
  onSelect: (item: ItemDeepDive) => void
  seriesIndex: number
}

type ItemBarStyle = React.CSSProperties & {
  '--c': string
  '--item-bar-width': string
}

type Magnitude = {
  coefficient: bigint
  scale: number
}

function magnitude(value: string | null): Magnitude | null {
  if (value === null || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) {
    return null
  }

  const unsigned = value.replace(/^[+-]/, '')
  const [integer = '0', fraction = ''] = unsigned.split('.')
  return {
    coefficient: BigInt(`${integer}${fraction}` || '0'),
    scale: fraction.length,
  }
}

function scaledCoefficient(value: Magnitude, scale: number) {
  return value.coefficient * 10n ** BigInt(scale - value.scale)
}

function groupItems(group: ItemGroup) {
  if (group.items.length === 0) return null

  const encoding = getChartEncoding(group.seriesIndex)
  const values = group.items.flatMap((item) => {
    const value = magnitude(group.numericValue(item))
    return value ? [value] : []
  })
  const scale = Math.max(...values.map((value) => value.scale), 0)
  const maximum = values.reduce(
    (largest, value) =>
      scaledCoefficient(value, scale) > largest
        ? scaledCoefficient(value, scale)
        : largest,
    0n,
  )

  return (
    <div className="item-deep-dives__group">
      <div>
        <h3>{group.label}</h3>
        <p>{group.description}</p>
      </div>
      <div className="item-deep-dives__items">
        {group.items.map((item, index) => {
          const numeric = magnitude(group.numericValue(item))
          const width =
            numeric === null || maximum === 0n
              ? null
              : (() => {
                  const basisPoints =
                    (scaledCoefficient(numeric, scale) * 10000n) / maximum
                  const clamped = basisPoints < 300n ? 300n : basisPoints
                  return `${clamped / 100n}.${(clamped % 100n)
                    .toString()
                    .padStart(2, '0')}%`
                })()

          return (
            <button
              className="item-deep-dives__item"
              key={itemKey(item)}
              onClick={() => group.onSelect(item)}
              type="button"
            >
              <span className="item-deep-dives__item-heading">
                <span className="item-deep-dives__item-rank figure">
                  #{index + 1}
                </span>
                <span className="item-deep-dives__item-name">
                  <strong>{item.displayName}</strong>
                  <small>{item.category ?? item.unit}</small>
                </span>
                <span className="item-deep-dives__item-state">
                  {group.label}
                </span>
              </span>
              <span className="item-deep-dives__item-bar" aria-hidden="true">
                <span
                  className={`item-deep-dives__item-bar-fill pat pat--${encoding.pattern}`}
                  style={
                    {
                      '--c': encoding.color,
                      '--item-bar-width': `${width ?? 100}%`,
                    } as ItemBarStyle
                  }
                />
              </span>
              <span className="item-deep-dives__item-value figure">
                {group.value(item)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ActivityList({ item }: { item: ItemDeepDive }) {
  return (
    <div className="item-deep-dive__activity">
      <section aria-labelledby="item-sales-title">
        <h3 id="item-sales-title">Recent sales</h3>
        {item.recentSales.length === 0 ? (
          <p>There are no imported sales for this item yet.</p>
        ) : (
          <ul>
            {item.recentSales.map((sale) => (
              <li key={`${sale.transactedAt.toISOString()}-${sale.quantity}`}>
                <span>{sale.transactedAt.toISOString().slice(0, 10)}</span>
                <span className="figure">
                  {sale.quantity} {item.unit} · {dollarValue(sale.revenue)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="item-orders-title">
        <h3 id="item-orders-title">Recent orders</h3>
        {item.recentOrders.length === 0 ? (
          <p>There are no imported orders for this item yet.</p>
        ) : (
          <ul>
            {item.recentOrders.map((order) => (
              <li key={`${order.orderedAt.toISOString()}-${order.quantity}`}>
                <span>{order.orderedAt.toISOString().slice(0, 10)}</span>
                <span className="figure">
                  {order.quantity} {item.unit} · {dollarValue(order.totalCost)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Detail({
  item,
  locationId,
}: {
  item: ItemDeepDive
  locationId: string
}) {
  const shelfLife = item.shelfLifeDays
    ? `${item.shelfLifeDays} days`
    : 'Not available'
  const shelfLifeNote =
    item.shelfLifeSource === 'category suggestion' && item.shelfLifeCategory
      ? `Suggested for ${item.shelfLifeCategory.toLowerCase()}.`
      : item.shelfLifeSource === 'item setting'
        ? 'Set for this item.'
        : 'No item or category value is available.'

  return (
    <div className="item-deep-dive">
      <dl className="item-deep-dive__metrics">
        <div>
          <dt>Sell-through</dt>
          <dd className="figure">{displayValue(item.sellThroughRate, '%')}</dd>
        </div>
        <div>
          <dt>On hand</dt>
          <dd className="figure">{displayValue(item.quantityOnHand)}</dd>
          <small>{item.unit}</small>
        </div>
        <div>
          <dt>Unit cost</dt>
          <dd className="figure">
            {item.unitCost === null ? 'Not available' : `$${item.unitCost}`}
          </dd>
          <small>{item.unitCostSource}</small>
        </div>
        <div>
          <dt>Shelf life</dt>
          <dd className="figure">{shelfLife}</dd>
          <small>{shelfLifeNote}</small>
        </div>
      </dl>

      <section
        className="item-deep-dive__facts"
        aria-labelledby="item-facts-title"
      >
        <h3 id="item-facts-title">What the data supports</h3>
        <dl>
          <div>
            <dt>Sold</dt>
            <dd className="figure">
              {displayValue(item.quantitySold)} {item.unit}
            </dd>
          </div>
          <div>
            <dt>Ordered</dt>
            <dd className="figure">
              {displayValue(item.quantityOrdered)} {item.unit}
            </dd>
          </div>
          <div>
            <dt>Revenue</dt>
            <dd className="figure">{dollarValue(item.totalRevenue)}</dd>
          </div>
          <div>
            <dt>Margin</dt>
            <dd className="figure">{dollarValue(item.margin)}</dd>
          </div>
        </dl>
      </section>

      <section
        className="item-deep-dive__assumptions"
        aria-labelledby="item-assumptions-title"
      >
        <h3 id="item-assumptions-title">Assumptions used</h3>
        <ul>
          <li>
            Shelf life: {shelfLife}. {shelfLifeNote}{' '}
            <Link href="/settings#item-master">Edit item settings</Link>
          </li>
          <li>
            Unit cost:{' '}
            {item.unitCost === null ? 'not available' : `$${item.unitCost}`} (
            {item.unitCostSource}).{' '}
            <Link href="/settings#item-master">Edit item settings</Link>
          </li>
        </ul>
      </section>

      <ActivityList item={item} />

      <section
        className="item-deep-dive__recommendations"
        aria-labelledby="item-recommendations-title"
      >
        <div>
          <h3 id="item-recommendations-title">Recommendations for this item</h3>
          {item.recommendations.length === 0 ? (
            <p>No ranked recommendation currently touches this item.</p>
          ) : (
            <ul>
              {item.recommendations.map((recommendation) => (
                <li key={recommendation.evidenceTraceRef.key}>
                  <span>
                    <strong>#{recommendation.rank}</strong> ·{' '}
                    {recommendation.suggestedAction.action ===
                    'reduce-next-order-or-pull-from-menu'
                      ? 'Review the next order'
                      : 'Review this item'}
                  </span>
                  <Link
                    href={`/chat?locationId=${encodeURIComponent(locationId)}&itemId=${encodeURIComponent(item.itemId)}`}
                  >
                    Ask about {item.displayName}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

export function ItemDeepDives({
  locationId,
  groups,
}: {
  locationId: string
  groups: ItemDeepDiveGroups
}) {
  const [selectedItem, setSelectedItem] = React.useState<ItemDeepDive | null>(
    null,
  )
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return (
    <section
      className="item-deep-dives"
      aria-labelledby="item-deep-dives-title"
    >
      <div className="item-deep-dives__heading dashboard-section-heading--compact">
        <div>
          <h2 id="item-deep-dives-title">Look closer at an item.</h2>
          <p className="app-page__qualifier">
            Choose revenue, spoilage risk, or margin to see imported facts for
            an item.
          </p>
        </div>
      </div>
      <div className="item-deep-dives__groups">
        {groupItems({
          label: 'Top selling',
          description: 'Highest imported revenue in the available history.',
          items: groups.topSelling,
          value: (item) => dollarValue(item.totalRevenue),
          numericValue: (item) => item.totalRevenue,
          onSelect: setSelectedItem,
          seriesIndex: 0,
        })}
        {groupItems({
          label: 'Spoilage risk',
          description:
            'Items with the largest calculated value currently on hand.',
          items: groups.spoilageRisk,
          value: (item) => dollarValue(item.spoilageRisk),
          numericValue: (item) => item.spoilageRisk,
          onSelect: setSelectedItem,
          seriesIndex: 1,
        })}
        {groupItems({
          label: 'Low margin',
          description:
            'Lowest calculated margin among items with enough inputs.',
          items: groups.lowMargin,
          value: (item) => dollarValue(item.margin),
          numericValue: (item) => item.margin,
          onSelect: setSelectedItem,
          seriesIndex: 2,
        })}
        {groupItems({
          label: 'Needs more data',
          description:
            'Items remain visible even when a rollup cannot be calculated.',
          items: groups.needsData,
          value: () => 'Open detail',
          numericValue: () => null,
          onSelect: setSelectedItem,
          seriesIndex: 3,
        })}
      </div>

      {isMobile ? (
        <Sheet
          open={selectedItem !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedItem(null)
          }}
        >
          <SheetContent className="item-deep-dive__surface" side="bottom">
            <SheetHeader>
              <SheetTitle>{selectedItem?.displayName}</SheetTitle>
              <SheetDescription>
                Imported detail for {selectedItem?.displayName}. Values stay
                scoped to this location.
              </SheetDescription>
            </SheetHeader>
            {selectedItem ? (
              <div className="item-deep-dive__scroll">
                <Detail item={selectedItem} locationId={locationId} />
              </div>
            ) : null}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog
          open={selectedItem !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedItem(null)
          }}
        >
          <DialogContent className="item-deep-dive__surface">
            <DialogHeader>
              <DialogTitle>{selectedItem?.displayName}</DialogTitle>
              <DialogDescription>
                Imported detail for {selectedItem?.displayName}. Values stay
                scoped to this location.
              </DialogDescription>
            </DialogHeader>
            {selectedItem ? (
              <div className="item-deep-dive__scroll">
                <Detail item={selectedItem} locationId={locationId} />
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      )}
    </section>
  )
}
