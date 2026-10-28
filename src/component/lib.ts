import { normalizeFeedbackUrl as normalizeUrl, type UrlMode } from "./url.js";
import { v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator, type PaginationOptions } from "convex/server";
import { internalMutation, mutation, query } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import type { Doc } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import schema from "./schema.js";

const SETTINGS_KEY = "global";
const DEFAULT_LIMIT = 50;

function feedbackPage(options: PaginationOptions, maxRows = 40) {
  if (!Number.isSafeInteger(options.numItems) || options.numItems < 1) throw new Error("Page size must be a positive integer");
  return {
    ...options,
    numItems: Math.min(options.numItems, maxRows),
    maximumRowsRead: Math.max(2, Math.min(options.maximumRowsRead ?? maxRows, maxRows)),
    maximumBytesRead: Math.max(1_500_000, Math.min(options.maximumBytesRead ?? 2_000_000, 2_000_000)),
  };
}

function emptyPage<T>() {
  return { page: [] as T[], isDone: true, continueCursor: "" };
}

function mapReactionFact({ _id, _creationTime, commentId, userId, emoji, createdAt }: Doc<"feedbackReactions">) {
  return { _id, _creationTime, commentId, userId, emoji, createdAt };
}

const ratingValidator = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(3),
);

const nullableStringValidator = v.union(v.string(), v.null());
const objectiveStatusValidator = v.union(
  v.literal("active"),
  v.literal("archived"),
);
const roleStatusValidator = v.union(
  v.literal("active"),
  v.literal("archived"),
);
const roleTestStatusValidator = v.union(
  v.literal("active"),
  v.literal("archived"),
);

const feedbackVersionValidator = schema.tables.feedbackVersions.validator.extend({
  _id: v.id("feedbackVersions"),
  _creationTime: v.number(),
});

const feedbackCommentValidator = schema.tables.feedbackComments.validator.extend({
  _id: v.id("feedbackComments"),
  _creationTime: v.number(),
});

const reactionFactValidator = v.object({
  _id: v.id("feedbackReactions"),
  _creationTime: v.number(),
  commentId: v.id("feedbackComments"),
  userId: v.string(),
  emoji: v.string(),
  createdAt: v.number(),
});

const reactionCountValidator = schema.tables.feedbackReactionCounts.validator.extend({
  _id: v.id("feedbackReactionCounts"),
  _creationTime: v.number(),
  includesMe: v.boolean(),
});

const pageObjectiveValidator = schema.tables.pageObjectives.validator.extend({
  _id: v.id("pageObjectives"),
  _creationTime: v.number(),
});

const roleValidator = schema.tables.roles.validator.extend({
  _id: v.id("roles"),
  _creationTime: v.number(),
});

const roleTestValidator = schema.tables.roleTests.validator.extend({
  _id: v.id("roleTests"),
  _creationTime: v.number(),
});

const userRoleAssignmentValidator =
  schema.tables.userRoleAssignments.validator.extend({
    _id: v.id("userRoleAssignments"),
    _creationTime: v.number(),
  });

const roleTestProgressValidator = schema.tables.roleTestProgress.validator.extend({
  _id: v.id("roleTestProgress"),
  _creationTime: v.number(),
});

const objectiveIndicatorValidator = schema.tables.objectiveIndicators.validator.extend(
  {
    _id: v.id("objectiveIndicators"),
    _creationTime: v.number(),
  },
);

const objectiveCommentValidator = schema.tables.objectiveComments.validator.extend({
  _id: v.id("objectiveComments"),
  _creationTime: v.number(),
});

const commentWithReactionsValidator = v.object({ comment: feedbackCommentValidator });

const latestFeedbackValidator = v.object({
  threadId: v.id("feedbackThreads"),
  version: v.number(),
  rating: ratingValidator,
  note: v.string(),
  isSolved: v.boolean(),
  userId: v.string(),
  normalizedUrl: v.string(),
  updatedAt: v.number(),
});

const settingsOutputValidator = v.object({
  bugReportUrl: nullableStringValidator,
  improvementRequestUrl: nullableStringValidator,
  adminUserIds: v.array(v.string()),
  updatedAt: v.union(v.number(), v.null()),
});

const roleTestWithProgressValidator = v.object({
  test: roleTestValidator,
  feedback: v.union(v.null(), latestFeedbackValidator),
  progress: v.union(v.null(), roleTestProgressValidator),
  isCompleted: v.boolean(),
  completedAt: v.union(v.number(), v.null()),
});

const assignedRoleTestsValidator = v.object({
  role: roleValidator,
  assignment: userRoleAssignmentValidator,
  tests: v.array(roleTestWithProgressValidator),
  totalTests: v.number(),
  completedTests: v.number(),
  completionPercentage: v.number(),
});

const roleTestDetailValidator = v.object({
  role: roleValidator,
  test: roleTestValidator,
  feedback: v.union(v.null(), latestFeedbackValidator),
  progress: v.union(v.null(), roleTestProgressValidator),
  isCompleted: v.boolean(),
  completedAt: v.union(v.number(), v.null()),
});

const upsertObjectiveArgsValidator = {
  objectiveId: v.optional(v.id("pageObjectives")),
  url: v.string(),
  urlMode: v.optional(v.union(v.literal("page"), v.literal("full"))),
  description: v.string(),
  status: objectiveStatusValidator,
  order: v.number(),
} as const;

const upsertIndicatorArgsValidator = {
  indicatorId: v.optional(v.id("objectiveIndicators")),
  objectiveId: v.id("pageObjectives"),
  description: v.string(),
  order: v.number(),
} as const;

