import { afterEach } from 'vitest'

/**
 * Setup for the `*.dom.test.tsx` suites, which run under jsdom.
 *
 * Node-environment suites load this file too, so every import is lazy and
 * guarded: nothing here may assume a `document` exists.
 */

const hasDom = typeof document !== 'undefined'

if (hasDom) {
  const [{ cleanup, configure }, matchersModule] = await Promise.all([
    import('@testing-library/react'),
    import('@testing-library/jest-dom/matchers'),
  ])
  const { expect } = await import('vitest')

  // v8 coverage instrumentation slows rendering enough that the default
  // 1000ms findBy*/waitFor timeout flakes under `vitest run --coverage`.
  configure({ asyncUtilTimeout: 5000 })
  // The CJS/ESM interop wraps the matchers behind `default` in some resolvers;
  // unwrap it so `expect.extend` receives the flat matcher map either way.
  // The ambient types in tests/setup/jest-dom.d.ts (the package's own vitest
  // shim) declare these matchers on vitest's Assertion interface, so callers
  // get toBeInTheDocument()/toHaveValue()/etc. without a per-file import.
  const matchers = (
    'default' in matchersModule ? matchersModule.default : matchersModule
  ) as Parameters<typeof expect.extend>[0]
  expect.extend(matchers)

  // jsdom implements neither of these, and several components call them on
  // mount to pick a responsive surface or scroll a transcript.
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }

  afterEach(() => {
    cleanup()
  })
}
