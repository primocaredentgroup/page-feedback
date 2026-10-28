/// <reference types="vite/client" />
import { expect, test } from 'vitest'
import { convexTest } from 'convex-test'
import { api, internal } from './_generated/api.js'
import schema from './schema.js'

const modules = import.meta.glob('./**/*.ts')
const page = { cursor: null, numItems: 10 }

test('partial legacy reaction rebuild incorporates concurrent toggles exactly once', async () => {
  const t = convexTest(schema, modules)
  const feedback = await t.mutation(api.lib.upsertFeedback, {
    userId: 'author', url: 'https://example.test/feedback', rating: 3, note: 'Good',
  })
  const { comment } = await t.mutation(api.lib.addComment, {
    userId: 'author', threadId: feedback.threadId, body: 'Historical comment',
  })
  await t.run(async ctx => {
    await ctx.db.patch(comment._id, { reactionCountsReady: undefined })
    for (let index = 0; index < 45; index++) {
      await ctx.db.insert('feedbackReactions', {
        commentId: comment._id, userId: `user_${index}`, emoji: '👍', createdAt: index,
      })
    }
    // A historical duplicate contributes twice to count/users, as before.
    await ctx.db.insert('feedbackReactions', {
      commentId: comment._id, userId: 'user_10', emoji: '👍', createdAt: 46,
    })
  })
  expect(await t.query(api.lib.getCommentReactionCountsReadiness, { commentId: comment._id })).toBe(false)
  expect(await t.query(api.lib.getCommentReactionCountsPage, {
    commentId: comment._id, currentUserId: 'user_10', paginationOpts: page,
  })).toMatchObject({ page: [] })

  const first = await t.mutation(internal.lib.initializeCommentReactionCountsStep, { commentId: comment._id })
  expect(first).toEqual({ processed: 20, done: false })
  await t.mutation(api.lib.toggleReaction, { userId: 'user_0', commentId: comment._id, emoji: '👍' })
  await t.mutation(api.lib.toggleReaction, { userId: 'user_44', commentId: comment._id, emoji: '👍' })
  await t.mutation(api.lib.toggleReaction, { userId: 'new_user', commentId: comment._id, emoji: '✨' })
  for (let step = 0; step < 10; step++) {
    const result = await t.mutation(internal.lib.initializeCommentReactionCountsStep, { commentId: comment._id })
    if (result.done) break
    if (step === 9) throw new Error('Legacy initialization made no progress')
  }
  expect(await t.mutation(internal.lib.initializeCommentReactionCountsStep, { commentId: comment._id }))
    .toEqual({ processed: 0, done: true })
  const result = await t.query(api.lib.getCommentReactionCountsPage, {
    commentId: comment._id, currentUserId: 'user_10', paginationOpts: page,
  })
  expect(await t.query(api.lib.getCommentReactionCountsReadiness, { commentId: comment._id })).toBe(true)
  expect(result.page.map(({ emoji, count, includesMe }) => ({ emoji, count, includesMe })))
    .toEqual(expect.arrayContaining([
      { emoji: '👍', count: 44, includesMe: true },
      { emoji: '✨', count: 1, includesMe: false },
    ]))
})

test('tombstone hides reactions immediately and cleanup removes partial projections in bounded retries', async () => {
  const t = convexTest(schema, modules)
  const feedback = await t.mutation(api.lib.upsertFeedback, {
    userId: 'author', url: 'https://example.test/feedback', rating: 3, note: 'Good',
  })
  const { comment } = await t.mutation(api.lib.addComment, {
    userId: 'author', threadId: feedback.threadId, body: 'Historical comment',
  })
  await t.run(async ctx => {
    await ctx.db.patch(comment._id, { reactionCountsReady: undefined })
    for (let index = 0; index < 45; index++) {
      await ctx.db.insert('feedbackReactions', {
        commentId: comment._id, userId: `user_${index}`, emoji: '👍', createdAt: index,
      })
    }
  })
  await t.mutation(internal.lib.initializeCommentReactionCountsStep, { commentId: comment._id })
  await t.mutation(api.lib.deleteComment, { userId: 'author', commentId: comment._id })
  expect((await t.query(api.lib.getCommentReactionsPage, { commentId: comment._id, paginationOpts: page })).page).toEqual([])
  expect(await t.query(api.lib.getCommentReactionCountsReadiness, { commentId: comment._id })).toBe(true)
  expect(await t.query(api.lib.getCommentReactionCountsPage, {
    commentId: comment._id, currentUserId: 'user_0', paginationOpts: page,
  })).toMatchObject({ page: [] })
  for (let step = 0; step < 10; step++) {
    await t.mutation(internal.lib.cleanupDeletedCommentReactions, { commentId: comment._id })
    const remaining = await t.run(async ctx => ({
      reactions: await ctx.db.query('feedbackReactions').withIndex('by_commentId', q => q.eq('commentId', comment._id)).first(),
      counts: await ctx.db.query('feedbackReactionCounts').withIndex('by_commentId', q => q.eq('commentId', comment._id)).first(),
    }))
    if (!remaining.reactions && !remaining.counts) return
  }
  throw new Error('Deleted comment cleanup did not finish')
})
