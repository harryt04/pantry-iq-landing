'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type CreatedLocation = {
  id?: string
}

export function FirstLocationForm() {
  const router = useRouter()
  const [name, setName] = React.useState('')
  const [address, setAddress] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    setHydrated(true)
  }, [])

  async function createFirstLocation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, address }),
      })
      const payload = (await response.json()) as {
        location?: CreatedLocation
        error?: string
      }
      const locationId = payload.location?.id
      if (!response.ok || !locationId) {
        throw new Error(payload.error ?? 'Location could not be saved.')
      }

      document.cookie = `pantryiq-location-id=${encodeURIComponent(locationId)}; path=/; max-age=31536000; samesite=lax`
      window.localStorage.setItem('pantryiq-location-id', locationId)
      router.push(`/import?locationId=${encodeURIComponent(locationId)}`)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Location could not be saved.',
      )
      setSaving(false)
    }
  }

  return (
    <form
      className="first-session-location-form"
      onSubmit={createFirstLocation}
    >
      <div className="location-field">
        <Label htmlFor="first-location-name">Location name</Label>
        <Input
          id="first-location-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Downtown"
          maxLength={120}
          required
          autoFocus
        />
      </div>
      <div className="location-field">
        <Label htmlFor="first-location-address">
          Address <span className="location-optional">Optional</span>
        </Label>
        <Input
          id="first-location-address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="100 Main Street"
          maxLength={240}
        />
      </div>
      {error ? (
        <p className="locations-message locations-message--error" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={saving || !hydrated}>
        {saving ? 'Saving' : 'Add location'}
      </Button>
    </form>
  )
}
