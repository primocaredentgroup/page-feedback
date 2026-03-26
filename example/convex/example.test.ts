import { describe, expect, test } from 'vitest'
import { initConvexTest } from './setup.test'
import { api } from './_generated/api'

describe('example', () => {
  test('upsertPageFeedback and getMyPageFeedback', async () => {
    const t = initConvexTest()
    const url = 'https://app.example.com/home?tab=overview'

    const createdFeedback = await t.mutation(api.example.upsertPageFeedback, {
      url,
      rating: 3,
      note: 'Good start',
    })

    const latestFeedback = await t.query(api.example.getMyPageFeedback, { url })
    const pageFeedback = await t.query(api.example.listPageFeedback, {
      url,
      limit: 10,
    })

    expect(createdFeedback.version).toBe(1)
    expect(latestFeedback?.normalizedUrl).toBe('https://app.example.com/home')
    expect(pageFeedback).toHaveLength(1)
    expect(pageFeedback[0].note).toBe('Good start')
  })
})
