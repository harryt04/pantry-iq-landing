export type LocationCreateInput = {
  name: string
  address?: string | null
}

export type LocationUpdateInput = Partial<LocationCreateInput> & {
  isActive?: boolean
}

export class LocationValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LocationValidationError'
  }
}

function recordInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new LocationValidationError('A location object is required.')
  }

  return input as Record<string, unknown>
}

function requiredName(input: Record<string, unknown>): string {
  const value = input.name
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new LocationValidationError('Add a name for this location.')
  }

  const name = value.trim()
  if (name.length > 120) {
    throw new LocationValidationError(
      'Location names must be 120 characters or fewer.',
    )
  }
  return name
}

function optionalAddress(
  input: Record<string, unknown>,
): string | null | undefined {
  if (!('address' in input)) return undefined
  const value = input.address
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') {
    throw new LocationValidationError('Address must be text.')
  }

  const address = value.trim()
  if (address.length > 240) {
    throw new LocationValidationError(
      'Addresses must be 240 characters or fewer.',
    )
  }
  return address || null
}

export function validateLocationCreateInput(
  input: unknown,
): LocationCreateInput {
  const values = recordInput(input)
  const location: LocationCreateInput = { name: requiredName(values) }
  const address = optionalAddress(values)
  if (address !== undefined) location.address = address
  return location
}

export function validateLocationUpdateInput(
  input: unknown,
): LocationUpdateInput {
  const values = recordInput(input)
  const update: LocationUpdateInput = {}

  if ('name' in values) update.name = requiredName(values)
  const address = optionalAddress(values)
  if (address !== undefined) update.address = address
  if ('isActive' in values) {
    if (typeof values.isActive !== 'boolean') {
      throw new LocationValidationError('isActive must be boolean.')
    }
    update.isActive = values.isActive
  }

  if (Object.keys(update).length === 0) {
    throw new LocationValidationError('Add a location detail to update.')
  }
  return update
}
