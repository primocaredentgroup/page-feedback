/// <reference types="vite/client" />
import { expect, test, vi } from 'vitest'
import { convexTest } from 'convex-test'
import type { FunctionReturnType } from 'convex/server'
import { api, internal } from './_generated/api.js'
import schema from './schema.js'

const modules = import.meta.glob('./**/*.ts')

test('reaction facts preserve every user and legacy emoji ordering across 1105 rows', async () => {
  const t = convexTest(schema, modules)
  const feedback = await t.mutation(api.lib.upsertFeedback, {
    userId: 'author', url: 'https://example.test/reactions', rating: 3, note: 'Good',
  })
  const { comment } = await t.mutation(api.lib.addComment, {
    userId: 'author', threadId: feedback.threadId, body: 'Many reactions',
  })
  for (let start = 0; start < 1105; start += 100) {
    await t.run(async ctx => {
      for (let index = start; index < Math.min(start + 100, 1105); index++) {
        await ctx.db.insert('feedbackReactions', {
          commentId: comment._id,
          userId: `user_${index}`,
          emoji: index % 2 ? '👍' : '👀',
          createdAt: index,
        })
      }
    })
  }
  let cursor: string | null = null
  const usersByEmoji = new Map<string, string[]>()
  let pages = 0
  while (true) {
    const result: FunctionReturnType<typeof api.lib.getCommentReactionsPage> = await t.query(api.lib.getCommentReactionsPage, {
      commentId: comment._id,
      paginationOpts: { numItems: 40, cursor },
    })
    pages++
    for (const row of result.page) {
      const users = usersByEmoji.get(row.emoji) ?? []
      users.push(row.userId)
      usersByEmoji.set(row.emoji, users)
    }
    if (result.isDone) break
    expect(result.continueCursor).not.toBe(cursor)
    cursor = result.continueCursor
  }
  expect(pages).toBeGreaterThan(1)
  const legacyShape = [...usersByEmoji].sort(([a], [b]) => a.localeCompare(b))
    .map(([emoji, users]) => ({ emoji, count: users.length, users }))
  expect(legacyShape.map(({ emoji, count }) => ({ emoji, count }))).toEqual([
    { emoji: '👀', count: 553 }, { emoji: '👍', count: 552 },
  ].sort((a, b) => a.emoji.localeCompare(b.emoji)))
  expect(legacyShape.flatMap(item => item.users)).toHaveLength(1105)
  expect(usersByEmoji.get('👀')?.[0]).toBe('user_0')
  expect(usersByEmoji.get('👍')?.[0]).toBe('user_1')

  await t.run(async ctx => ctx.db.patch(comment._id, { reactionCountsReady: undefined }))
  expect(await t.query(api.lib.getCommentReactionCountsReadiness, { commentId: comment._id })).toBe(false)
  for (let step = 0; step < 60; step++) {
    const progress = await t.mutation(internal.lib.initializeCommentReactionCountsStep, { commentId: comment._id })
    if (progress.done) break
    if (step === 59) throw new Error('Historical reaction initialization did not finish')
  }
  expect(await t.query(api.lib.getCommentReactionCountsReadiness, { commentId: comment._id })).toBe(true)
  const counts = await t.query(api.lib.getCommentReactionCountsPage, {
    commentId: comment._id, currentUserId: 'user_0', paginationOpts: { numItems: 10, cursor: null },
  })
  expect(counts.page.map(({ emoji, count, includesMe }) => ({ emoji, count, includesMe })))
    .toEqual(expect.arrayContaining([
      { emoji: '👀', count: 553, includesMe: true },
      { emoji: '👍', count: 552, includesMe: false },
    ]))
}, 30_000)

test('wide reaction pages progress and a deleted comment is hidden before cleanup', async () => {
  vi.useFakeTimers()
  try {
    const t = convexTest(schema, modules)
    const feedback = await t.mutation(api.lib.upsertFeedback, {
      userId: 'author', url: 'https://example.test/wide', rating: 2, note: 'Good',
    })
    const { comment } = await t.mutation(api.lib.addComment, {
      userId: 'author', threadId: feedback.threadId, body: 'Wide reactions',
    })
    await t.run(async ctx => {
      for (let index = 0; index < 4; index++) {
        await ctx.db.insert('feedbackReactions', {
          commentId: comment._id,
          userId: `${index}_${'x'.repeat(600_000)}`,
          emoji: '👀', createdAt: index,
        })
      }
    })
    const first = await t.query(api.lib.getCommentReactionsPage, {
      commentId: comment._id,
      paginationOpts: { numItems: 1, cursor: null, maximumBytesRead: 100_000 },
    })
    expect(first.page.length).toBeGreaterThan(0)
    expect(first.isDone).toBe(false)
    let cursor = first.continueCursor
    const ids = new Set(first.page.map(row => row._id))
    while (true) {
      const page = await t.query(api.lib.getCommentReactionsPage, {
        commentId: comment._id,
        paginationOpts: { numItems: 1, cursor },
      })
      for (const row of page.page) ids.add(row._id)
      if (page.isDone) break
      expect(page.continueCursor).not.toBe(cursor)
      cursor = page.continueCursor
    }
    expect(ids.size).toBe(4)
    await t.mutation(api.lib.deleteComment, { userId: 'author', commentId: comment._id })
    expect((await t.query(api.lib.getCommentReactionsPage, {
      commentId: comment._id, paginationOpts: { numItems: 40, cursor: null },
    })).page).toEqual([])
    await t.finishAllScheduledFunctions(() => vi.runAllTimers())
  } finally {
    vi.useRealTimers()
  }
}, 30_000)