const upsertRoleArgsValidator = {
  roleId: v.optional(v.id("roles")),
  name: v.string(),
  description: v.optional(nullableStringValidator),
  status: roleStatusValidator,
  order: v.number(),
} as const;

const upsertRoleTestArgsValidator = {
  roleTestId: v.optional(v.id("roleTests")),
  roleId: v.id("roles"),
  title: v.string(),
  description: v.string(),
  targetUrl: v.string(),
  urlMode: v.optional(v.union(v.literal("page"), v.literal("full"))),
  videoUrl: v.optional(nullableStringValidator),
  status: roleTestStatusValidator,
  order: v.number(),
} as const;

export const upsertFeedback = mutation({
  args: {
    userId: v.string(),
    url: v.string(),
    urlMode: v.optional(v.union(v.literal("page"), v.literal("full"))),
    rating: ratingValidator,
    note: v.string(),
  },
  returns: latestFeedbackValidator,
  handler: async (ctx, args) => {
    return await upsertFeedbackCore(ctx, {
      userId: args.userId,
      url: args.url,
      urlMode: args.urlMode,
      rating: args.rating,
      note: args.note,
    });
  },
});

export const setFeedbackSolved = mutation({
  args: {
    userId: v.string(),
    threadId: v.id("feedbackThreads"),
    isSolved: v.boolean(),
  },
  returns: latestFeedbackValidator,
  handler: async (ctx, args) => {
    normalizeUserId(args.userId);
    const thread = await ctx.db.get(args.threadId);

    if (!thread) {
      throw new Error("feedback thread not found");
    }

    await ctx.db.patch("feedbackThreads", args.threadId, {
      isSolved: args.isSolved,
    });

    return {
      ...mapThreadToLatestFeedback(thread),
      isSolved: args.isSolved,
    };
  },
});

export const getMyFeedback = query({
  args: {
    userId: v.string(),
    url: v.string(),
    urlMode: v.optional(v.union(v.literal("page"), v.literal("full"))),
  },
  returns: v.union(v.null(), latestFeedbackValidator),
  handler: async (ctx, args) => {
    const userId = normalizeUserId(args.userId);
    const normalizedUrl = normalizeUrl(args.url, args.urlMode);
    const thread = await getFeedbackThread(ctx, userId, normalizedUrl);

    if (!thread) {
      return null;
    }

    return mapThreadToLatestFeedback(thread);
  },
});

export const listFeedbackVersions = query({
  args: {
    userId: v.string(),
    url: v.string(),
    urlMode: v.optional(v.union(v.literal("page"), v.literal("full"))),
    limit: v.optional(v.number()),
  },
  returns: v.array(feedbackVersionValidator),
  handler: async (ctx, args) => {
    const userId = normalizeUserId(args.userId);
    const normalizedUrl = normalizeUrl(args.url, args.urlMode);
    const thread = await getFeedbackThread(ctx, userId, normalizedUrl);

    if (!thread) {
      return [];
    }

    return await ctx.db
      .query("feedbackVersions")
      .withIndex("by_threadId_and_version", (q) =>
        q.eq("threadId", thread._id),
      )
      .order("desc")
      .take(getSafeLimit(args.limit));
  },
});

export const listLatestFeedbackForUrl = query({
  args: {
    url: v.string(),
    urlMode: v.optional(v.union(v.literal("page"), v.literal("full"))),
    limit: v.optional(v.number()),
  },
  returns: v.array(latestFeedbackValidator),
  handler: async (ctx, args) => {
    const normalizedUrl = normalizeUrl(args.url, args.urlMode);
    const threads = await ctx.db
      .query("feedbackThreads")
      .withIndex("by_normalizedUrl", (q) =>
        q.eq("normalizedUrl", normalizedUrl),
      )
      .order("desc")
      .take(getSafeLimit(args.limit));

    return threads.map(mapThreadToLatestFeedback);
  },
});

/** Host adapters must authorize access before exposing this global registry. */
export const listAllFeedbackThreads = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(latestFeedbackValidator),
  handler: async (ctx, args) => {
    const threads = await ctx.db.query("feedbackThreads").order("desc").take(getSafeLimit(args.limit));
    return threads.map(mapThreadToLatestFeedback);
  },
});

export const listMyFeedbackThreads = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(latestFeedbackValidator),
  handler: async (ctx, args) => {
    const userId = normalizeUserId(args.userId);
    const limit = getSafeLimit(args.limit);
    const threads = await ctx.db
      .query("feedbackThreads")
      .withIndex("by_userId_and_normalizedUrl", (q) => q.eq("userId", userId))
      .take(200);

    threads.sort((left, right) => {
      const updatedAtDiff = right.updatedAt - left.updatedAt;

      if (updatedAtDiff !== 0) {
        return updatedAtDiff;
      }

      return right._creationTime - left._creationTime;
    });

    return threads.slice(0, limit).map(mapThreadToLatestFeedback);
  },
});

export const listRoles = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(roleValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("roles")
      .withIndex("by_order")
      .order("asc")
      .take(getSafeLimit(args.limit));
  },
});

