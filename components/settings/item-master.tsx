'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export type ItemMasterItem = {
  id: string
  canonicalName: string
  displayName: string
  category: string | null
  unit: string
  itemType: string
  shelfLifeDays: number | null
  costPerUnit: string | null
  usageCount: number
  isActive: boolean
  updatedAt: string | Date
}

type ItemDraft = Pick<
  ItemMasterItem,
  'displayName' | 'category' | 'unit' | 'shelfLifeDays' | 'costPerUnit'
>

function sourceLabel(value: string | number | null) {
  return value === null ? 'PantryIQ default: not set' : 'Your value'
}

function draftFor(item: ItemMasterItem): ItemDraft {
  return {
    displayName: item.displayName,
    category: item.category,
    unit: item.unit,
    shelfLifeDays: item.shelfLifeDays,
    costPerUnit: item.costPerUnit,
  }
}

function toNullableText(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function ItemMaster({
  initialItems,
  locationId,
}: {
  initialItems: ItemMasterItem[]
  locationId: string
}) {
  const [items, setItems] = React.useState(initialItems)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<ItemDraft | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)

  async function refresh() {
    const response = await fetch(
      `/api/items?locationId=${encodeURIComponent(locationId)}`,
    )
    const payload = (await response.json()) as {
      items?: ItemMasterItem[]
      error?: string
    }
    if (!response.ok)
      throw new Error(payload.error ?? 'Items could not be loaded.')
    setItems(payload.items ?? [])
  }

  function startEditing(item: ItemMasterItem) {
    setEditingId(item.id)
    setDraft(draftFor(item))
    setMessage(null)
  }

  function cancelEditing() {
    setEditingId(null)
    setDraft(null)
  }

  async function saveItem(
    event: React.FormEvent<HTMLFormElement>,
    itemId: string,
  ) {
    event.preventDefault()
    if (!draft) return
    setBusyId(itemId)
    setMessage(null)

    try {
      const response = await fetch(
        `/api/items/${encodeURIComponent(itemId)}?locationId=${encodeURIComponent(locationId)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            displayName: draft.displayName,
            category: toNullableText(draft.category ?? ''),
            unit: draft.unit,
            shelfLifeDays: draft.shelfLifeDays,
            costPerUnit: toNullableText(draft.costPerUnit ?? ''),
          }),
        },
      )
      const payload = (await response.json()) as { error?: string }
      if (!response.ok)
        throw new Error(payload.error ?? 'Item could not be saved.')
      await refresh()
      cancelEditing()
      setMessage(
        'Item saved. Future calculations will use the new assumptions; historical spoilage stays as recorded.',
      )
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Item could not be saved.',
      )
    } finally {
      setBusyId(null)
    }
  }

  async function toggleActive(item: ItemMasterItem) {
    setBusyId(item.id)
    setMessage(null)
    try {
      const response = await fetch(
        `/api/items/${encodeURIComponent(item.id)}?locationId=${encodeURIComponent(locationId)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ isActive: !item.isActive }),
        },
      )
      const payload = (await response.json()) as { error?: string }
      if (!response.ok)
        throw new Error(payload.error ?? 'Item status could not be changed.')
      await refresh()
      setMessage(item.isActive ? 'Item archived.' : 'Item restored.')
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Item status could not be changed.',
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card className="item-master-card">
      <CardHeader>
        <CardTitle>Menu items and ingredients</CardTitle>
        <CardDescription>
          Correct the assumptions PantryIQ uses for this location. Canonical
          names stay locked so imports remain auditable.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="item-master-note">
          Changes apply to future calculations. Historical spoilage will not
          move unless you ask PantryIQ to recalculate it from Chat or the
          Dashboard.
        </p>
        {message ? (
          <p className="settings-status" role="status">
            {message}
          </p>
        ) : null}
        {items.length === 0 ? (
          <p className="item-master-empty">
            No items yet. Import a CSV to create the first canonical items for
            this location.
          </p>
        ) : (
          <div className="item-master-table-wrap" tabIndex={0}>
            <table className="item-master-table">
              <caption className="sr-only">
                Canonical items for this location
              </caption>
              <thead>
                <tr>
                  <th scope="col">Display name</th>
                  <th scope="col">Canonical name</th>
                  <th scope="col">Category</th>
                  <th scope="col">Unit</th>
                  <th scope="col">Shelf life</th>
                  <th scope="col">Cost / unit</th>
                  <th scope="col">Usage</th>
                  <th scope="col">Active</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isEditing = editingId === item.id && draft !== null
                  const busy = busyId === item.id
                  return (
                    <tr
                      className={
                        !item.isActive ? 'item-master-row--inactive' : undefined
                      }
                      key={item.id}
                    >
                      <td>
                        {isEditing ? (
                          <Label
                            className="sr-only"
                            htmlFor={`item-name-${item.id}`}
                          >
                            Display name for {item.canonicalName}
                          </Label>
                        ) : null}
                        {isEditing ? (
                          <Input
                            id={`item-name-${item.id}`}
                            value={draft.displayName}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                displayName: event.target.value,
                              })
                            }
                          />
                        ) : (
                          <strong>{item.displayName}</strong>
                        )}
                        <small>Your value</small>
                        <small>
                          {item.itemType === 'menu_item'
                            ? 'Menu item'
                            : 'Ingredient'}
                        </small>
                      </td>
                      <td>
                        <code>{item.canonicalName}</code>
                        <small>System-managed</small>
                      </td>
                      <td>
                        {isEditing ? (
                          <Input
                            aria-label={`Category for ${item.displayName}`}
                            value={draft.category ?? ''}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                category: event.target.value,
                              })
                            }
                          />
                        ) : (
                          <>
                            {item.category ?? '—'}
                            <small>{sourceLabel(item.category)}</small>
                          </>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <Input
                            aria-label={`Unit for ${item.displayName}`}
                            value={draft.unit}
                            onChange={(event) =>
                              setDraft({ ...draft, unit: event.target.value })
                            }
                          />
                        ) : (
                          <>
                            {item.unit}
                            <small>Your value</small>
                          </>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <Input
                            aria-label={`Shelf life in days for ${item.displayName}`}
                            min="0"
                            step="1"
                            type="number"
                            value={draft.shelfLifeDays ?? ''}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                shelfLifeDays: event.target.value
                                  ? Number(event.target.value)
                                  : null,
                              })
                            }
                          />
                        ) : (
                          <>
                            {item.shelfLifeDays === null
                              ? '—'
                              : `${item.shelfLifeDays} days`}
                            <small>{sourceLabel(item.shelfLifeDays)}</small>
                          </>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <Input
                            aria-label={`Cost per unit for ${item.displayName}`}
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            type="number"
                            value={draft.costPerUnit ?? ''}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                costPerUnit: event.target.value,
                              })
                            }
                          />
                        ) : (
                          <>
                            {item.costPerUnit === null
                              ? '—'
                              : `$${item.costPerUnit}`}
                            <small>{sourceLabel(item.costPerUnit)}</small>
                          </>
                        )}
                      </td>
                      <td>
                        <span className="figure">{item.usageCount}</span>
                        <small>Imported references</small>
                      </td>
                      <td>
                        <Switch
                          aria-label={`${item.isActive ? 'Archive' : 'Restore'} ${item.displayName}`}
                          checked={item.isActive}
                          disabled={busy}
                          onCheckedChange={() => void toggleActive(item)}
                        />
                        <small>Your setting</small>
                      </td>
                      <td>
                        {isEditing ? (
                          <form
                            className="item-master-actions"
                            onSubmit={(event) => void saveItem(event, item.id)}
                          >
                            <Button disabled={busy} size="sm" type="submit">
                              Save
                            </Button>
                            <Button
                              disabled={busy}
                              onClick={cancelEditing}
                              size="sm"
                              type="button"
                              variant="secondary"
                            >
                              Cancel
                            </Button>
                          </form>
                        ) : (
                          <Button
                            disabled={busy}
                            onClick={() => startEditing(item)}
                            size="sm"
                            type="button"
                            variant="secondary"
                          >
                            Edit
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
