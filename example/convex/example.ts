import { mutation, query } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import { exposeApi } from "@okrlinkhub/page-feedback";
import { v } from "convex/values";
import type { Auth } from "convex/server";

const ratingValidator = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(3),
);

const nullableStringValidator = v.union(v.string(), v.null());

export const upsertPageFeedback = mutation({
  args: {
    url: v.string(),
    rating: ratingValidator,
    note: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.pageFeedback.lib.upsertFeedback, {
      userId: await getAuthUserId(ctx),
      url: args.url,
      rating: args.rating,
      note: args.note,
    });
  },
});

export const getMyPageFeedback = query({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.pageFeedback.lib.getMyFeedback, {
      userId: await getAuthUserId(ctx),
      url: args.url,
    });
  },
});

export const listPageFeedback = query({
  args: {
    url: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.pageFeedback.lib.listLatestFeedbackForUrl, {
      url: args.url,
      limit: args.limit,
    });
  },
});

export const listThreadComments = query({
  args: {
    threadId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.pageFeedback.lib.listComments, {
      threadId: args.threadId,
      limit: args.limit,
      currentUserId: await getAuthUserId(ctx),
    });
  },
});

export const addThreadComment = mutation({
  args: {
    threadId: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.pageFeedback.lib.addComment, {
      userId: await getAuthUserId(ctx),
      threadId: args.threadId,
      body: args.body,
    });
  },
});

export const toggleThreadCommentReaction = mutation({
  args: {
    commentId: v.string(),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.pageFeedback.lib.toggleReaction, {
      userId: await getAuthUserId(ctx),
      commentId: args.commentId,
      emoji: args.emoji,
    });
  },
});

export const getPageFeedbackSettings = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.runQuery(components.pageFeedback.lib.getSettings, {});
  },
});

export const setPageFeedbackSettings = mutation({
  args: {
    bugReportUrl: v.optional(nullableStringValidator),
    improvementRequestUrl: v.optional(nullableStringValidator),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.runMutation(components.pageFeedback.lib.setSettings, args);
  },
});

export const {
  getMyFeedback,
  upsertFeedback,
  listFeedbackVersions,
  listLatestFeedbackForUrl,
  listMyFeedbackThreads,
  listComments,
  addComment,
  toggleReaction,
  getSettings,
  setSettings,
} = exposeApi(components.pageFeedback, {
  auth: async (ctx) => {
    return await getAuthUserId(ctx);
  },
  adminAuth: async (ctx) => {
    await requireAdmin(ctx);
  },
});

async function getAuthUserId(ctx: { auth: Auth }) {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.tokenIdentifier ?? "demo-user";
}

async function requireAdmin(ctx: { auth: Auth }) {
  await getAuthUserId(ctx);
}
