import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * A text test about text, which is the one case where reading a file as a
 * string is the right tool: the guarantee under test is that two configuration
 * documents agree with each other.
 *
 * Keep the local command and workflow honest: a green local run should cover
 * every test stage that the workflow runs, including coverage.
 */

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { scripts: Record<string, string> }

const workflow = readFileSync(
  new URL('../.github/workflows/ci.yml', import.meta.url),
  'utf8',
)

/** Every `run: pnpm <script>` in the workflow, in order. */
function workflowScripts(): string[] {
  return [...workflow.matchAll(/run:\s*pnpm\s+([\w:-]+)/g)]
    .map((match) => match[1])
    .filter((script): script is string => script !== undefined)
}

/** Expands `pnpm ci` transitively into the leaf scripts it ends up running. */
function expandScript(name: string, seen = new Set<string>()): string[] {
  if (seen.has(name)) return []
  seen.add(name)

  const body = packageJson.scripts[name]
  if (body === undefined) return [name]

  const delegated = [...body.matchAll(/pnpm\s+([\w:-]+)/g)]
    .map((match) => match[1])
    .filter((script): script is string => script !== undefined)

  if (delegated.length === 0) return [name]
  return delegated.flatMap((script) => expandScript(script, seen))
}

describe('CI parity', () => {
  it('runs every workflow test stage from the ci script', () => {
    const local = new Set(expandScript('ci'))
    const testStages = workflowScripts().filter(
      (script) => script.startsWith('test') || script.startsWith('ci:'),
    )

    const missing = testStages
      .flatMap((script) => expandScript(script))
      .filter((script) => !local.has(script))

    expect(
      missing,
      'The workflow runs these but `pnpm ci` does not. Add them to a ci:* script.',
    ).toEqual([])
  })

  it('keeps every suite reachable from the ci script', () => {
    const local = expandScript('ci')
    expect(local).toContain('test')
    expect(local).toContain('test:integration')
    expect(local).toContain('test:a11y')
    expect(local).toContain('test:charts')
    expect(local).toContain('test:e2e')
    expect(local).toContain('test:coverage')
    expect(local).toContain('build')
  })

  it('requires a real database for integration tests in CI', () => {
    expect(workflow).toMatch(/REQUIRE_INTEGRATION_DB:\s*'?1'?/)
  })
})
