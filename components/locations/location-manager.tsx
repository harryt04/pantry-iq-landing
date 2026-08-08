'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Location = {
  id: string
  name: string
  address: string | null
  isActive: boolean
  createdAt: string
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
  }).format(new Date(value))
}

export function LocationManager() {
  const [locations, setLocations] = React.useState<Location[]>([])
  const [name, setName] = React.useState('')
  const [address, setAddress] = React.useState('')
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editingName, setEditingName] = React.useState('')
  const [editingAddress, setEditingAddress] = React.useState('')
  const [confirmingArchiveId, setConfirmingArchiveId] = React.useState<
    string | null
  >(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

  async function loadLocations() {
    const response = await fetch('/api/locations')
    const payload = (await response.json()) as {
      locations?: Location[]
      error?: string
    }
    if (!response.ok)
      throw new Error(payload.error ?? 'Locations could not be loaded.')
    setLocations(payload.locations ?? [])
  }

  React.useEffect(() => {
    void loadLocations()
      .catch((error: unknown) => {
        setMessage(
          error instanceof Error
            ? error.message
            : 'Locations could not be loaded.',
        )
      })
      .finally(() => setLoading(false))
  }, [])

  async function saveLocation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch(
        editingId ? `/api/locations/${editingId}` : '/api/locations',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: editingId ? editingName : name,
            address: editingId ? editingAddress : address,
          }),
        },
      )
      const payload = (await response.json()) as { error?: string }
      if (!response.ok)
        throw new Error(payload.error ?? 'Location could not be saved.')
      await loadLocations()
      if (editingId) {
        setEditingId(null)
        setMessage('Location updated.')
      } else {
        setName('')
        setAddress('')
        setMessage('Location added. You can import data when you are ready.')
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Location could not be saved.',
      )
    } finally {
      setSaving(false)
    }
  }

  function startEditing(location: Location) {
    setEditingId(location.id)
    setEditingName(location.name)
    setEditingAddress(location.address ?? '')
    setMessage(null)
  }

  function cancelEditing() {
    setEditingId(null)
    setMessage(null)
  }

  async function archiveLocation(location: Location) {
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/locations/${location.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive: !location.isActive }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok)
        throw new Error(payload.error ?? 'Location could not be updated.')
      await loadLocations()
      setConfirmingArchiveId(null)
      setMessage(
        location.isActive ? 'Location archived.' : 'Location restored.',
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Location could not be updated.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <section className="locations-card" aria-busy="true">
        <div className="locations-skeleton" />
        <div className="locations-skeleton locations-skeleton--short" />
      </section>
    )
  }

  return (
    <div className="locations-layout">
      <Card>
        <CardHeader>
          <CardTitle>
            {editingId ? 'Edit location' : 'Add a location'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="location-form" onSubmit={saveLocation}>
            <div className="location-field">
              <Label
                htmlFor={editingId ? 'edit-location-name' : 'location-name'}
              >
                Location name
              </Label>
              <Input
                id={editingId ? 'edit-location-name' : 'location-name'}
                value={editingId ? editingName : name}
                onChange={(event) =>
                  editingId
                    ? setEditingName(event.target.value)
                    : setName(event.target.value)
                }
                placeholder="Downtown"
                maxLength={120}
                required
              />
            </div>
            <div className="location-field">
              <Label
                htmlFor={
                  editingId ? 'edit-location-address' : 'location-address'
                }
              >
                Address <span className="location-optional">Optional</span>
              </Label>
              <Input
                id={editingId ? 'edit-location-address' : 'location-address'}
                value={editingId ? editingAddress : address}
                onChange={(event) =>
                  editingId
                    ? setEditingAddress(event.target.value)
                    : setAddress(event.target.value)
                }
                placeholder="100 Main Street"
                maxLength={240}
              />
            </div>
            <div className="location-form-actions">
              <Button type="submit" disabled={saving}>
                {saving
                  ? 'Saving…'
                  : editingId
                    ? 'Save location'
                    : 'Add location'}
              </Button>
              {editingId ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={cancelEditing}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your locations</CardTitle>
        </CardHeader>
        <CardContent>
          {locations.length === 0 ? (
            <div className="location-empty">
              <p>Nothing to show yet.</p>
              <p>Add your first location to start bringing in sales data.</p>
            </div>
          ) : (
            <ul className="location-list">
              {locations.map((location) => (
                <li className="location-list-item" key={location.id}>
                  <div>
                    <h3>{location.name}</h3>
                    <p>{location.address ?? 'No address added'}</p>
                    <small>
                      Added{' '}
                      <span className="figure">
                        {formatDate(location.createdAt)}
                      </span>
                      {!location.isActive ? ' · Archived' : ''}
                    </small>
                  </div>
                  <div className="location-actions">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => startEditing(location)}
                      disabled={saving}
                    >
                      Edit location
                    </Button>
                    {confirmingArchiveId === location.id ? (
                      <>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => void archiveLocation(location)}
                          disabled={saving}
                        >
                          {location.isActive
                            ? 'Confirm archive'
                            : 'Confirm restore'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setConfirmingArchiveId(null)}
                          disabled={saving}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setConfirmingArchiveId(location.id)}
                        disabled={saving}
                      >
                        {location.isActive
                          ? 'Archive location'
                          : 'Restore location'}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {message ? (
        <p className="locations-message" role="status">
          {message}
        </p>
      ) : null}
    </div>
  )
}
