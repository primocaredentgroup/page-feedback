import { describe, expect, test } from 'vitest'
import { exposeApi } from './index.js'
import { anyApi, type ApiFromModules } from 'convex/server'
import { components, initConvexTest } from './setup.test.js'

export const {
  getMyFeedback,
  upsertFeedback,
  setFeedbackSolved,
  listFeedbackVersions,
  listObjectivesForUrl,
  upsertObjective,
  listIndicatorsForObjective,
  upsertIndicator,
  listRoles,
  upsertRole,
  archiveRole,
  listRoleTestsForRole,
  upsertRoleTest,
  archiveRoleTest,
  assignRoleToUser,
  removeRoleFromUser,
  listRoleAssignments,
  listMyAssignedRoleTests,
  getRoleTestDetail,
  completeRoleTestWithFeedback,
  listMyFeedbackThreads,
  listComments,
  listObjectiveComments,
  addComment,
  addObjectiveComment,
  toggleReaction,
} = exposeApi(components.pageFeedback, {
  auth: async (ctx, _operation) => {
    return (await ctx.auth.getUserIdentity())?.tokenIdentifier ?? 'anonymous'
  },
  adminAuth: async () => {},
})

export const {
  setSettings: defaultSetSettings,
  upsertRole: defaultAdminUpsertRole,
} = exposeApi(components.pageFeedback, {
  auth: async (ctx) => {
    return (await ctx.auth.getUserIdentity())?.tokenIdentifier ?? 'anonymous'
  },
})

export const {
  upsertRole: throwingAdminUpsertRole,
} = exposeApi(components.pageFeedback, {
  auth: async (ctx) => {
    return (await ctx.auth.getUserIdentity())?.tokenIdentifier ?? 'anonymous'
  },
  adminAuth: async () => {
    throw new Error('adminAuth called')
  },
})

