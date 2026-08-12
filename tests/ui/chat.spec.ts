import { expect, test } from './fixtures/mock-api'

import { fullYearLocationFixture } from '../fixtures/pantry'

test.describe('chat happy path', () => {
  test('renders a grounded answer with evidence and stated limits', async ({
    page,
    mockApi,
  }) => {
    await page.goto(`/chat?locationId=${fullYearLocationFixture.locationId}`)
    await mockApi({ chat: 'ok' })

    await expect(
      page.getByRole('heading', { name: 'Ask about your operation.' }),
    ).toBeVisible()
    await page
      .getByRole('textbox', { name: /Ask a question about/ })
      .fill('What is costing me the most right now?')
    await page.getByRole('button', { name: 'Send question' }).click()

    const answer = page.getByRole('article', { name: 'PantryIQ message' })
    for (const heading of [
      'Observation',
      'Financial impact',
      'Recommendation',
    ]) {
      await expect(answer.getByRole('heading', { name: heading })).toBeVisible()
    }
    await expect(answer).toContainText(
      'Not provided. The available history earns an observation, not a prediction.',
    )
    await expect(answer.getByLabel('Chat evidence')).toBeVisible()
    const evidenceTrigger = answer
      .getByRole('button', {
        name: 'Show your work',
      })
      .first()
    await expect(evidenceTrigger).toBeVisible()
    await evidenceTrigger.click()
    for (const heading of ['Sources', 'Calculations', 'Assumptions']) {
      await expect(answer.getByRole('heading', { name: heading })).toBeVisible()
    }
  })
})
