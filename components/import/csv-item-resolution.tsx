'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type {
  ItemResolutionCandidate,
  UnmatchedItem,
} from '@/src/server/csv/item-resolution'
import {
  normalizeExactItemName,
  suggestedShelfLifeDays,
} from '@/src/server/csv/item-resolution'

export type NewItemResolutionInput = {
  canonicalName: string
  displayName: string
  category: string | null
  unit: string
  shelfLifeDays: number | null
}

export function CsvItemResolution({
  unmatchedItems,
  items,
  onLinkExisting,
  onCreateNew,
}: {
  unmatchedItems: readonly UnmatchedItem[]
  items: readonly ItemResolutionCandidate[]
  onLinkExisting: (rawItemName: string, itemId: string) => void
  onCreateNew: (rawItemName: string, input: NewItemResolutionInput) => void
}) {
  const current = unmatchedItems[0]
  const [search, setSearch] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [unit, setUnit] = React.useState('each')
  const [shelfLifeDays, setShelfLifeDays] = React.useState('')

  React.useEffect(() => {
    if (!current) return
    setSearch('')
    setCategory('')
    setUnit('each')
    setShelfLifeDays('')
  }, [current?.rawItemName])

  if (!current) return null
  const currentItem = current

  const normalizedSearch = normalizeExactItemName(search)
  const candidates = items
    .filter((item) => item.isActive !== false)
    .filter((item) => {
      if (!normalizedSearch) return true
      return [item.displayName, item.canonicalName].some((value) =>
        normalizeExactItemName(value).includes(normalizedSearch),
      )
    })
    .slice(0, 8)
  const suggestedDays = suggestedShelfLifeDays(category)

  function createNewItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = currentItem.rawItemName.trim()
    if (!trimmedName || !unit.trim()) return
    const parsedShelfLife = shelfLifeDays.trim()
      ? Number(shelfLifeDays)
      : suggestedDays
    onCreateNew(currentItem.rawItemName, {
      canonicalName: trimmedName,
      displayName: trimmedName,
      category: category.trim() || null,
      unit: unit.trim(),
      shelfLifeDays:
        parsedShelfLife !== null &&
        Number.isSafeInteger(parsedShelfLife) &&
        parsedShelfLife >= 0
          ? parsedShelfLife
          : null,
    })
  }

  return (
    <section
      className="csv-item-resolution"
      aria-labelledby="csv-item-resolution-title"
    >
      <div className="csv-mapping__heading">
        <div>
          <p className="app-page__eyebrow">Item names</p>
          <h2 id="csv-item-resolution-title">One item needs your call.</h2>
        </div>
        <p className="csv-mapping__progress" aria-live="polite">
          {unmatchedItems.length} unresolved item
          {unmatchedItems.length === 1 ? '' : 's'} remaining
        </p>
      </div>
      <p>
        We found {current.occurrenceCount.toLocaleString()} row
        {current.occurrenceCount === 1 ? '' : 's'} called{' '}
        <strong>{current.rawItemName || 'an empty item name'}</strong>. Choose
        an existing item or create one. Nothing imports until every item is
        resolved.
      </p>
      <div className="csv-item-resolution__context">
        <p className="csv-mapping__source-label">Rows for context</p>
        <ul>
          {current.context.map((example) => (
            <li key={example.rowNumber}>
              Row {example.rowNumber}:{' '}
              {Object.entries(example.values)
                .filter(([, value]) => value.length > 0)
                .map(([column, value]) => `${column}: ${value}`)
                .join(' · ')}
            </li>
          ))}
        </ul>
      </div>

      <div className="app-page__form-row">
        <Label htmlFor="existing-item-search">Find an existing item</Label>
        <Input
          id="existing-item-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search item names"
          autoComplete="off"
        />
        <div role="listbox" aria-label="Existing items">
          {candidates.map((item) => (
            <button
              className="csv-item-resolution__candidate"
              key={item.id}
              type="button"
              onClick={() => onLinkExisting(current.rawItemName, item.id)}
            >
              <span>{item.displayName}</span>
              <span>{item.unit}</span>
            </button>
          ))}
          {candidates.length === 0 ? (
            <p className="app-page__help">
              No existing item matches that search.
            </p>
          ) : null}
        </div>
      </div>

      <form className="app-page__form-row" onSubmit={createNewItem}>
        <p className="csv-mapping__source-label">Or create a new item</p>
        <Label htmlFor="new-item-category">Category (optional)</Label>
        <Input
          id="new-item-category"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value)
            setShelfLifeDays('')
          }}
          placeholder="Seafood, produce, dry goods…"
        />
        <Label htmlFor="new-item-unit">Unit</Label>
        <Input
          id="new-item-unit"
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          required
        />
        <Label htmlFor="new-item-shelf-life">Shelf life in days</Label>
        <Input
          id="new-item-shelf-life"
          type="number"
          min="0"
          step="1"
          value={shelfLifeDays}
          onChange={(event) => setShelfLifeDays(event.target.value)}
          placeholder={
            suggestedDays === null ? 'No suggestion' : String(suggestedDays)
          }
        />
        <p className="app-page__help">
          {suggestedDays === null
            ? 'No category suggestion is available. Leaving this blank keeps shelf life unknown.'
            : `Suggested: ${suggestedDays} days. This is a suggestion, and you can change it.`}
        </p>
        <Button type="submit">Create and use this item</Button>
      </form>
    </section>
  )
}