export const upsertRole = mutation({
  args: upsertRoleArgsValidator,
  returns: roleValidator,
  handler: async (ctx, args) => {
    const name = normalizeRequiredText(args.name, "role name is required");
    const description = normalizeOptionalText(args.description);
    const order = normalizeOrder(args.order);
    const now = Date.now();

    if (!args.roleId) {
      const roleId = await ctx.db.insert("roles", {
        name,
        ...(description === undefined ? {} : { description }),
        status: args.status,
        order,
        createdAt: now,
        updatedAt: now,
      });

      return await requireRole(ctx, roleId);
    }

    const existingRole = await requireRole(ctx, args.roleId);
    const nextRole = {
      ...existingRole,
      name,
      description,
      status: args.status,
      order,
      updatedAt: now,
    };

    await ctx.db.replace("roles", args.roleId, {
      name: nextRole.name,
      ...(nextRole.description === undefined
        ? {}
        : { description: nextRole.description }),
      status: nextRole.status,
      order: nextRole.order,
      createdAt: existingRole.createdAt,
      updatedAt: nextRole.updatedAt,
    });

    return await requireRole(ctx, args.roleId);
  },
});

export const archiveRole = mutation({
  args: {
    roleId: v.id("roles"),
  },
  returns: roleValidator,
  handler: async (ctx, args) => {
    await requireRole(ctx, args.roleId);
    await ctx.db.patch("roles", args.roleId, {
      status: "archived",
      updatedAt: Date.now(),
    });

    return await requireRole(ctx, args.roleId);
  },
});

export const listRoleTestsForRole = query({
  args: {
    roleId: v.id("roles"),
    limit: v.optional(v.number()),
  },
  returns: v.array(roleTestValidator),
  handler: async (ctx, args) => {
    await requireRole(ctx, args.roleId);

    return await ctx.db
      .query("roleTests")
      .withIndex("by_roleId_and_order", (q) => q.eq("roleId", args.roleId))
      .order("asc")
      .take(getSafeLimit(args.limit));
  },
});

export const upsertRoleTest = mutation({
  args: upsertRoleTestArgsValidator,
  returns: roleTestValidator,
  handler: async (ctx, args) => {
    await requireRole(ctx, args.roleId);
    const title = normalizeRequiredText(args.title, "test title is required");
    const description = normalizeRequiredText(
      args.description,
      "test description is required",
    );
    const targetUrl = normalizeUrl(args.targetUrl, args.urlMode);
    const videoUrl = normalizeOptionalText(args.videoUrl);
    const order = normalizeOrder(args.order);
    const now = Date.now();

    if (!args.roleTestId) {
      const roleTestId = await ctx.db.insert("roleTests", {
        roleId: args.roleId,
        title,
        description,
        targetUrl,
        ...(videoUrl === undefined ? {} : { videoUrl }),
        status: args.status,
        order,
        createdAt: now,
        updatedAt: now,
      });

      return await requireRoleTest(ctx, roleTestId);
    }

    const existingTest = await requireRoleTest(ctx, args.roleTestId);
    await ctx.db.replace("roleTests", args.roleTestId, {
      roleId: args.roleId,
      title,
      description,
      targetUrl,
      ...(videoUrl === undefined ? {} : { videoUrl }),
      status: args.status,
      order,
      createdAt: existingTest.createdAt,
      updatedAt: now,
    });

    return await requireRoleTest(ctx, args.roleTestId);
  },
});

export const archiveRoleTest = mutation({
  args: {
    roleTestId: v.id("roleTests"),
  },
  returns: roleTestValidator,
  handler: async (ctx, args) => {
    await requireRoleTest(ctx, args.roleTestId);
    await ctx.db.patch("roleTests", args.roleTestId, {
      status: "archived",
      updatedAt: Date.now(),
    });

    return await requireRoleTest(ctx, args.roleTestId);
  },
});

export const assignRoleToUser = mutation({
  args: {
    userId: v.string(),
    roleId: v.id("roles"),
  },
  returns: userRoleAssignmentValidator,
  handler: async (ctx, args) => {
    const userId = normalizeUserId(args.userId);
    await requireRole(ctx, args.roleId);
    const existingAssignment = await getUserRoleAssignment(
      ctx,
      userId,
      args.roleId,
    );

    if (existingAssignment) {
      return existingAssignment;
    }

    const assignmentId = await ctx.db.insert("userRoleAssignments", {
      userId,
      roleId: args.roleId,
      createdAt: Date.now(),
    });

    return await requireUserRoleAssignment(ctx, assignmentId);
  },
});

