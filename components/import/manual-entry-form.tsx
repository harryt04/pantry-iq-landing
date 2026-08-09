'use client'

import * as React from 'react'

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'

type Item = {
  id: string
  displayName: string
  canonicalName: string
  category: string | null
  unit: string
  isActive: boolean
}

type ItemSelection =
  | { itemId: string; newItem?: never }
  | {
      itemId?: never
      newItem: {
        canonicalName: string
        displayName: string
        category: string | null
        unit: string
      }
    }

type NewItem = {
  canonicalName: string
  displayName: string
  category: string | null
  unit: string
}

type EntryType = 'inventory' | 'purchase_order' | 'transaction' | 'labor'

type Line = {
  item: ItemSelection | null
  quantity: string
  unitCost: string
  totalCost: string
}

const CREATE_NEW = 'create-new'

function localDateTime() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 16)
}

function asIso(value: string) {
  return new Date(value).toISOString()
}

function ManualItemCombobox({
  id,
  items,
  selection,
  onChange,
}: {
  id: string
  items: readonly Item[]
  selection: ItemSelection | null
  onChange: (selection: ItemSelection) => void
}) {
  const options = [
    ...items
      .filter((item) => item.isActive)
      .map((item) => ({
        value: item.id,
        label: item.displayName,
        detail: item.unit,
      })),
    { value: CREATE_NEW, label: 'Create a new item', detail: '' },
  ]
  const selectedValue = selection?.itemId ?? CREATE_NEW
  const selectedOption = selection?.itemId
    ? options.find((option) => option.value === selection.itemId)
    : null

  return (
    <Combobox
      value={selectedOption ?? null}
      onValueChange={(value) => {
        if (!value || typeof value !== 'object') return
        const option = value as (typeof options)[number]
        if (option.value === CREATE_NEW) {
          onChange({
            newItem: {
              canonicalName: '',
              displayName: '',
              category: null,
              unit: 'each',
            },
          })
        } else {
          onChange({ itemId: option.value })
        }
      }}
      itemToStringLabel={(value) =>
        typeof value === 'object' && value !== null && 'label' in value
          ? String(value.label)
          : ''
      }
      itemToStringValue={(value) =>
        typeof value === 'object' && value !== null && 'value' in value
          ? String(value.value)
          : ''
      }
      autoHighlight
    >
      <ComboboxInput
        id={id}
        aria-label="Item"
        placeholder="Search item names"
        showClear={false}
      />
      <ComboboxContent>
        <ComboboxList>
          {options.map((option, index) => (
            <ComboboxItem key={option.value} value={option} index={index}>
              <span>{option.label}</span>
              {option.detail ? <span>{option.detail}</span> : null}
            </ComboboxItem>
          ))}
          <ComboboxEmpty>No matching items.</ComboboxEmpty>
        </ComboboxList>
      </ComboboxContent>
      <input type="hidden" name={`${id}-selected`} value={selectedValue} />
    </Combobox>
  )
}

function NewItemFields({
  id,
  selection,
  onChange,
}: {
  id: string
  selection: ItemSelection | null
  onChange: (selection: ItemSelection) => void
}) {
  if (!selection?.newItem) return null
  const update = (field: keyof NewItem, value: string) =>
    onChange({
      newItem: {
        ...selection.newItem,
        [field]: field === 'category' ? value || null : value,
      },
    })
  return (
    <div className="app-page__form-row">
      <Label htmlFor={`${id}-name`}>New item name</Label>
      <Input
        id={`${id}-name`}
        value={selection.newItem.displayName}
        onChange={(event) => {
          onChange({
            newItem: {
              ...selection.newItem,
              displayName: event.target.value,
              canonicalName: event.target.value,
            },
          })
        }}
        required
      />
      <Label htmlFor={`${id}-unit`}>Unit</Label>
      <Input
        id={`${id}-unit`}
        value={selection.newItem.unit}
        onChange={(event) => update('unit', event.target.value)}
        required
      />
      <Label htmlFor={`${id}-category`}>Category (optional)</Label>
      <Input
        id={`${id}-category`}
        value={selection.newItem.category ?? ''}
        onChange={(event) => update('category', event.target.value)}
      />
    </div>
  )
}

