import { httpActionGeneric, mutationGeneric, queryGeneric } from "convex/server";
import type { Auth, HttpRouter } from "convex/server";
import { v } from "convex/values";
import type { ComponentApi } from "../component/_generated/component.js";

const ratingValidator = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(3),
);

const nullableStringValidator = v.union(v.string(), v.null());

type UserOperation =
  | { type: "readMyFeedback"; normalizedUrl: string }
  | { type: "readObjectives"; normalizedUrl: string }
  | { type: "readMyFeedbackThreads" }
  | { type: "writeFeedback"; normalizedUrl: string }
  | { type: "readFeedbackVersions"; normalizedUrl: string }
  | { type: "readComments"; threadId: string }
  | { type: "readObjectiveComments"; objectiveId: string }
  | { type: "readCommentReactions"; commentId: string }
  | { type: "writeComment"; threadId: string }
  | { type: "writeObjectiveComment"; objectiveId: string }
  | { type: "editComment"; commentId: string }
  | { type: "deleteComment"; commentId: string }
  | { type: "reactToComment"; commentId: string };

export function exposeApi(
  component: ComponentApi,
  options: {
    auth: (ctx: { auth: Auth }, operation: UserOperation) => Promise<string>;
    adminAuth?: (ctx: { auth: Auth }) => Promise<void>;
  },
) {
  return {
    getMyFeedback: queryGeneric({
      args: { url: v.string() },
      handler: async (ctx, args) => {
        const normalizedUrl = normalizeFeedbackUrl(args.url);
        const userId = await options.auth(ctx, {
          type: "readMyFeedback",
          normalizedUrl,
        });

        return await ctx.runQuery(component.lib.getMyFeedback, {
          userId,
          url: normalizedUrl,
        });
      },
    }),

    upsertFeedback: mutationGeneric({
      args: {
        url: v.string(),
        rating: ratingValidator,
        note: v.string(),
      },
      handler: async (ctx, args) => {
        const normalizedUrl = normalizeFeedbackUrl(args.url);
        const userId = await options.auth(ctx, {
          type: "writeFeedback",
          normalizedUrl,
        });

        return await ctx.runMutation(component.lib.upsertFeedback, {
          userId,
          url: normalizedUrl,
          rating: args.rating,
          note: args.note,
        });
      },
    }),

    listFeedbackVersions: queryGeneric({
      args: {
        url: v.string(),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        const normalizedUrl = normalizeFeedbackUrl(args.url);
        const userId = await options.auth(ctx, {
          type: "readFeedbackVersions",
          normalizedUrl,
        });

        return await ctx.runQuery(component.lib.listFeedbackVersions, {
          userId,
          url: normalizedUrl,
          limit: args.limit,
        });
      },
    }),

    listLatestFeedbackForUrl: queryGeneric({
      args: {
        url: v.string(),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.lib.listLatestFeedbackForUrl, {
          url: normalizeFeedbackUrl(args.url),
          limit: args.limit,
        });
      },
    }),

    listObjectivesForUrl: queryGeneric({
      args: {
        url: v.string(),
      },
      handler: async (ctx, args) => {
        const normalizedUrl = normalizeFeedbackUrl(args.url);
        await options.auth(ctx, {
          type: "readObjectives",
          normalizedUrl,
        });

        return await ctx.runQuery(component.lib.listObjectivesForUrl, {
          url: normalizedUrl,
        });
      },
    }),

    upsertObjective: mutationGeneric({
      args: {
        objectiveId: v.optional(v.string()),
        url: v.string(),
        description: v.string(),
        status: v.union(v.literal("active"), v.literal("archived")),
        order: v.number(),
      },
      handler: async (ctx, args) => {
        await requireAdminAuth(options, ctx);

        return await ctx.runMutation(component.lib.upsertObjective, {
          objectiveId: args.objectiveId,
          url: normalizeFeedbackUrl(args.url),
          description: args.description,
          status: args.status,
          order: args.order,
        });
      },
    }),

    listIndicatorsForObjective: queryGeneric({
      args: {
        objectiveId: v.string(),
      },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.lib.listIndicatorsForObjective, {
          objectiveId: args.objectiveId,
        });
      },
    }),

    upsertIndicator: mutationGeneric({
      args: {
        indicatorId: v.optional(v.string()),
        objectiveId: v.string(),
        description: v.string(),
        order: v.number(),
      },
      handler: async (ctx, args) => {
        await requireAdminAuth(options, ctx);

        return await ctx.runMutation(component.lib.upsertIndicator, {
          indicatorId: args.indicatorId,
          objectiveId: args.objectiveId,
          description: args.description,
          order: args.order,
        });
      },
    }),

    listMyFeedbackThreads: queryGeneric({
      args: {
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        const userId = await options.auth(ctx, {
          type: "readMyFeedbackThreads",
        });

        return await ctx.runQuery(component.lib.listMyFeedbackThreads, {
          userId,
          limit: args.limit,
        });
      },
    }),

    listComments: queryGeneric({
      args: {
        threadId: v.string(),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        const userId = await options.auth(ctx, {
          type: "readComments",
          threadId: args.threadId,
        });

        return await ctx.runQuery(component.lib.listComments, {
          threadId: args.threadId,
          limit: args.limit,
          currentUserId: userId,
        });
      },
    }),

    listObjectiveComments: queryGeneric({
      args: {
        objectiveId: v.string(),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, {
          type: "readObjectiveComments",
          objectiveId: args.objectiveId,
        });

        return await ctx.runQuery(component.lib.listObjectiveComments, {
          objectiveId: args.objectiveId,
          limit: args.limit,
        });
      },
    }),

    addComment: mutationGeneric({
      args: {
        threadId: v.string(),
        body: v.string(),
      },
      handler: async (ctx, args) => {
        const userId = await options.auth(ctx, {
          type: "writeComment",
          threadId: args.threadId,
        });

        return await ctx.runMutation(component.lib.addComment, {
          userId,
          threadId: args.threadId,
          body: args.body,
        });
      },
    }),

    addObjectiveComment: mutationGeneric({
      args: {
        objectiveId: v.string(),
        body: v.string(),
      },
      handler: async (ctx, args) => {
        const userId = await options.auth(ctx, {
          type: "writeObjectiveComment",
          objectiveId: args.objectiveId,
        });

        return await ctx.runMutation(component.lib.addObjectiveComment, {
          userId,
          objectiveId: args.objectiveId,
          body: args.body,
        });
      },
    }),

    editComment: mutationGeneric({
      args: {
        commentId: v.string(),
        body: v.string(),
      },
      handler: async (ctx, args) => {
        const userId = await options.auth(ctx, {
          type: "editComment",
          commentId: args.commentId,
        });

        return await ctx.runMutation(component.lib.editComment, {
          userId,
          commentId: args.commentId,
          body: args.body,
        });
      },
    }),

    deleteComment: mutationGeneric({
      args: {
        commentId: v.string(),
      },
      handler: async (ctx, args) => {
        const userId = await options.auth(ctx, {
          type: "deleteComment",
          commentId: args.commentId,
        });

        return await ctx.runMutation(component.lib.deleteComment, {
          userId,
          commentId: args.commentId,
        });
      },
    }),

    getCommentReactions: queryGeneric({
      args: {
        commentId: v.string(),
      },
      handler: async (ctx, args) => {
        const userId = await options.auth(ctx, {
          type: "readCommentReactions",
          commentId: args.commentId,
        });

        return await ctx.runQuery(component.lib.getCommentReactions, {
          commentId: args.commentId,
          currentUserId: userId,
        });
      },
    }),

    toggleReaction: mutationGeneric({
      args: {
        commentId: v.string(),
        emoji: v.string(),
      },
      handler: async (ctx, args) => {
        const userId = await options.auth(ctx, {
          type: "reactToComment",
          commentId: args.commentId,
        });

        return await ctx.runMutation(component.lib.toggleReaction, {
          userId,
          commentId: args.commentId,
          emoji: args.emoji,
        });
      },
    }),

    getSettings: queryGeneric({
      args: {},
      handler: async (ctx) => {
        return await ctx.runQuery(component.lib.getSettings, {});
      },
    }),

    setSettings: mutationGeneric({
      args: {
        bugReportUrl: v.optional(nullableStringValidator),
        improvementRequestUrl: v.optional(nullableStringValidator),
      },
      handler: async (ctx, args) => {
        await requireAdminAuth(options, ctx);

        return await ctx.runMutation(component.lib.setSettings, args);
      },
    }),
  };
}