export const removeRoleFromUser = mutation({
  args: {
    userId: v.string(),
    roleId: v.id("roles"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = normalizeUserId(args.userId);
    const assignment = await getUserRoleAssignment(ctx, userId, args.roleId);

    if (!assignment) {
      return null;
    }

    await ctx.db.delete(assignment._id);
    return null;
  },
});

export const listRoleAssignments = query({
  args: {
    userId: v.optional(v.string()),
    roleId: v.optional(v.id("roles")),
    limit: v.optional(v.number()),
  },
  returns: v.array(userRoleAssignmentValidator),
  handler: async (ctx, args) => {
    const limit = getSafeLimit(args.limit);

    if (args.userId !== undefined && args.roleId !== undefined) {
      const assignment = await getUserRoleAssignment(
        ctx,
        normalizeUserId(args.userId),
        args.roleId,
      );
      return assignment ? [assignment] : [];
    }

    if (args.userId !== undefined) {
      const userId = normalizeUserId(args.userId);
      return await ctx.db
        .query("userRoleAssignments")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .take(limit);
    }

    if (args.roleId !== undefined) {
      const roleId = args.roleId;
      return await ctx.db
        .query("userRoleAssignments")
        .withIndex("by_roleId", (q) => q.eq("roleId", roleId))
        .take(limit);
    }

    return await ctx.db.query("userRoleAssignments").take(limit);
  },
});

export const listMyAssignedRoleTests = query({
  args: {
    userId: v.string(),
  },
  returns: v.array(assignedRoleTestsValidator),
  handler: async (ctx, args) => {
    const userId = normalizeUserId(args.userId);
    const assignments = await ctx.db
      .query("userRoleAssignments")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(100);
    const roleBlocks = await Promise.all(
      assignments.map(async (assignment) => {
        const role = await ctx.db.get(assignment.roleId);

        if (!role || role.status !== "active") {
          return null;
        }

        const tests = await listActiveTestsForRole(ctx, role._id);
        const testsWithProgress = await Promise.all(
          tests.map((test) => getRoleTestWithProgress(ctx, userId, test)),
        );
        const completedTests = testsWithProgress.filter(
          (test) => test.isCompleted,
        ).length;

        return {
          role,
          assignment,
          tests: testsWithProgress,
          totalTests: testsWithProgress.length,
          completedTests,
          completionPercentage: getCompletionPercentage(
            completedTests,
            testsWithProgress.length,
          ),
        };
      }),
    );

    return roleBlocks
      .filter((block): block is NonNullable<typeof block> => block !== null)
      .sort((left, right) => left.role.order - right.role.order);
  },
});

export const getRoleTestDetail = query({
  args: {
    userId: v.string(),
    roleTestId: v.id("roleTests"),
  },
  returns: roleTestDetailValidator,
  handler: async (ctx, args) => {
    const userId = normalizeUserId(args.userId);
    const test = await requireRoleTest(ctx, args.roleTestId);
    const role = await requireRole(ctx, test.roleId);
    await requireAssignedRole(ctx, userId, role._id);
    const progress = await getRoleTestWithProgress(ctx, userId, test);

    return {
      role,
      test,
      feedback: progress.feedback,
      progress: progress.progress,
      isCompleted: progress.isCompleted,
      completedAt: progress.completedAt,
    };
  },
});

export const completeRoleTestWithFeedback = mutation({
  args: {
    userId: v.string(),
    roleTestId: v.id("roleTests"),
    rating: ratingValidator,
    note: v.string(),
  },
  returns: roleTestDetailValidator,
  handler: async (ctx, args) => {
    const userId = normalizeUserId(args.userId);
    const test = await requireRoleTest(ctx, args.roleTestId);
    const role = await requireRole(ctx, test.roleId);
    await requireAssignedRole(ctx, userId, role._id);

    if (role.status !== "active") {
      throw new Error("role is archived");
    }

    if (test.status !== "active") {
      throw new Error("test is archived");
    }

    const note = normalizeRequiredText(
      args.note,
      "feedback note is required to complete a test",
    );
    const feedback = await upsertFeedbackCore(ctx, {
      userId,
      url: test.targetUrl,
      // The target is already canonical; never strip a stored full URL.
      urlMode: "full",
      rating: args.rating,
      note,
    });
    const now = Date.now();
    const existingProgress = await getRoleTestProgress(
      ctx,
      userId,
      args.roleTestId,
    );

    if (!existingProgress) {
      await ctx.db.insert("roleTestProgress", {
        userId,
        roleTestId: args.roleTestId,
        isCompleted: true,
        feedbackThreadId: feedback.threadId,
        completedAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch("roleTestProgress", existingProgress._id, {
        isCompleted: true,
        feedbackThreadId: feedback.threadId,
        updatedAt: now,
      });
    }

    const progress = await getRoleTestWithProgress(ctx, userId, test);

    return {
      role,
      test,
      feedback: progress.feedback,
      progress: progress.progress,
      isCompleted: progress.isCompleted,
      completedAt: progress.completedAt,
    };
  },
});

export const addComment = mutation({
  args: {
    userId: v.string(),
    threadId: v.id("feedbackThreads"),
    body: v.string(),
  },
  returns: commentWithReactionsValidator,
  handler: async (ctx, args) => {
    const authorId = normalizeUserId(args.userId);
    const body = normalizeCommentBody(args.body);
    const thread = await ctx.db.get(args.threadId);

    if (!thread) {
      throw new Error("feedback thread not found");
    }

    const commentId = await ctx.db.insert("feedbackComments", {
      threadId: args.threadId,
      authorId,
      body,
      isEdited: false,
      isDeleted: false,
      createdAt: Date.now(),
      reactionCountsReady: true,
    });
    const comment = await ctx.db.get(commentId);

    if (!comment) {
      throw new Error("failed to create comment");
    }

    return {
      comment,
    };
  },
});

export const editComment = mutation({
  args: {
    userId: v.string(),
    commentId: v.id("feedbackComments"),
    body: v.string(),
  },
  returns: commentWithReactionsValidator,
  handler: async (ctx, args) => {
    const userId = normalizeUserId(args.userId);
    const comment = await requireComment(ctx, args.commentId);

    if (comment.authorId !== userId) {
      throw new Error("you can only edit your own comments");
    }

    if (comment.isDeleted) {
      throw new Error("cannot edit a deleted comment");
    }

    const body = normalizeCommentBody(args.body);
    const editedAt = Date.now();
    await ctx.db.patch("feedbackComments", args.commentId, {
      body,
      isEdited: true,
      editedAt,
    });

    return {
      comment: {
        ...comment,
        body,
        isEdited: true,
        editedAt,
      },
    };
  },
});

export const deleteComment = mutation({
  args: {
    userId: v.string(),
    commentId: v.id("feedbackComments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = normalizeUserId(args.userId);
    const comment = await requireComment(ctx, args.commentId);

    if (comment.authorId !== userId) {
      throw new Error("you can only delete your own comments");
    }

    if (comment.isDeleted) {
      await ctx.scheduler.runAfter(0, internal.lib.cleanupDeletedCommentReactions, {
        commentId: args.commentId,
      });
      return null;
    }

    await ctx.db.patch("feedbackComments", args.commentId, {
      body: "[deleted]",
      isDeleted: true,
    });
    await ctx.scheduler.runAfter(0, internal.lib.cleanupDeletedCommentReactions, {
      commentId: args.commentId,
    });

    return null;
  },
});

export const listComments = query({
  args: {
    threadId: v.id("feedbackThreads"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(feedbackCommentValidator),
  handler: (ctx, args) => ctx.db
      .query("feedbackComments")
      .withIndex("by_threadId_and_createdAt", (q) =>
        q.eq("threadId", args.threadId),
      )
      .order("asc")
      .paginate(feedbackPage(args.paginationOpts)),
});

export const getCommentReactionsPage = query({
  args: {
    commentId: v.id("feedbackComments"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(reactionFactValidator),
  handler: async (ctx, args) => {
    const comment = await requireComment(ctx, args.commentId);
    if (comment.isDeleted) return emptyPage<ReturnType<typeof mapReactionFact>>();
    const result = await ctx.db.query("feedbackReactions")
      .withIndex("by_commentId", q => q.eq("commentId", args.commentId))
      .paginate(feedbackPage(args.paginationOpts));
    return { ...result, page: result.page.map(mapReactionFact) };
  },
});

export const getCommentReactionCountsPage = query({
  args: {
    commentId: v.id("feedbackComments"),
    currentUserId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(reactionCountValidator),
  handler: async (ctx, args) => {
    const comment = await requireComment(ctx, args.commentId);
    if (comment.isDeleted) return emptyPage<Doc<"feedbackReactionCounts"> & { includesMe: boolean }>();
    if (comment.reactionCountsReady !== true) {
      return emptyPage<Doc<"feedbackReactionCounts"> & { includesMe: boolean }>();
    }
    const result = await ctx.db.query("feedbackReactionCounts")
      .withIndex("by_commentId", q => q.eq("commentId", args.commentId))
      .paginate(feedbackPage(args.paginationOpts, 4));
    const page = await Promise.all(result.page.map(async count => ({
      ...count,
      includesMe: args.currentUserId ? Boolean(await ctx.db.query("feedbackReactions")
        .withIndex("by_commentId_and_emoji_and_userId", q => q.eq("commentId", args.commentId)
          .eq("emoji", count.emoji).eq("userId", args.currentUserId!)).first()) : false,
    })));
    return { ...result, page };
  },
});

/** Historical comments remain unready until their explicit initializer finishes. */
export const getCommentReactionCountsReadiness = query({
  args: { commentId: v.id("feedbackComments") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const comment = await requireComment(ctx, args.commentId);
    return comment.isDeleted || comment.reactionCountsReady === true;
  },
});

export const toggleReaction = mutation({
  args: {
    userId: v.string(),
    commentId: v.id("feedbackComments"),
    emoji: v.string(),
  },
  returns: v.object({
    added: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = normalizeUserId(args.userId);
    const emoji = normalizeEmoji(args.emoji);
    const comment = await requireComment(ctx, args.commentId);

    if (comment.isDeleted) {
      throw new Error("cannot react to a deleted comment");
    }

    const existingReaction = await ctx.db
      .query("feedbackReactions")
      .withIndex("by_commentId_and_emoji_and_userId", (q) =>
        q.eq("commentId", args.commentId).eq("emoji", emoji).eq("userId", userId),
      )
      .unique();

    let added = false;

    if (existingReaction) {
      if (existingReaction.countedInSummary) await adjustReactionCount(ctx, args.commentId, emoji, -1);
      await ctx.db.delete(existingReaction._id);
    } else {
      await ctx.db.insert("feedbackReactions", {
        commentId: args.commentId,
        userId,
        emoji,
        createdAt: Date.now(),
        countedInSummary: true,
      });
      await adjustReactionCount(ctx, args.commentId, emoji, 1);
      added = true;
    }

    return { added };
  },
});

export const listObjectivesForUrl = query({
  args: {
    url: v.string(),
    urlMode: v.optional(v.union(v.literal("page"), v.literal("full"))),
  },
  returns: v.array(pageObjectiveValidator),
  handler: async (ctx, args) => {
    const normalizedUrl = normalizeUrl(args.url, args.urlMode);

    return await ctx.db
      .query("pageObjectives")
      .withIndex("by_normalizedUrl_and_order", (q) =>
        q.eq("normalizedUrl", normalizedUrl),
      )
      .order("asc")
      .take(100);
  },
});

export const upsertObjective = mutation({
  args: upsertObjectiveArgsValidator,
  returns: pageObjectiveValidator,
  handler: async (ctx, args) => {
    const normalizedUrl = normalizeUrl(args.url, args.urlMode);
    const description = normalizeRequiredText(
      args.description,
      "objective description is required",
    );
    const order = normalizeOrder(args.order);
    const now = Date.now();

    if (!args.objectiveId) {
      const objectiveId = await ctx.db.insert("pageObjectives", {
        normalizedUrl,
        description,
        status: args.status,
        order,
        createdAt: now,
        updatedAt: now,
      });

      return await requirePageObjective(ctx, objectiveId);
    }

    const existingObjective = await requirePageObjective(ctx, args.objectiveId);
    await ctx.db.patch("pageObjectives", args.objectiveId, {
      normalizedUrl,
      description,
      status: args.status,
      order,
      updatedAt: now,
    });

    return {
      ...existingObjective,
      normalizedUrl,
      description,
      status: args.status,
      order,
      updatedAt: now,
    };
  },
});

export const listIndicatorsForObjective = query({
  args: {
    objectiveId: v.id("pageObjectives"),
  },
  returns: v.array(objectiveIndicatorValidator),
  handler: async (ctx, args) => {
    await requirePageObjective(ctx, args.objectiveId);

    return await ctx.db
      .query("objectiveIndicators")
      .withIndex("by_objectiveId_and_order", (q) =>
        q.eq("objectiveId", args.objectiveId),
      )
      .order("asc")
      .take(100);
  },
});

export const upsertIndicator = mutation({
  args: upsertIndicatorArgsValidator,
  returns: objectiveIndicatorValidator,
  handler: async (ctx, args) => {
    await requirePageObjective(ctx, args.objectiveId);
    const description = normalizeRequiredText(
      args.description,
      "indicator description is required",
    );
    const order = normalizeOrder(args.order);
    const now = Date.now();

    if (!args.indicatorId) {
      const indicatorId = await ctx.db.insert("objectiveIndicators", {
        objectiveId: args.objectiveId,
        description,
        order,
        createdAt: now,
        updatedAt: now,
      });

      return await requireObjectiveIndicator(ctx, indicatorId);
    }

    const existingIndicator = await requireObjectiveIndicator(ctx, args.indicatorId);
    await ctx.db.patch("objectiveIndicators", args.indicatorId, {
      objectiveId: args.objectiveId,
      description,
      order,
      updatedAt: now,
    });

    return {
      ...existingIndicator,
      objectiveId: args.objectiveId,
      description,
      order,
      updatedAt: now,
    };
  },
});

export const listObjectiveComments = query({
  args: {
    objectiveId: v.id("pageObjectives"),
    limit: v.optional(v.number()),
  },
  returns: v.array(objectiveCommentValidator),
  handler: async (ctx, args) => {
    await requirePageObjective(ctx, args.objectiveId);

    return await ctx.db
      .query("objectiveComments")
      .withIndex("by_objectiveId_and_createdAt", (q) =>
        q.eq("objectiveId", args.objectiveId),
      )
      .order("asc")
      .take(getSafeLimit(args.limit));
  },
});

export const addObjectiveComment = mutation({
  args: {
    userId: v.string(),
    objectiveId: v.id("pageObjectives"),
    body: v.string(),
  },
  returns: objectiveCommentValidator,
  handler: async (ctx, args) => {
    const authorId = normalizeUserId(args.userId);
    const body = normalizeCommentBody(args.body);
    await requirePageObjective(ctx, args.objectiveId);
    const commentId = await ctx.db.insert("objectiveComments", {
      objectiveId: args.objectiveId,
      authorId,
      body,
      isEdited: false,
      isDeleted: false,
      createdAt: Date.now(),
    });

    return await requireObjectiveComment(ctx, commentId);
  },
});

export const getSettings = query({
  args: {},
  returns: settingsOutputValidator,
  handler: async (ctx) => {
    const settings = await getSettingsDocument(ctx);
    return mapSettings(settings);
  },
});

export const setSettings = mutation({
  args: {
    bugReportUrl: v.optional(nullableStringValidator),
    improvementRequestUrl: v.optional(nullableStringValidator),
    adminUserIds: v.optional(v.array(v.string())),
  },
  returns: settingsOutputValidator,
  handler: async (ctx, args) => {
    const currentSettings = await getSettingsDocument(ctx);
    const nextBugReportUrl = resolveOptionalUrlField(
      args.bugReportUrl,
      currentSettings?.bugReportUrl,
    );
    const nextImprovementRequestUrl = resolveOptionalUrlField(
      args.improvementRequestUrl,
      currentSettings?.improvementRequestUrl,
    );
    const nextAdminUserIds =
      args.adminUserIds === undefined
        ? currentSettings?.adminUserIds ?? []
        : normalizeAdminUserIds(args.adminUserIds);
    const updatedAt = Date.now();

    if (!currentSettings) {
      await ctx.db.insert(
        "settings",
        buildSettingsDocument(
          nextBugReportUrl,
          nextImprovementRequestUrl,
          nextAdminUserIds,
          updatedAt,
        ),
      );
    } else {
      await ctx.db.replace(
        "settings",
        currentSettings._id,
        buildSettingsDocument(
          nextBugReportUrl,
          nextImprovementRequestUrl,
          nextAdminUserIds,
          updatedAt,
        ),
      );
    }

    return {
      bugReportUrl: nextBugReportUrl,
      improvementRequestUrl: nextImprovementRequestUrl,
      adminUserIds: nextAdminUserIds,
      updatedAt,
    };
  },
});

function getSafeLimit(limit?: number) {
  if (!limit || limit < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(limit, 100);
}

function normalizeUserId(userId: string) {
  const normalizedUserId = userId.trim();

  if (normalizedUserId.length === 0) {
    throw new Error("userId is required");
  }

  return normalizedUserId;
}

function normalizeCommentBody(body: string) {
  return normalizeRequiredText(body, "comment body is required");
}

function normalizeEmoji(emoji: string) {
  const normalizedEmoji = emoji.trim();

  if (normalizedEmoji.length === 0) {
    throw new Error("emoji is required");
  }

  return normalizedEmoji;
}

function normalizeRequiredText(value: string, errorMessage: string) {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new Error(errorMessage);
  }

  return normalizedValue;
}

function normalizeOptionalText(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length === 0 ? undefined : normalizedValue;
}

function normalizeAdminUserIds(userIds: string[]) {
  return Array.from(
    new Set(
      userIds
        .map((userId) => userId.trim())
        .filter((userId) => userId.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function normalizeOrder(order: number) {
  if (!Number.isInteger(order) || order < 0) {
    throw new Error("order must be a non-negative integer");
  }

  return order;
}

async function getFeedbackThread(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  normalizedUrl: string,
) {
  return await ctx.db
    .query("feedbackThreads")
    .withIndex("by_userId_and_normalizedUrl", (q) =>
      q.eq("userId", userId).eq("normalizedUrl", normalizedUrl),
    )
    .unique();
}

async function upsertFeedbackCore(
  ctx: MutationCtx,
  args: {
    userId: string;
    url: string;
    urlMode?: UrlMode;
    rating: 1 | 2 | 3;
    note: string;
  },
) {
  const userId = normalizeUserId(args.userId);
  const normalizedUrl = normalizeUrl(args.url, args.urlMode);
  const note = args.note.trim();
  const now = Date.now();
  const existingThread = await getFeedbackThread(ctx, userId, normalizedUrl);

  if (!existingThread) {
    const threadId = await ctx.db.insert("feedbackThreads", {
      userId,
      normalizedUrl,
      latestVersion: 1,
      latestRating: args.rating,
      latestNote: note,
      isSolved: false,
      updatedAt: now,
    });

    await ctx.db.insert("feedbackVersions", {
      threadId,
      version: 1,
      rating: args.rating,
      note,
      userId,
      normalizedUrl,
    });

    return {
      threadId,
      version: 1,
      rating: args.rating,
      note,
      isSolved: false,
      userId,
      normalizedUrl,
      updatedAt: now,
    };
  }

  const nextVersion = existingThread.latestVersion + 1;

  await ctx.db.patch("feedbackThreads", existingThread._id, {
    latestVersion: nextVersion,
    latestRating: args.rating,
    latestNote: note,
    updatedAt: now,
  });

  await ctx.db.insert("feedbackVersions", {
    threadId: existingThread._id,
    version: nextVersion,
    rating: args.rating,
    note,
    userId,
    normalizedUrl,
  });

  return {
    threadId: existingThread._id,
    version: nextVersion,
    rating: args.rating,
    note,
    isSolved: existingThread.isSolved ?? false,
    userId,
    normalizedUrl,
    updatedAt: now,
  };
}

async function getSettingsDocument(ctx: QueryCtx | MutationCtx) {
  return await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
    .unique();
}

async function requireRole(
  ctx: QueryCtx | MutationCtx,
  roleId: Doc<"roles">["_id"],
) {
  const role = await ctx.db.get(roleId);

  if (!role) {
    throw new Error("role not found");
  }

  return role;
}

async function requireRoleTest(
  ctx: QueryCtx | MutationCtx,
  roleTestId: Doc<"roleTests">["_id"],
) {
  const roleTest = await ctx.db.get(roleTestId);

  if (!roleTest) {
    throw new Error("role test not found");
  }

  return roleTest;
}

async function requireUserRoleAssignment(
  ctx: QueryCtx | MutationCtx,
  assignmentId: Doc<"userRoleAssignments">["_id"],
) {
  const assignment = await ctx.db.get(assignmentId);

  if (!assignment) {
    throw new Error("role assignment not found");
  }

  return assignment;
}

async function requireAssignedRole(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  roleId: Doc<"roles">["_id"],
) {
  const assignment = await getUserRoleAssignment(ctx, userId, roleId);

  if (!assignment) {
    throw new Error("role is not assigned to this user");
  }

  return assignment;
}

async function getUserRoleAssignment(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  roleId: Doc<"roles">["_id"],
) {
  return await ctx.db
    .query("userRoleAssignments")
    .withIndex("by_userId_and_roleId", (q) =>
      q.eq("userId", userId).eq("roleId", roleId),
    )
    .unique();
}

async function listActiveTestsForRole(
  ctx: QueryCtx | MutationCtx,
  roleId: Doc<"roles">["_id"],
) {
  return await ctx.db
    .query("roleTests")
    .withIndex("by_roleId_and_status_and_order", (q) =>
      q.eq("roleId", roleId).eq("status", "active"),
    )
    .order("asc")
    .take(100);
}

async function getRoleTestProgress(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  roleTestId: Doc<"roleTests">["_id"],
) {
  return await ctx.db
    .query("roleTestProgress")
    .withIndex("by_userId_and_roleTestId", (q) =>
      q.eq("userId", userId).eq("roleTestId", roleTestId),
    )
    .unique();
}

async function getRoleTestWithProgress(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  test: Doc<"roleTests">,
) {
  const progress = await getRoleTestProgress(ctx, userId, test._id);
  const feedbackThread = await getFeedbackThread(ctx, userId, test.targetUrl);

  return {
    test,
    feedback: feedbackThread ? mapThreadToLatestFeedback(feedbackThread) : null,
    progress,
    isCompleted: progress?.isCompleted ?? false,
    completedAt: progress?.isCompleted ? progress.completedAt : null,
  };
}

function getCompletionPercentage(completedTests: number, totalTests: number) {
  if (totalTests === 0) {
    return 0;
  }

  return Math.round((completedTests / totalTests) * 100);
}

async function requireComment(
  ctx: QueryCtx | MutationCtx,
  commentId: Doc<"feedbackComments">["_id"],
) {
  const comment = await ctx.db.get(commentId);

  if (!comment) {
    throw new Error("comment not found");
  }

  return comment;
}

async function requirePageObjective(
  ctx: QueryCtx | MutationCtx,
  objectiveId: Doc<"pageObjectives">["_id"],
) {
  const objective = await ctx.db.get(objectiveId);

  if (!objective) {
    throw new Error("objective not found");
  }

  return objective;
}

async function requireObjectiveIndicator(
  ctx: QueryCtx | MutationCtx,
  indicatorId: Doc<"objectiveIndicators">["_id"],
) {
  const indicator = await ctx.db.get(indicatorId);

  if (!indicator) {
    throw new Error("indicator not found");
  }

  return indicator;
}

async function requireObjectiveComment(
  ctx: QueryCtx | MutationCtx,
  commentId: Doc<"objectiveComments">["_id"],
) {
  const comment = await ctx.db.get(commentId);

  if (!comment) {
    throw new Error("objective comment not found");
  }

  return comment;
}

async function adjustReactionCount(
  ctx: MutationCtx,
  commentId: Doc<"feedbackComments">["_id"],
  emoji: string,
  delta: 1 | -1,
) {
  const existing = await ctx.db.query("feedbackReactionCounts")
    .withIndex("by_commentId_and_emoji", q => q.eq("commentId", commentId).eq("emoji", emoji)).first();
  if (!existing) {
    if (delta < 0) throw new Error("reaction count is missing");
    await ctx.db.insert("feedbackReactionCounts", { commentId, emoji, count: 1 });
  } else if (existing.count + delta === 0) {
    await ctx.db.delete(existing._id);
  } else {
    await ctx.db.patch(existing._id, { count: existing.count + delta });
  }
}

/** Explicit, resumable historical initializer. Never scheduled automatically. */
export const initializeCommentReactionCountsStep = internalMutation({
  args: { commentId: v.id("feedbackComments") },
  returns: v.object({ processed: v.number(), done: v.boolean() }),
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment || comment.isDeleted || comment.reactionCountsReady) return { processed: 0, done: true };
    const batch = await ctx.db.query("feedbackReactions")
      .withIndex("by_commentId_and_counted", q => q.eq("commentId", args.commentId).eq("countedInSummary", undefined))
      .paginate({ numItems: 20, cursor: null, maximumRowsRead: 20, maximumBytesRead: 2_000_000 });
    for (const reaction of batch.page) {
      await adjustReactionCount(ctx, args.commentId, reaction.emoji, 1);
      await ctx.db.patch(reaction._id, { countedInSummary: true });
    }
    if (batch.isDone) await ctx.db.patch(args.commentId, { reactionCountsReady: true });
    return { processed: batch.page.length, done: batch.isDone };
  },
});

/** Tombstone is public immediately; private reaction rows are removed in bounded steps. */
export const cleanupDeletedCommentReactions = internalMutation({
  args: { commentId: v.id("feedbackComments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment?.isDeleted) return null;
    const reactions = await ctx.db.query("feedbackReactions")
      .withIndex("by_commentId", q => q.eq("commentId", args.commentId))
      .paginate({ numItems: 20, cursor: null, maximumRowsRead: 20, maximumBytesRead: 2_000_000 });
    if (reactions.page.length > 0) {
      for (const reaction of reactions.page) await ctx.db.delete(reaction._id);
      await ctx.scheduler.runAfter(0, internal.lib.cleanupDeletedCommentReactions, args);
      return null;
    }
    const counts = await ctx.db.query("feedbackReactionCounts")
      .withIndex("by_commentId", q => q.eq("commentId", args.commentId))
      .paginate({ numItems: 20, cursor: null, maximumRowsRead: 20, maximumBytesRead: 2_000_000 });
    for (const count of counts.page) await ctx.db.delete(count._id);
    if (!counts.isDone) await ctx.scheduler.runAfter(0, internal.lib.cleanupDeletedCommentReactions, args);
    return null;
  },
});

function mapThreadToLatestFeedback(thread: Doc<"feedbackThreads">) {
  return {
    threadId: thread._id,
    version: thread.latestVersion,
    rating: thread.latestRating,
    note: thread.latestNote,
    isSolved: thread.isSolved ?? false,
    userId: thread.userId,
    normalizedUrl: thread.normalizedUrl,
    updatedAt: thread.updatedAt,
  };
}

function mapSettings(
  settings:
    | {
        bugReportUrl?: string;
        improvementRequestUrl?: string;
        adminUserIds?: string[];
        updatedAt: number;
      }
    | null,
) {
  return {
    bugReportUrl: settings?.bugReportUrl ?? null,
    improvementRequestUrl: settings?.improvementRequestUrl ?? null,
    adminUserIds: settings?.adminUserIds ?? [],
    updatedAt: settings?.updatedAt ?? null,
  };
}

function resolveOptionalUrlField(
  nextValue: string | null | undefined,
  currentValue: string | undefined,
) {
  if (nextValue === undefined) {
    return currentValue ?? null;
  }

  if (nextValue === null) {
    return null;
  }

  const normalizedValue = nextValue.trim();

  if (normalizedValue.length === 0) {
    return null;
  }

  return normalizedValue;
}

function buildSettingsDocument(
  bugReportUrl: string | null,
  improvementRequestUrl: string | null,
  adminUserIds: string[],
  updatedAt: number,
) {
  const settingsDocument: {
    key: string;
    updatedAt: number;
    bugReportUrl?: string;
    improvementRequestUrl?: string;
    adminUserIds?: string[];
  } = {
    key: SETTINGS_KEY,
    updatedAt,
    adminUserIds,
  };

  if (bugReportUrl !== null) {
    settingsDocument.bugReportUrl = bugReportUrl;
  }

  if (improvementRequestUrl !== null) {
    settingsDocument.improvementRequestUrl = improvementRequestUrl;
  }

  return settingsDocument;
}
