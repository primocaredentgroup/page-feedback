/// <reference types="vite/client" />
import { describe, expect, test, vi } from 'vitest'
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
    expect(firstFeedback.isSolved).toBe(false)
    expect(secondFeedback.version).toBe(2)
    expect(secondFeedback.isSolved).toBe(false)
    expect(myFeedback?.normalizedUrl).toBe('https://app.example.com/dashboard')
    expect(myFeedback?.rating).toBe(3)
    expect(myFeedback?.isSolved).toBe(false)
    expect(versions.map((version) => version.version)).toEqual([2, 1])
  })

  test('updates solved state without creating a new feedback version', async () => {
    const t = initConvexTest()

    const createdFeedback = await t.mutation(api.lib.upsertFeedback, {
      userId: 'user_1',
      url: 'https://app.example.com/dashboard?tab=overview',
      rating: 2,
      note: 'Needs work',
    })

    const solvedFeedback = await t.mutation(api.lib.setFeedbackSolved, {
      userId: 'user_2',
      threadId: createdFeedback.threadId,
      isSolved: true,
    })

    const feedbackAfterSolved = await t.query(api.lib.getMyFeedback, {
      userId: 'user_1',
      url: 'https://app.example.com/dashboard?tab=overview',
    })

    const updatedFeedback = await t.mutation(api.lib.upsertFeedback, {
      userId: 'user_1',
      url: 'https://app.example.com/dashboard?tab=notifications',
      rating: 3,
      note: 'Much better now',
    })

    const feedbackAfterUpdate = await t.query(api.lib.getMyFeedback, {
      userId: 'user_1',
      url: 'https://app.example.com/dashboard?tab=settings',
    })

    expect(solvedFeedback.isSolved).toBe(true)
    expect(solvedFeedback.version).toBe(1)
    expect(feedbackAfterSolved?.isSolved).toBe(true)
    expect(updatedFeedback.version).toBe(2)
    expect(updatedFeedback.isSolved).toBe(true)
    expect(feedbackAfterUpdate?.isSolved).toBe(true)
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
    expect(settings.adminUserIds).toEqual([])
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
    const firstCount = await t.query(api.lib.getCommentReactionCountsPage, {
      commentId: createdComment.comment._id,
      currentUserId: 'user_1',
      paginationOpts: { numItems: 10, cursor: null },
    })
    const secondReaction = await t.mutation(api.lib.toggleReaction, {
      userId: 'user_1',
      commentId: createdComment.comment._id,
      emoji: '👍',
    })

    const comments = await t.query(api.lib.listComments, {
      threadId: feedback.threadId,
      paginationOpts: { numItems: 10, cursor: null },
    })

    await expect(
      t.mutation(api.lib.deleteComment, {
        userId: 'user_1',
        commentId: createdComment.comment._id,
      }),
    ).rejects.toThrow('you can only delete your own comments')

    vi.useFakeTimers()
    await t.mutation(api.lib.deleteComment, {
      userId: 'user_2',
      commentId: createdComment.comment._id,
    })
    await t.finishAllScheduledFunctions(() => vi.runAllTimers())
    vi.useRealTimers()

    const commentsAfterDelete = await t.query(api.lib.listComments, {
      threadId: feedback.threadId,
      paginationOpts: { numItems: 10, cursor: null },
    })
    const reactionsAfterDelete = await t.query(api.lib.getCommentReactionsPage, {
      commentId: createdComment.comment._id,
      paginationOpts: { numItems: 10, cursor: null },
    })

    expect(updatedComment.comment.body).toBe('I strongly agree with this note')
    expect(updatedComment.comment.isEdited).toBe(true)
    expect(firstReaction.added).toBe(true)
    expect(await t.query(api.lib.getCommentReactionCountsReadiness, {
      commentId: createdComment.comment._id,
    })).toBe(true)
    expect(firstCount.page[0]).toMatchObject({
      emoji: '👍',
      count: 1,
      includesMe: true,
    })
    expect(secondReaction.added).toBe(false)
    expect(comments.page).toHaveLength(1)
    expect(commentsAfterDelete.page[0].isDeleted).toBe(true)
    expect(commentsAfterDelete.page[0].body).toBe('[deleted]')
    expect(reactionsAfterDelete.page).toEqual([])
  })

  test('stores shared objectives, indicators and objective comments per normalized url', async () => {
    const t = initConvexTest()
    const objective = await t.mutation(api.lib.upsertObjective, {
      url: 'https://app.example.com/dashboard?tab=overview',
      description: 'La pagina deve aiutare a capire subito cosa fare adesso.',
      status: 'active',
      order: 0,
    })

    await t.mutation(api.lib.upsertObjective, {
      objectiveId: objective._id,
      url: 'https://app.example.com/dashboard?tab=settings',
      description: 'La pagina deve rendere visibile il passo successivo.',
      status: 'active',
      order: 1,
    })

    const indicator = await t.mutation(api.lib.upsertIndicator, {
      objectiveId: objective._id,
      description: 'Il bottone principale si vede senza scroll.',
      order: 0,
    })

    await t.mutation(api.lib.upsertIndicator, {
      indicatorId: indicator._id,
      objectiveId: objective._id,
      description: 'Il bottone principale si vede subito e si capisce cosa fa.',
      order: 1,
    })

    await t.mutation(api.lib.addObjectiveComment, {
      userId: 'user_2',
      objectiveId: objective._id,
      body: 'Questo objective e` molto utile per discutere la pagina.',
    })

    const objectives = await t.query(api.lib.listObjectivesForUrl, {
      url: 'https://app.example.com/dashboard?tab=activity',
    })
    const indicators = await t.query(api.lib.listIndicatorsForObjective, {
      objectiveId: objective._id,
    })
    const comments = await t.query(api.lib.listObjectiveComments, {
      objectiveId: objective._id,
      limit: 10,
    })

    expect(objectives).toHaveLength(1)
    expect(objectives[0].normalizedUrl).toBe('https://app.example.com/dashboard')
    expect(objectives[0].order).toBe(1)
    expect(objectives[0].description).toBe(
      'La pagina deve rendere visibile il passo successivo.',
    )
    expect(indicators).toHaveLength(1)
    expect(indicators[0].description).toBe(
      'Il bottone principale si vede subito e si capisce cosa fa.',
    )
    expect(indicators[0].order).toBe(1)
    expect(comments).toHaveLength(1)
    expect(comments[0].body).toBe(
      'Questo objective e` molto utile per discutere la pagina.',
    )
    expect(comments[0].authorId).toBe('user_2')
  })

  test('assigns multiple roles to one user and calculates completion from isCompleted', async () => {
    const t = initConvexTest()
    const amRole = await t.mutation(api.lib.upsertRole, {
      name: 'AM',
      description: 'Account manager',
      status: 'active',
      order: 0,
    })
    const salesRole = await t.mutation(api.lib.upsertRole, {
      name: 'Sales',
      description: 'Sales team',
      status: 'active',
      order: 1,
    })

    const tests = []
    for (let index = 0; index < 4; index += 1) {
      tests.push(await t.mutation(api.lib.upsertRoleTest, {
        roleId: amRole._id,
        title: `AM test ${index + 1}`,
        description: `Complete AM test ${index + 1}`,
        targetUrl: `https://app.example.com/am/${index + 1}?demo=true`,
        videoUrl: index === 0 ? 'https://video.example.com/am-1' : null,
        status: 'active',
        order: index,
      }))
    }
    await t.mutation(api.lib.upsertRoleTest, {
      roleId: salesRole._id,
      title: 'Sales test 1',
      description: 'Complete Sales test 1',
      targetUrl: 'https://app.example.com/sales/1',
      status: 'active',
      order: 0,
    })

    await t.mutation(api.lib.assignRoleToUser, {
      userId: 'user_1',
      roleId: amRole._id,
    })
    await t.mutation(api.lib.assignRoleToUser, {
      userId: 'user_1',
      roleId: salesRole._id,
    })

    const initialProgress = await t.query(api.lib.listMyAssignedRoleTests, {
      userId: 'user_1',
    })
    expect(initialProgress.map((block) => block.role.name)).toEqual(['AM', 'Sales'])
    expect(initialProgress[0].completionPercentage).toBe(0)

    const expectedPercentages = [25, 50, 75, 100]
    for (const [index, roleTest] of tests.entries()) {
      await t.mutation(api.lib.completeRoleTestWithFeedback, {
        userId: 'user_1',
        roleTestId: roleTest._id,
        rating: 3,
        note: `Feedback ${index + 1}`,
      })
      const progress = await t.query(api.lib.listMyAssignedRoleTests, {
        userId: 'user_1',
      })
      expect(progress[0].completionPercentage).toBe(expectedPercentages[index])
      expect(progress[0].tests[index].isCompleted).toBe(true)
    }
  })

  test('requires feedback note and ignores isSolved when calculating test completion', async () => {
    const t = initConvexTest()
    const role = await t.mutation(api.lib.upsertRole, {
      name: 'AM',
      status: 'active',
      order: 0,
    })
    const firstTest = await t.mutation(api.lib.upsertRoleTest, {
      roleId: role._id,
      title: 'First test',
      description: 'Do the first test',
      targetUrl: 'https://app.example.com/tests/first?step=1',
      status: 'active',
      order: 0,
    })
    const archivedTest = await t.mutation(api.lib.upsertRoleTest, {
      roleId: role._id,
      title: 'Archived test',
      description: 'This test should not count',
      targetUrl: 'https://app.example.com/tests/archived',
      status: 'active',
      order: 1,
    })

    await t.mutation(api.lib.assignRoleToUser, {
      userId: 'user_1',
      roleId: role._id,
    })

    await expect(t.mutation(api.lib.completeRoleTestWithFeedback, {
      userId: 'user_1',
      roleTestId: firstTest._id,
      rating: 2,
      note: '   ',
    })).rejects.toThrow('feedback note is required to complete a test')

    const completed = await t.mutation(api.lib.completeRoleTestWithFeedback, {
      userId: 'user_1',
      roleTestId: firstTest._id,
      rating: 2,
      note: 'The target is clear enough',
    })
    await t.mutation(api.lib.setFeedbackSolved, {
      userId: 'admin',
      threadId: completed.feedback?.threadId ?? completed.progress!.feedbackThreadId,
      isSolved: true,
    })
    await t.mutation(api.lib.archiveRoleTest, {
      roleTestId: archivedTest._id,
    })

    const progress = await t.query(api.lib.listMyAssignedRoleTests, {
      userId: 'user_1',
    })
    const detail = await t.query(api.lib.getRoleTestDetail, {
      userId: 'user_1',
      roleTestId: firstTest._id,
    })

    expect(progress[0].totalTests).toBe(1)
    expect(progress[0].completedTests).toBe(1)
    expect(progress[0].completionPercentage).toBe(100)
    expect(detail.feedback?.isSolved).toBe(true)
    expect(detail.isCompleted).toBe(true)
  })
})
