import { describe, expect, test } from 'vitest'
import { exposeApi } from './index.js'
import { anyApi, type ApiFromModules } from 'convex/server'
import { components, initConvexTest } from './setup.test.js'

export const {
  getMyFeedback,
  upsertFeedback,
  listFeedbackVersions,
  listMyFeedbackThreads,
  listComments,
  addComment,
  toggleReaction,
} = exposeApi(components.pageFeedback, {
  auth: async (ctx, _operation) => {
    return (await ctx.auth.getUserIdentity())?.tokenIdentifier ?? 'anonymous'
  },
})

const testApi = (
  anyApi as unknown as ApiFromModules<{
    'index.test': {
      getMyFeedback: typeof getMyFeedback;
      upsertFeedback: typeof upsertFeedback;
      listFeedbackVersions: typeof listFeedbackVersions;
      listMyFeedbackThreads: typeof listMyFeedbackThreads;
      listComments: typeof listComments;
      addComment: typeof addComment;
      toggleReaction: typeof toggleReaction;
    };
  }>
)['index.test']

describe('client tests', () => {
  test('should be able to use the wrapped feedback api', async () => {
    const t = initConvexTest().withIdentity({
      tokenIdentifier: 'user1',
      subject: 'user1',
    })
    const url = 'https://app.example.com/settings?tab=profile'

    await t.mutation(testApi.upsertFeedback, {
      url,
      rating: 2,
      note: 'First version',
    })

    await t.mutation(testApi.upsertFeedback, {
      url: 'https://app.example.com/settings?tab=notifications',
      rating: 3,
      note: 'Second version',
    })

    const myFeedback = await t.query(testApi.getMyFeedback, { url })
    const versions = await t.query(testApi.listFeedbackVersions, {
      url,
      limit: 10,
    })

    expect(myFeedback?.version).toBe(2)
    expect(myFeedback?.normalizedUrl).toBe('https://app.example.com/settings')
    expect(versions).toHaveLength(2)
    expect(versions[0].note).toBe('Second version')
  })

  test('should be able to use wrapped comment apis', async () => {
    const t = initConvexTest().withIdentity({
      tokenIdentifier: 'user1',
      subject: 'user1',
    })
    const url = 'https://app.example.com/settings?tab=profile'

    const feedback = await t.mutation(testApi.upsertFeedback, {
      url,
      rating: 2,
      note: 'First version',
    })

    const createdComment = await t.mutation(testApi.addComment, {
      threadId: feedback.threadId,
      body: 'Can we simplify this section?',
    })

    const reaction = await t.mutation(testApi.toggleReaction, {
      commentId: createdComment.comment._id,
      emoji: '👀',
    })

    const comments = await t.query(testApi.listComments, {
      threadId: feedback.threadId,
      limit: 10,
    })

    expect(reaction.added).toBe(true)
    expect(comments[0].comment.body).toBe('Can we simplify this section?')
    expect(comments[0].reactions[0]).toMatchObject({
      emoji: '👀',
      count: 1,
      includesMe: true,
    })
  })

  test('listMyFeedbackThreads returns threads for current user', async () => {
    const t = initConvexTest().withIdentity({
      tokenIdentifier: 'user1',
      subject: 'user1',
    })

    await t.mutation(testApi.upsertFeedback, {
      url: 'https://app.example.com/page-x',
      rating: 3,
      note: 'ok',
    })

    const threads = await t.query(testApi.listMyFeedbackThreads, { limit: 20 })
    expect(threads).toHaveLength(1)
    expect(threads[0].rating).toBe(3)
    expect(threads[0].note).toBe('ok')
  })
})
