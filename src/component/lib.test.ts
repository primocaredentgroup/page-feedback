/// <reference types="vite/client" />
import { describe, expect, test } from 'vitest'
import { convexTest } from 'convex-test'
import { api } from './_generated/api.js'
import schema from './schema.js'

const modules = import.meta.glob('./**/*.ts')

function initConvexTest() {
  return convexTest(schema, modules)
}

describe('feedback-page component', () => {
  test('creates append-only feedback versions per user and normalized url', async () => {
    const t = initConvexTest()

    const firstFeedback = await t.mutation(api.lib.upsertFeedback, {
      userId: 'user_1',
      url: 'https://app.example.com/dashboard?tab=overview',
      rating: 2,
      note: 'Useful page',
    })

    const secondFeedback = await t.mutation(api.lib.upsertFeedback, {
      userId: 'user_1',
      url: 'https://app.example.com/dashboard?tab=settings',
      rating: 3,
      note: 'Much clearer after the update',
    })

    const myFeedback = await t.query(api.lib.getMyFeedback, {
      userId: 'user_1',
      url: 'https://app.example.com/dashboard?tab=activity',
    })

    const versions = await t.query(api.lib.listFeedbackVersions, {
      userId: 'user_1',
      url: 'https://app.example.com/dashboard?tab=activity',
      limit: 10,
    })

    expect(firstFeedback.version).toBe(1)
    expect(secondFeedback.version).toBe(2)
    expect(myFeedback?.normalizedUrl).toBe('https://app.example.com/dashboard')
    expect(myFeedback?.rating).toBe(3)
    expect(versions.map((version) => version.version)).toEqual([2, 1])
  })

  test('lists all feedback threads for a user ordered by updatedAt desc', async () => {
    const t = initConvexTest()

    await t.mutation(api.lib.upsertFeedback, {
      userId: 'user_1',
      url: 'https://app.example.com/a',
      rating: 3,
      note: 'A',
    })

    await t.mutation(api.lib.upsertFeedback, {
      userId: 'user_1',
      url: 'https://app.example.com/b',
      rating: 2,
      note: 'B',
    })

    const mine = await t.query(api.lib.listMyFeedbackThreads, {
      userId: 'user_1',
      limit: 10,
    })

    expect(mine).toHaveLength(2)
    expect(mine[0].normalizedUrl).toBe('https://app.example.com/b')
    expect(mine[1].normalizedUrl).toBe('https://app.example.com/a')
  })

  test('stores settings as a singleton document and supports clearing values', async () => {
    const t = initConvexTest()

    await t.mutation(api.lib.setSettings, {
      bugReportUrl: 'https://linear.example.com/bug',
      improvementRequestUrl: 'https://linear.example.com/improvement',
    })

    const updatedSettings = await t.mutation(api.lib.setSettings, {
      bugReportUrl: null,
    })

    const settings = await t.query(api.lib.getSettings, {})

    expect(updatedSettings.bugReportUrl).toBe(null)
    expect(updatedSettings.improvementRequestUrl).toBe(
      'https://linear.example.com/improvement',
    )
    expect(settings.bugReportUrl).toBe(null)
    expect(settings.improvementRequestUrl).toBe(
      'https://linear.example.com/improvement',
    )
  })

  test('adds comments, enforces ownership and toggles reactions', async () => {
    const t = initConvexTest()
    const feedback = await t.mutation(api.lib.upsertFeedback, {
      userId: 'user_1',
      url: 'https://app.example.com/dashboard?tab=overview',
      rating: 3,
      note: 'Love this page',
    })

    const createdComment = await t.mutation(api.lib.addComment, {
      userId: 'user_2',
      threadId: feedback.threadId,
      body: 'I agree with this note',
    })

    const updatedComment = await t.mutation(api.lib.editComment, {
      userId: 'user_2',
      commentId: createdComment.comment._id,
      body: 'I strongly agree with this note',
    })

    const firstReaction = await t.mutation(api.lib.toggleReaction, {
      userId: 'user_1',
      commentId: createdComment.comment._id,
      emoji: '👍',
    })
    const secondReaction = await t.mutation(api.lib.toggleReaction, {
      userId: 'user_1',
      commentId: createdComment.comment._id,
      emoji: '👍',
    })

    const comments = await t.query(api.lib.listComments, {
      threadId: feedback.threadId,
      limit: 10,
      currentUserId: 'user_1',
    })

    await expect(
      t.mutation(api.lib.deleteComment, {
        userId: 'user_1',
        commentId: createdComment.comment._id,
      }),
    ).rejects.toThrow('you can only delete your own comments')

    await t.mutation(api.lib.deleteComment, {
      userId: 'user_2',
      commentId: createdComment.comment._id,
    })

    const commentsAfterDelete = await t.query(api.lib.listComments, {
      threadId: feedback.threadId,
      limit: 10,
      currentUserId: 'user_1',
    })

    expect(updatedComment.comment.body).toBe('I strongly agree with this note')
    expect(updatedComment.comment.isEdited).toBe(true)
    expect(firstReaction.added).toBe(true)
    expect(firstReaction.reactions[0]).toMatchObject({
      emoji: '👍',
      count: 1,
      includesMe: true,
    })
    expect(secondReaction.added).toBe(false)
    expect(comments).toHaveLength(1)
    expect(comments[0].reactions).toEqual([])
    expect(commentsAfterDelete[0].comment.isDeleted).toBe(true)
    expect(commentsAfterDelete[0].comment.body).toBe('[deleted]')
    expect(commentsAfterDelete[0].reactions).toEqual([])
  })
})