const testApi = (
  anyApi as unknown as ApiFromModules<{
    'index.test': {
      getMyFeedback: typeof getMyFeedback;
      upsertFeedback: typeof upsertFeedback;
      setFeedbackSolved: typeof setFeedbackSolved;
      listFeedbackVersions: typeof listFeedbackVersions;
      listObjectivesForUrl: typeof listObjectivesForUrl;
      upsertObjective: typeof upsertObjective;
      listIndicatorsForObjective: typeof listIndicatorsForObjective;
      upsertIndicator: typeof upsertIndicator;
      listRoles: typeof listRoles;
      upsertRole: typeof upsertRole;
      archiveRole: typeof archiveRole;
      listRoleTestsForRole: typeof listRoleTestsForRole;
      upsertRoleTest: typeof upsertRoleTest;
      archiveRoleTest: typeof archiveRoleTest;
      assignRoleToUser: typeof assignRoleToUser;
      removeRoleFromUser: typeof removeRoleFromUser;
      listRoleAssignments: typeof listRoleAssignments;
      listMyAssignedRoleTests: typeof listMyAssignedRoleTests;
      getRoleTestDetail: typeof getRoleTestDetail;
      completeRoleTestWithFeedback: typeof completeRoleTestWithFeedback;
      defaultSetSettings: typeof defaultSetSettings;
      defaultAdminUpsertRole: typeof defaultAdminUpsertRole;
      throwingAdminUpsertRole: typeof throwingAdminUpsertRole;
      listMyFeedbackThreads: typeof listMyFeedbackThreads;
      listComments: typeof listComments;
      listObjectiveComments: typeof listObjectiveComments;
      addComment: typeof addComment;
      addObjectiveComment: typeof addObjectiveComment;
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
    expect(myFeedback?.isSolved).toBe(false)
    expect(versions).toHaveLength(2)
    expect(versions[0].note).toBe('Second version')
  })

  test('should be able to mark a wrapped feedback thread as solved', async () => {
    const t = initConvexTest().withIdentity({
      tokenIdentifier: 'user1',
      subject: 'user1',
    })
    const url = 'https://app.example.com/settings?tab=profile'

    const createdFeedback = await t.mutation(testApi.upsertFeedback, {
      url,
      rating: 2,
      note: 'First version',
    })

    const solvedFeedback = await t.mutation(testApi.setFeedbackSolved, {
      threadId: createdFeedback.threadId,
      isSolved: true,
    })

    const myFeedback = await t.query(testApi.getMyFeedback, { url })

    expect(solvedFeedback.isSolved).toBe(true)
    expect(myFeedback?.isSolved).toBe(true)
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

  test('should be able to use wrapped objectives api', async () => {
    const t = initConvexTest().withIdentity({
      tokenIdentifier: 'user1',
      subject: 'user1',
    })
    const url = 'https://app.example.com/settings?tab=profile'

    const objective = await t.mutation(testApi.upsertObjective, {
      url,
      description: 'La pagina deve spiegare subito dove si trova l utente.',
      status: 'active',
      order: 0,
    })

    await t.mutation(testApi.upsertIndicator, {
      objectiveId: objective._id,
      description: 'Il titolo spiega il contesto in meno di una riga.',
      order: 0,
    })

    await t.mutation(testApi.addObjectiveComment, {
      objectiveId: objective._id,
      body: 'Questo objective rende bene il focus della pagina.',
    })

    const objectives = await t.query(testApi.listObjectivesForUrl, { url })
    const indicators = await t.query(testApi.listIndicatorsForObjective, {
      objectiveId: objective._id,
    })
    const comments = await t.query(testApi.listObjectiveComments, {
      objectiveId: objective._id,
      limit: 10,
    })

    expect(objectives).toHaveLength(1)
    expect(objectives[0].normalizedUrl).toBe('https://app.example.com/settings')
    expect(indicators[0].description).toBe(
      'Il titolo spiega il contesto in meno di una riga.',
    )
    expect(comments[0].authorId).toBe('user1')
  })

  test('should expose wrapped role test workflow api', async () => {
    const t = initConvexTest().withIdentity({
      tokenIdentifier: 'user1',
      subject: 'user1',
    })

    const amRole = await t.mutation(testApi.upsertRole, {
      name: 'AM',
      description: 'Account manager',
      status: 'active',
      order: 0,
    })
    const qaRole = await t.mutation(testApi.upsertRole, {
      name: 'QA',
      description: null,
      status: 'active',
      order: 1,
    })
    const firstTest = await t.mutation(testApi.upsertRoleTest, {
      roleId: amRole._id,
      title: 'Review target',
      description: 'Open the target and leave feedback.',
      targetUrl: 'https://app.example.com/am?step=1',
      videoUrl: 'https://video.example.com/am',
      status: 'active',
      order: 0,
    })

    await t.mutation(testApi.assignRoleToUser, {
      userId: 'user1',
      roleId: amRole._id,
    })
    await t.mutation(testApi.assignRoleToUser, {
      userId: 'user1',
      roleId: qaRole._id,
    })
    await t.mutation(testApi.completeRoleTestWithFeedback, {
      roleTestId: firstTest._id,
      rating: 3,
      note: 'This test is clear.',
    })

    const roles = await t.query(testApi.listRoles, { limit: 10 })
    const roleTests = await t.query(testApi.listRoleTestsForRole, {
      roleId: amRole._id,
      limit: 10,
    })
    const assignments = await t.query(testApi.listRoleAssignments, {
      userId: 'user1',
      limit: 10,
    })
    const myAssignedRoleTests = await t.query(testApi.listMyAssignedRoleTests, {})
    const detail = await t.query(testApi.getRoleTestDetail, {
      roleTestId: firstTest._id,
    })

    expect(roles.map((role) => role.name)).toEqual(['AM', 'QA'])
    expect(roleTests[0].targetUrl).toBe('https://app.example.com/am')
    expect(assignments).toHaveLength(2)
    expect(myAssignedRoleTests).toHaveLength(2)
    expect(myAssignedRoleTests[0].completionPercentage).toBe(100)
    expect(detail.isCompleted).toBe(true)
    expect(detail.feedback?.note).toBe('This test is clear.')
  })

  test('default admin check uses settings adminUserIds and adminAuth can override', async () => {
    const base = initConvexTest()
    const admin = base.withIdentity({
      tokenIdentifier: 'admin-user',
      subject: 'admin-user',
    })

    await admin.mutation(testApi.defaultSetSettings, {
      adminUserIds: ['admin-user'],
    })
    await admin.mutation(testApi.defaultAdminUpsertRole, {
      name: 'Admin role',
      status: 'active',
      order: 0,
    })

    const nonAdmin = base.withIdentity({
      tokenIdentifier: 'regular-user',
      subject: 'regular-user',
    })

    await expect(nonAdmin.mutation(testApi.defaultAdminUpsertRole, {
      name: 'Blocked role',
      status: 'active',
      order: 1,
    })).rejects.toThrow('admin access required')

    await expect(admin.mutation(testApi.throwingAdminUpsertRole, {
      name: 'Override role',
      status: 'active',
      order: 2,
    })).rejects.toThrow('adminAuth called')
  })
})
