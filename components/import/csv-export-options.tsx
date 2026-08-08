import Link from 'next/link'

import { Button } from '@/components/ui/button'

const exports = [
  ['transactions', 'Transactions'],
  ['purchase_orders', 'Purchase orders'],
  ['inventory_items', 'Inventory items'],
  ['inventory_snapshots', 'Inventory snapshots'],
] as const

export function CsvExportOptions({ locationId }: { locationId: string }) {
  return (
    <section className="csv-export" aria-labelledby="csv-export-title">
      <p className="app-page__eyebrow">Trust fallback</p>
      <h2 id="csv-export-title">Take your data with you.</h2>
      <p className="app-page__help">
        Download this location&apos;s records as CSV. Imported records keep the
        original numbers and dates; the item file is a complete reference for
        your pantry.
      </p>
      <div className="csv-export__actions">
        {exports.map(([type, label]) => (
          <Button key={type} variant="outline" asChild>
            <Link
              href={`/api/exports/${type}?locationId=${encodeURIComponent(locationId)}`}
              download
            >
              Download {label}
            </Link>
          </Button>
        ))}
      </div>
    </section>
  )
}
