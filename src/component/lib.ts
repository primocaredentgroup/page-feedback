import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import type { Doc } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import schema from "./schema.js";

const SETTINGS_KEY = "global";
const DEFAULT_LIMIT = 50;

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

const feedbackVersionValidator = schema.tables.feedbackVersions.validator.extend({
  _id: v.id("feedbackVersions"),
  _creationTime: v.number(),
});

const feedbackCommentValidator = schema.tables.feedbackComments.validator.extend({
  _id: v.id("feedbackComments"),
  _creationTime: v.number(),
});

const pageObjectiveValidator = schema.tables.pageObjectives.validator.extend({
  _id: v.id("pageObjectives"),
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

const reactionSummaryValidator = v.object({
  emoji: v.string(),
  count: v.number(),
  users: v.array(v.string()),
  includesMe: v.boolean(),
});

const commentWithReactionsValidator = v.object({
  comment: feedbackCommentValidator,
  reactions: v.array(reactionSummaryValidator),
});

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
  updatedAt: v.union(v.number(), v.null()),
});

const upsertObjectiveArgsValidator = {
  objectiveId: v.optional(v.id("pageObjectives")),
  url: v.string(),
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

export const upsertFeedback = mutation({
  args: {
    userId: v.string(),
    url: v.string(),
    rating: ratingValidator,
    note: v.string(),
  },
  returns: latestFeedbackValidator,
  handler: async (ctx, args) => {
    const userId = normalizeUserId(args.userId);
    const normalizedUrl = normalizeUrl(args.url);
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
  },
  returns: v.union(v.null(), latestFeedbackValidator),
  handler: async (ctx, args) => {
    const userId = normalizeUserId(args.userId);
    const normalizedUrl = normalizeUrl(args.url);
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
    limit: v.optional(v.number()),
  },
  returns: v.array(feedbackVersionValidator),
  handler: async (ctx, args) => {
    const userId = normalizeUserId(args.userId);
    const normalizedUrl = normalizeUrl(args.url);
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
    limit: v.optional(v.number()),
  },
  returns: v.array(latestFeedbackValidator),
  handler: async (ctx, args) => {
    const normalizedUrl = normalizeUrl(args.url);
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
    });
    const comment = await ctx.db.get(commentId);

    if (!comment) {
      throw new Error("failed to create comment");
    }

    return {
      comment,
      reactions: [],
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
      reactions: await getCommentReactionSummaries(ctx, args.commentId, userId),
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
      return null;
    }

    await ctx.db.patch("feedbackComments", args.commentId, {
      body: "[deleted]",
      isDeleted: true,
    });
    await deleteCommentReactions(ctx, args.commentId);

    return null;
  },
});

export const listComments = query({
  args: {
    threadId: v.id("feedbackThreads"),
    limit: v.optional(v.number()),
    currentUserId: v.optional(v.string()),
  },
  returns: v.array(commentWithReactionsValidator),
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("feedbackComments")
      .withIndex("by_threadId_and_createdAt", (q) =>
        q.eq("threadId", args.threadId),
      )
      .order("asc")
      .take(getSafeLimit(args.limit));

    return await Promise.all(
      comments.map(async (comment) => ({
        comment,
        reactions: await getCommentReactionSummaries(
          ctx,
          comment._id,
          args.currentUserId,
        ),
      })),
    );
  },
});

export const getCommentReactions = query({
  args: {
    commentId: v.id("feedbackComments"),
    currentUserId: v.optional(v.string()),
  },
  returns: v.array(reactionSummaryValidator),
  handler: async (ctx, args) => {
    await requireComment(ctx, args.commentId);
    return await getCommentReactionSummaries(
      ctx,
      args.commentId,
      args.currentUserId,
    );
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
    reactions: v.array(reactionSummaryValidator),
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
      await ctx.db.delete(existingReaction._id);
    } else {
      await ctx.db.insert("feedbackReactions", {
        commentId: args.commentId,
        userId,
        emoji,
        createdAt: Date.now(),
      });
      added = true;
    }

    return {
      added,
      reactions: await getCommentReactionSummaries(ctx, args.commentId, userId),
    };
  },
});

export const listObjectivesForUrl = query({
  args: {
    url: v.string(),
  },
  returns: v.array(pageObjectiveValidator),
  handler: async (ctx, args) => {
    const normalizedUrl = normalizeUrl(args.url);

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
    const normalizedUrl = normalizeUrl(args.url);
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
    const updatedAt = Date.now();

    if (!currentSettings) {
      await ctx.db.insert(
        "settings",
        buildSettingsDocument(
          nextBugReportUrl,
          nextImprovementRequestUrl,
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
          updatedAt,
        ),
      );
    }

    return {
      bugReportUrl: nextBugReportUrl,
      improvementRequestUrl: nextImprovementRequestUrl,
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

function normalizeOrder(order: number) {
  if (!Number.isInteger(order) || order < 0) {
    throw new Error("order must be a non-negative integer");
  }

  return order;
}

function normalizeUrl(url: string) {
  const trimmedUrl = url.trim();
  const normalizedUrl = trimmedUrl.split("?")[0]?.trim() ?? "";

  if (normalizedUrl.length === 0) {
    throw new Error("url is required");
  }

  return normalizedUrl;
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

async function getSettingsDocument(ctx: QueryCtx | MutationCtx) {
  return await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
    .unique();
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

async function deleteCommentReactions(
  ctx: MutationCtx,
  commentId: Doc<"feedbackComments">["_id"],
) {
  const reactions = await ctx.db
    .query("feedbackReactions")
    .withIndex("by_commentId", (q) => q.eq("commentId", commentId))
    .collect();

  for (const reaction of reactions) {
    await ctx.db.delete(reaction._id);
  }
}

async function getCommentReactionSummaries(
  ctx: QueryCtx | MutationCtx,
  commentId: Doc<"feedbackComments">["_id"],
  currentUserId?: string,
) {
  const reactions = await ctx.db
    .query("feedbackReactions")
    .withIndex("by_commentId", (q) => q.eq("commentId", commentId))
    .collect();
  const reactionsByEmoji = new Map<
    string,
    {
      count: number;
      users: string[];
    }
  >();

  for (const reaction of reactions) {
    const existingSummary = reactionsByEmoji.get(reaction.emoji);

    if (!existingSummary) {
      reactionsByEmoji.set(reaction.emoji, {
        count: 1,
        users: [reaction.userId],
      });
      continue;
    }

    existingSummary.count += 1;
    existingSummary.users.push(reaction.userId);
  }

  return Array.from(reactionsByEmoji.entries())
    .sort(([leftEmoji], [rightEmoji]) => leftEmoji.localeCompare(rightEmoji))
    .map(([emoji, summary]) => ({
      emoji,
      count: summary.count,
      users: summary.users,
      includesMe: currentUserId ? summary.users.includes(currentUserId) : false,
    }));
}

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
        updatedAt: number;
      }
    | null,
) {
  return {
    bugReportUrl: settings?.bugReportUrl ?? null,
    improvementRequestUrl: settings?.improvementRequestUrl ?? null,
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
  updatedAt: number,
) {
  const settingsDocument: {
    key: string;
    updatedAt: number;
    bugReportUrl?: string;
    improvementRequestUrl?: string;
  } = {
    key: SETTINGS_KEY,
    updatedAt,
  };

  if (bugReportUrl !== null) {
    settingsDocument.bugReportUrl = bugReportUrl;
  }

  if (improvementRequestUrl !== null) {
    settingsDocument.improvementRequestUrl = improvementRequestUrl;
  }

  return settingsDocument;
}