function ItemField({
  id,
  label,
  items,
  selection,
  onChange,
}: {
  id: string
  label: string
  items: readonly Item[]
  selection: ItemSelection | null
  onChange: (selection: ItemSelection) => void
}) {
  return (
    <div className="app-page__form-row">
      <Label htmlFor={id}>{label}</Label>
      <ManualItemCombobox
        id={id}
        items={items}
        selection={selection}
        onChange={onChange}
      />
      <NewItemFields id={id} selection={selection} onChange={onChange} />
    </div>
  )
}

export function ManualEntryForm({ locationId }: { locationId: string }) {
  const [items, setItems] = React.useState<Item[]>([])
  const [entryType, setEntryType] = React.useState<EntryType>('inventory')
  const [item, setItem] = React.useState<ItemSelection | null>(null)
  const [countedAt, setCountedAt] = React.useState(localDateTime)
  const [transactedAt, setTransactedAt] = React.useState(localDateTime)
  const [orderedAt, setOrderedAt] = React.useState(localDateTime)
  const [receivedAt, setReceivedAt] = React.useState('')
  const [shiftStart, setShiftStart] = React.useState(localDateTime)
  const [shiftEnd, setShiftEnd] = React.useState('')
  const [employeeReference, setEmployeeReference] = React.useState('')
  const [role, setRole] = React.useState('')
  const [scheduledHours, setScheduledHours] = React.useState('')
  const [actualHours, setActualHours] = React.useState('')
  const [laborCost, setLaborCost] = React.useState('')
  const [quantity, setQuantity] = React.useState('')
  const [unitPrice, setUnitPrice] = React.useState('')
  const [totalRevenue, setTotalRevenue] = React.useState('')
  const [totalCost, setTotalCost] = React.useState('')
  const [supplierName, setSupplierName] = React.useState('')
  const [lines, setLines] = React.useState<Line[]>([
    { item: null, quantity: '', unitCost: '', totalCost: '' },
  ])
  const [status, setStatus] = React.useState('')
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    void fetch(`/api/items?locationId=${encodeURIComponent(locationId)}`)
      .then(async (response) => {
        const result = (await response.json()) as {
          items?: Item[]
          error?: string
        }
        if (!response.ok)
          throw new Error(result.error ?? 'Items are unavailable.')
        if (!cancelled) setItems(result.items ?? [])
      })
      .catch((loadError) => {
        if (!cancelled)
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Items are unavailable.',
          )
      })
    return () => {
      cancelled = true
    }
  }, [locationId])

  function reset() {
    setItem(null)
    setQuantity('')
    setUnitPrice('')
    setTotalRevenue('')
    setTotalCost('')
    setSupplierName('')
    setShiftStart(localDateTime())
    setShiftEnd('')
    setEmployeeReference('')
    setRole('')
    setScheduledHours('')
    setActualHours('')
    setLaborCost('')
    setLines([{ item: null, quantity: '', unitCost: '', totalCost: '' }])
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setStatus('')
    setBusy(true)
    const payload =
      entryType === 'inventory'
        ? { entryType, countedAt: asIso(countedAt), item, quantity }
        : entryType === 'transaction'
          ? {
              entryType,
              transactedAt: asIso(transactedAt),
              item,
              quantity,
              unitPrice,
              totalRevenue,
              totalCost: totalCost || null,
            }
          : entryType === 'labor'
            ? {
                entryType,
                shiftStart: asIso(shiftStart),
                shiftEnd: shiftEnd ? asIso(shiftEnd) : null,
                employeeReference: employeeReference || null,
                role,
                scheduledHours: scheduledHours || null,
                actualHours: actualHours || null,
                laborCost: laborCost || null,
              }
            : {
                entryType,
                orderedAt: asIso(orderedAt),
                receivedAt: receivedAt ? asIso(receivedAt) : null,
                supplierName: supplierName || null,
                lines,
              }
    try {
      const response = await fetch(
        `/api/manual-entry?locationId=${encodeURIComponent(locationId)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const result = (await response.json()) as {
        result?: { rowsImported: number }
        error?: string
      }
      if (!response.ok || !result.result)
        throw new Error(result.error ?? 'The manual entry could not be saved.')
      setStatus(
        `${result.result.rowsImported.toLocaleString()} row${result.result.rowsImported === 1 ? '' : 's'} saved. It is in import history.`,
      )
      reset()
      window.dispatchEvent(new Event('pantryiq-import-complete'))
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'The manual entry could not be saved. Nothing was changed.',
      )
    } finally {
      setBusy(false)
    }
  }

  function updateLine(index: number, update: Partial<Line>) {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...update } : line,
      ),
    )
  }

  return (
    <section className="manual-entry" aria-labelledby="manual-entry-title">
      <p className="app-page__eyebrow">Manual entry</p>
      <h2 id="manual-entry-title">Record what happened today.</h2>
      <p className="app-page__help">
        These records use the same data tables as a CSV import. Historical rows
        cannot be edited after they are saved.
      </p>
      <form className="app-page__form" onSubmit={submit}>
        <div className="app-page__form-row">
          <Label htmlFor="manual-entry-type">What are you recording?</Label>
          <NativeSelect
            id="manual-entry-type"
            value={entryType}
            onChange={(event) => {
              setEntryType(event.target.value as EntryType)
              reset()
            }}
            disabled={busy}
          >
            <option value="inventory">Inventory count</option>
            <option value="purchase_order">Purchase order</option>
            <option value="transaction">Transaction</option>
            <option value="labor">Labor shift</option>
          </NativeSelect>
        </div>

        {entryType === 'inventory' ? (
          <>
            <ItemField
              id="inventory-item"
              label="Item"
              items={items}
              selection={item}
              onChange={setItem}
            />
            <div className="app-page__form-row">
              <Label htmlFor="inventory-counted-at">
                Counted at (your local time)
              </Label>
              <Input
                id="inventory-counted-at"
                type="datetime-local"
                value={countedAt}
                onChange={(event) => setCountedAt(event.target.value)}
                required
              />
            </div>
            <div className="app-page__form-row">
              <Label htmlFor="inventory-quantity">Quantity on hand</Label>
              <Input
                id="inventory-quantity"
                inputMode="decimal"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
              />
            </div>
          </>
        ) : null}

        {entryType === 'transaction' ? (
          <>
            <ItemField
              id="transaction-item"
              label="Menu item"
              items={items}
              selection={item}
              onChange={setItem}
            />
            <div className="app-page__form-row">
              <Label htmlFor="transaction-time">
                Sold at (your local time)
              </Label>
              <Input
                id="transaction-time"
                type="datetime-local"
                value={transactedAt}
                onChange={(event) => setTransactedAt(event.target.value)}
                required
              />
              <Label htmlFor="transaction-quantity">Quantity sold</Label>
              <Input
                id="transaction-quantity"
                inputMode="decimal"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
              />
              <Label htmlFor="transaction-unit-price">Unit price</Label>
              <Input
                id="transaction-unit-price"
                inputMode="decimal"
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
                required
              />
              <Label htmlFor="transaction-revenue">Total revenue</Label>
              <Input
                id="transaction-revenue"
                inputMode="decimal"
                value={totalRevenue}
                onChange={(event) => setTotalRevenue(event.target.value)}
                required
              />
              <Label htmlFor="transaction-cost">Total cost (optional)</Label>
              <Input
                id="transaction-cost"
                inputMode="decimal"
                value={totalCost}
                onChange={(event) => setTotalCost(event.target.value)}
              />
            </div>
          </>
        ) : null}

        {entryType === 'labor' ? (
          <>
            <div className="app-page__form-row">
              <Label htmlFor="labor-shift-start">
                Shift starts (your local time)
              </Label>
              <Input
                id="labor-shift-start"
                type="datetime-local"
                value={shiftStart}
                onChange={(event) => setShiftStart(event.target.value)}
                required
              />
              <Label htmlFor="labor-shift-end">Shift ends (optional)</Label>
              <Input
                id="labor-shift-end"
                type="datetime-local"
                value={shiftEnd}
                onChange={(event) => setShiftEnd(event.target.value)}
              />
              <Label htmlFor="labor-role">Role</Label>
              <Input
                id="labor-role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                placeholder="Line cook"
                required
              />
              <Label htmlFor="labor-employee-reference">
                Employee reference (optional)
              </Label>
              <Input
                id="labor-employee-reference"
                value={employeeReference}
                onChange={(event) => setEmployeeReference(event.target.value)}
                placeholder="Internal code only — no names or contact details"
              />
            </div>
            <div className="app-page__form-row">
              <Label htmlFor="labor-scheduled-hours">
                Scheduled hours (optional)
              </Label>
              <Input
                id="labor-scheduled-hours"
                inputMode="decimal"
                value={scheduledHours}
                onChange={(event) => setScheduledHours(event.target.value)}
              />
              <Label htmlFor="labor-actual-hours">
                Actual hours (optional)
              </Label>
              <Input
                id="labor-actual-hours"
                inputMode="decimal"
                value={actualHours}
                onChange={(event) => setActualHours(event.target.value)}
              />
              <Label htmlFor="labor-cost">Labor cost (optional)</Label>
              <Input
                id="labor-cost"
                inputMode="decimal"
                value={laborCost}
                onChange={(event) => setLaborCost(event.target.value)}
              />
              <p className="app-page__help">
                Add scheduled hours, actual hours, or both. PantryIQ stores the
                role and an optional internal reference, not personal details.
              </p>
            </div>
          </>
        ) : null}

        {entryType === 'purchase_order' ? (
          <>
            <div className="app-page__form-row">
              <Label htmlFor="purchase-ordered-at">
                Ordered at (your local time)
              </Label>
              <Input
                id="purchase-ordered-at"
                type="datetime-local"
                value={orderedAt}
                onChange={(event) => setOrderedAt(event.target.value)}
                required
              />
              <Label htmlFor="purchase-received-at">
                Received at (optional)
              </Label>
              <Input
                id="purchase-received-at"
                type="datetime-local"
                value={receivedAt}
                onChange={(event) => setReceivedAt(event.target.value)}
              />
              <Label htmlFor="purchase-supplier">Supplier (optional)</Label>
              <Input
                id="purchase-supplier"
                value={supplierName}
                onChange={(event) => setSupplierName(event.target.value)}
              />
            </div>
            {lines.map((line, index) => (
              <fieldset className="app-page__form-row" key={index}>
                <legend>Line {index + 1}</legend>
                <ItemField
                  id={`purchase-item-${index}`}
                  label="Item"
                  items={items}
                  selection={line.item}
                  onChange={(value) => updateLine(index, { item: value })}
                />
                <Label htmlFor={`purchase-quantity-${index}`}>Quantity</Label>
                <Input
                  id={`purchase-quantity-${index}`}
                  inputMode="decimal"
                  value={line.quantity}
                  onChange={(event) =>
                    updateLine(index, { quantity: event.target.value })
                  }
                  required
                />
                <Label htmlFor={`purchase-unit-cost-${index}`}>Unit cost</Label>
                <Input
                  id={`purchase-unit-cost-${index}`}
                  inputMode="decimal"
                  value={line.unitCost}
                  onChange={(event) =>
                    updateLine(index, { unitCost: event.target.value })
                  }
                  required
                />
                <Label htmlFor={`purchase-total-cost-${index}`}>
                  Total cost
                </Label>
                <Input
                  id={`purchase-total-cost-${index}`}
                  inputMode="decimal"
                  value={line.totalCost}
                  onChange={(event) =>
                    updateLine(index, { totalCost: event.target.value })
                  }
                  required
                />
                {lines.length > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setLines((current) =>
                        current.filter((_, lineIndex) => lineIndex !== index),
                      )
                    }
                  >
                    Remove line
                  </Button>
                ) : null}
              </fieldset>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  { item: null, quantity: '', unitCost: '', totalCost: '' },
                ])
              }
            >
              Add line
            </Button>
          </>
        ) : null}

        {error ? (
          <p className="app-page__error" role="alert">
            {error}
          </p>
        ) : null}
        {status ? (
          <p className="app-page__success" role="status">
            {status}
          </p>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save manual entry'}
        </Button>
      </form>
    </section>
  )
}
