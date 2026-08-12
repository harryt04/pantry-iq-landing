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

  test('recalculates an assumption and carries it into the conversation', async ({
    page,
    mockApi,
  }) => {
    await page.goto(`/chat?locationId=${fullYearLocationFixture.locationId}`)
    await mockApi({ chat: 'ok', chatOverride: 'ok' })

    await page.getByText('Question an assumption').click()
    await page.getByLabel('New shelf life (days)').fill('5')

    const overrideRequest = page.waitForRequest(
      (request) =>
        request.url().endsWith('/api/chat/override') &&
        request.method() === 'POST',
    )
    await page.getByRole('button', { name: 'Recalculate' }).click()
    const overrideBody = (await (await overrideRequest).postDataJSON()) as {
      field: string
      locationId: string
      value: string
    }
    expect(overrideBody).toMatchObject({
      field: 'shelfLifeDays',
      locationId: fullYearLocationFixture.locationId,
      value: '5',
    })

    const comparison = page.locator('.chat-override__comparison')
    await expect(comparison).toContainText('Shelf life (days): not set → 5')
    await expect(comparison).toContainText(
      'How should PantryIQ use this change? Nothing has been saved yet.',
    )

    await comparison
      .getByRole('button', { name: 'This conversation only' })
      .click()
    await expect(comparison).toContainText(
      'Salmon uses shelf life (days) 5 for this conversation.',
    )

    await page
      .getByRole('textbox', { name: /Ask a question about/ })
      .fill('What changes if the shelf life is five days?')
    const chatRequest = page.waitForRequest(
      (request) =>
        request.url().endsWith('/api/chat') && request.method() === 'POST',
    )
    await page.getByRole('button', { name: 'Send question' }).click()
    const chatBody = (await (await chatRequest).postDataJSON()) as {
      overrides: Array<{ field: string; itemId: string; value: number }>
    }
    expect(chatBody.overrides).toEqual([
      {
        field: 'shelfLifeDays',
        itemId: '00000000-0000-4000-8000-000000000002',
        value: 5,
      },
    ])
  })
})

test.describe('chat failure paths', () => {
  for (const scenario of [
    {
      outcome: 'server-error' as const,
      message: 'Something went wrong. Try again.',
      label: '500 server error',
    },
    {
      outcome: 'unavailable' as const,
      message: 'This service is temporarily unavailable.',
      label: '503 service unavailable',
    },
  ]) {
    test(`${scenario.label} keeps the submitted question visible`, async ({
      page,
      mockApi,
    }) => {
      await page.goto(`/chat?locationId=${fullYearLocationFixture.locationId}`)
      await mockApi({ chat: scenario.outcome })

      const question = `Why did the ${scenario.label} happen?`
      await page
        .getByRole('textbox', { name: /Ask a question about/ })
        .fill(question)
      await page.getByRole('button', { name: 'Send question' }).click()

      await expect(
        page.getByRole('article', { name: 'Your message' }),
      ).toContainText(question)
      await expect(
        page.getByRole('article', { name: 'PantryIQ message' }),
      ).toContainText(scenario.message)
    })
  }
})