export function registerRoutes(
  http: HttpRouter,
  component: ComponentApi,
  { pathPrefix = "/feedback" }: { pathPrefix?: string } = {},
) {
  http.route({
    path: `${pathPrefix}/latest`,
    method: "GET",
    handler: httpActionGeneric(async (ctx, request) => {
      const requestUrl = new URL(request.url);
      const url = requestUrl.searchParams.get("url");
      const limitParam = requestUrl.searchParams.get("limit");

      if (!url) {
        return jsonResponse(
          { error: "url query parameter is required" },
          400,
        );
      }

      const limit = parseLimit(limitParam);
      const feedback = await ctx.runQuery(component.lib.listLatestFeedbackForUrl, {
        url: normalizeFeedbackUrl(url),
        limit,
      });

      return jsonResponse(feedback, 200);
    }),
  });
}

export function normalizeFeedbackUrl(url: string) {
  const normalizedUrl = url.trim().split("?")[0]?.trim() ?? "";

  if (normalizedUrl.length === 0) {
    throw new Error("url is required");
  }

  return normalizedUrl;
}

async function requireAdminAuth(
  options: {
    adminAuth?: (ctx: { auth: Auth }) => Promise<void>;
  },
  ctx: { auth: Auth },
) {
  if (!options.adminAuth) {
    throw new Error("adminAuth is required to expose setSettings");
  }

  await options.adminAuth(ctx);
}

function parseLimit(limitParam: string | null) {
  if (limitParam === null) {
    return undefined;
  }

  const parsedLimit = Number.parseInt(limitParam, 10);

  if (Number.isNaN(parsedLimit)) {
    return undefined;
  }

  return parsedLimit;
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
