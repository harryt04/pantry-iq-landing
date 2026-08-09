'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import * as React from 'react'
import { Menu } from 'lucide-react'

import { SignOutButton } from '@/components/auth/sign-out-button'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

export type AppShellLocation = {
  id: string
  name: string
}

const navigation = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/chat', label: 'Chat' },
  { href: '/import', label: 'Import' },
  { href: '/usage', label: 'Usage' },
  { href: '/settings', label: 'Settings' },
]

function locationHref(path: string, locationId: string) {
  return `${path}?locationId=${encodeURIComponent(locationId)}`
}

function rememberLocation(locationId: string) {
  document.cookie = `pantryiq-location-id=${encodeURIComponent(locationId)}; path=/; max-age=31536000; samesite=lax`
  window.localStorage.setItem('pantryiq-location-id', locationId)
}

export function AppShell({
  children,
  locations,
  initialLocationId,
}: {
  children: React.ReactNode
  locations: AppShellLocation[]
  initialLocationId: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [selectedLocationId, setSelectedLocationId] =
    React.useState(initialLocationId)
  const selectedLocation = locations.find(
    (location) => location.id === selectedLocationId,
  )

  React.useEffect(() => {
    const queryLocationId = new URLSearchParams(window.location.search).get(
      'locationId',
    )
    const savedLocationId = window.localStorage.getItem('pantryiq-location-id')
    const nextLocationId = [queryLocationId, savedLocationId].find((id) =>
      locations.some((location) => location.id === id),
    )

    if (!nextLocationId) {
      const fallbackLocation = locations[0]
      if (!fallbackLocation || selectedLocationId === fallbackLocation.id)
        return
      setSelectedLocationId(fallbackLocation.id)
      rememberLocation(fallbackLocation.id)
      return
    }
    if (nextLocationId === selectedLocationId) return
    setSelectedLocationId(nextLocationId)
    rememberLocation(nextLocationId)
  }, [locations, selectedLocationId])

  function switchLocation(locationId: string) {
    if (!locations.some((location) => location.id === locationId)) return
    setSelectedLocationId(locationId)
    rememberLocation(locationId)

    const params = new URLSearchParams(window.location.search)
    params.set('locationId', locationId)
    router.replace(`${pathname}?${params.toString()}`)
  }

  function linkFor(path: string) {
    return locationHref(path, selectedLocationId)
  }

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__header-inner">
          <Link className="app-shell__wordmark" href={linkFor('/dashboard')}>
            PantryIQ
          </Link>

          <div className="app-shell__scope">
            <span className="app-shell__scope-label">Location</span>
            <Select value={selectedLocationId} onValueChange={switchLocation}>
              <SelectTrigger
                aria-label="Selected location"
                className="app-shell__location-select"
              >
                <SelectValue placeholder="Choose a location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <nav className="app-shell__nav" aria-label="Application navigation">
            {navigation.map((item) => (
              <Link
                className={
                  pathname === item.href
                    ? 'app-shell__nav-link app-shell__nav-link--active'
                    : 'app-shell__nav-link'
                }
                href={linkFor(item.href)}
                key={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="app-shell__account">
            <Link className="app-shell__account-link" href="/account">
              Account
            </Link>
            <SignOutButton />
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                aria-label="Open application navigation"
                className="app-shell__menu-trigger"
                size="icon"
                variant="outline"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="app-shell__mobile-sheet">
              <SheetHeader>
                <SheetTitle>PantryIQ</SheetTitle>
              </SheetHeader>
              <nav
                className="app-shell__mobile-nav"
                aria-label="Mobile application navigation"
              >
                {navigation.map((item) => (
                  <SheetClose asChild key={item.href}>
                    <Link
                      className="app-shell__mobile-nav-link"
                      href={linkFor(item.href)}
                    >
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
                <SheetClose asChild>
                  <Link className="app-shell__mobile-nav-link" href="/account">
                    Account
                  </Link>
                </SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>
      <div className="app-shell__selected-scope" aria-live="polite">
        Viewing <strong>{selectedLocation?.name ?? 'selected location'}</strong>
      </div>
      {children}
    </div>
  )
}
