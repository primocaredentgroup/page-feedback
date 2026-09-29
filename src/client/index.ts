import { httpActionGeneric, mutationGeneric, queryGeneric } from "convex/server";
import type { Auth, HttpRouter } from "convex/server";
import { v } from "convex/values";
import type { ComponentApi } from "../component/_generated/component.js";
export { PageFeedbackClient } from "./registry.js";

const ratingValidator = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(3),
);

const nullableStringValidator = v.union(v.string(), v.null());
const roleOutputValidator = v.object({
  _id: v.string(),
  _creationTime: v.number(),
  name: v.string(),
  description: v.optional(v.string()),
  status: v.union(v.literal("active"), v.literal("archived")),
  order: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
});
const roleTestOutputValidator = v.object({
  _id: v.string(),
  _creationTime: v.number(),
  roleId: v.string(),
  title: v.string(),
  description: v.string(),
  targetUrl: v.string(),
  videoUrl: v.optional(v.string()),
  status: v.union(v.literal("active"), v.literal("archived")),
  order: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
});
const roleAssignmentOutputValidator = v.object({
  _id: v.string(),
  _creationTime: v.number(),
  userId: v.string(),
  roleId: v.string(),
  createdAt: v.number(),
});
const roleTestProgressOutputValidator = v.object({
  _id: v.string(),
  _creationTime: v.number(),
  userId: v.string(),
  roleTestId: v.string(),
  isCompleted: v.boolean(),
  feedbackThreadId: v.string(),
  completedAt: v.number(),
  updatedAt: v.number(),
});
const latestFeedbackOutputValidator = v.object({
  threadId: v.string(),
  version: v.number(),
  rating: ratingValidator,
  note: v.string(),
  isSolved: v.boolean(),
  userId: v.string(),
  normalizedUrl: v.string(),
  updatedAt: v.number(),
});
const roleTestWithProgressOutputValidator = v.object({
  test: roleTestOutputValidator,
  feedback: v.union(v.null(), latestFeedbackOutputValidator),
  progress: v.union(v.null(), roleTestProgressOutputValidator),
  isCompleted: v.boolean(),
  completedAt: v.union(v.number(), v.null()),
});
const assignedRoleTestsOutputValidator = v.object({
  role: roleOutputValidator,
  assignment: roleAssignmentOutputValidator,
  tests: v.array(roleTestWithProgressOutputValidator),
  totalTests: v.number(),
  completedTests: v.number(),
  completionPercentage: v.number(),
});
const roleTestDetailOutputValidator = v.object({
  role: roleOutputValidator,
  test: roleTestOutputValidator,
  feedback: v.union(v.null(), latestFeedbackOutputValidator),
  progress: v.union(v.null(), roleTestProgressOutputValidator),
  isCompleted: v.boolean(),
  completedAt: v.union(v.number(), v.null()),
});
const settingsOutputValidator = v.object({
  bugReportUrl: nullableStringValidator,
  improvementRequestUrl: nullableStringValidator,
  adminUserIds: v.array(v.string()),
  updatedAt: v.union(v.number(), v.null()),
});

type UserOperation =
  | { type: "readMyFeedback"; normalizedUrl: string }
  | { type: "readObjectives"; normalizedUrl: string }
  | { type: "readMyFeedbackThreads" }
  | { type: "readMyRoleTests" }
  | { type: "readRoleTestDetail"; roleTestId: string }
  | { type: "writeFeedback"; normalizedUrl: string }
  | { type: "completeRoleTest"; roleTestId: string }
  | { type: "manageSettings" }
  | { type: "manageRoles" }
  | { type: "manageObjectives"; normalizedUrl?: string; objectiveId?: string }
  | { type: "manageRoleTests"; roleId?: string; roleTestId?: string }
  | { type: "assignRole"; roleId: string; userId: string }
  | { type: "setFeedbackSolved"; threadId: string }
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

    setFeedbackSolved: mutationGeneric({
      args: {
        threadId: v.string(),
        isSolved: v.boolean(),
      },
      handler: async (ctx, args) => {
        const userId = await options.auth(ctx, {
          type: "setFeedbackSolved",
          threadId: args.threadId,
        });

        return await ctx.runMutation(component.lib.setFeedbackSolved, {
          userId,
          threadId: args.threadId,
          isSolved: args.isSolved,
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
        await requireAdminAuth(options, component, ctx, {
          type: "manageObjectives",
          normalizedUrl: normalizeFeedbackUrl(args.url),
        });

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
        await requireAdminAuth(options, component, ctx, {
          type: "manageObjectives",
          objectiveId: args.objectiveId,
        });

        return await ctx.runMutation(component.lib.upsertIndicator, {
          indicatorId: args.indicatorId,
          objectiveId: args.objectiveId,
          description: args.description,
          order: args.order,
        });
      },
    }),

    listRoles: queryGeneric({
      args: {
        limit: v.optional(v.number()),
      },
      returns: v.array(roleOutputValidator),
      handler: async (ctx, args) => {
        await requireAdminAuth(options, component, ctx, { type: "manageRoles" });

        return await ctx.runQuery(component.lib.listRoles, {
          limit: args.limit,
        });
      },
    }),

    upsertRole: mutationGeneric({
      args: {
        roleId: v.optional(v.string()),
        name: v.string(),
        description: v.optional(nullableStringValidator),
        status: v.union(v.literal("active"), v.literal("archived")),
        order: v.number(),
      },
      returns: roleOutputValidator,
      handler: async (ctx, args) => {
        await requireAdminAuth(options, component, ctx, { type: "manageRoles" });

        return await ctx.runMutation(component.lib.upsertRole, args);
      },
    }),

    archiveRole: mutationGeneric({
      args: {
        roleId: v.string(),
      },
      returns: roleOutputValidator,
      handler: async (ctx, args) => {
        await requireAdminAuth(options, component, ctx, { type: "manageRoles" });

        return await ctx.runMutation(component.lib.archiveRole, {
          roleId: args.roleId,
        });
      },
    }),

    listRoleTestsForRole: queryGeneric({
      args: {
        roleId: v.string(),
        limit: v.optional(v.number()),
      },
      returns: v.array(roleTestOutputValidator),
      handler: async (ctx, args) => {
        await requireAdminAuth(options, component, ctx, {
          type: "manageRoleTests",
          roleId: args.roleId,
        });

        return await ctx.runQuery(component.lib.listRoleTestsForRole, {
          roleId: args.roleId,
          limit: args.limit,
        });
      },
    }),

    upsertRoleTest: mutationGeneric({
      args: {
        roleTestId: v.optional(v.string()),
        roleId: v.string(),
        title: v.string(),
        description: v.string(),
        targetUrl: v.string(),
        videoUrl: v.optional(nullableStringValidator),
        status: v.union(v.literal("active"), v.literal("archived")),
        order: v.number(),
      },
      returns: roleTestOutputValidator,
      handler: async (ctx, args) => {
        await requireAdminAuth(options, component, ctx, {
          type: "manageRoleTests",
          roleId: args.roleId,
          roleTestId: args.roleTestId,
        });

        return await ctx.runMutation(component.lib.upsertRoleTest, {
          ...args,
          targetUrl: normalizeFeedbackUrl(args.targetUrl),
        });
      },
    }),

    archiveRoleTest: mutationGeneric({
      args: {
        roleTestId: v.string(),
      },
      returns: roleTestOutputValidator,
      handler: async (ctx, args) => {
        await requireAdminAuth(options, component, ctx, {
          type: "manageRoleTests",
          roleTestId: args.roleTestId,
        });

        return await ctx.runMutation(component.lib.archiveRoleTest, {
          roleTestId: args.roleTestId,
        });
      },
    }),

    assignRoleToUser: mutationGeneric({
      args: {
        userId: v.string(),
        roleId: v.string(),
      },
      returns: roleAssignmentOutputValidator,
      handler: async (ctx, args) => {
        await requireAdminAuth(options, component, ctx, {
          type: "assignRole",
          roleId: args.roleId,
          userId: args.userId,
        });

        return await ctx.runMutation(component.lib.assignRoleToUser, args);
      },
    }),

    removeRoleFromUser: mutationGeneric({
      args: {
        userId: v.string(),
        roleId: v.string(),
      },
      returns: v.null(),
      handler: async (ctx, args) => {
        await requireAdminAuth(options, component, ctx, {
          type: "assignRole",
          roleId: args.roleId,
          userId: args.userId,
        });

        return await ctx.runMutation(component.lib.removeRoleFromUser, args);
      },
    }),

    listRoleAssignments: queryGeneric({
      args: {
        userId: v.optional(v.string()),
        roleId: v.optional(v.string()),
        limit: v.optional(v.number()),
      },
      returns: v.array(roleAssignmentOutputValidator),
      handler: async (ctx, args) => {
        await requireAdminAuth(options, component, ctx, { type: "manageRoles" });

        return await ctx.runQuery(component.lib.listRoleAssignments, args);
      },
    }),

    listMyAssignedRoleTests: queryGeneric({
      args: {},
      returns: v.array(assignedRoleTestsOutputValidator),
      handler: async (ctx) => {
        const userId = await options.auth(ctx, {
          type: "readMyRoleTests",
        });

        return await ctx.runQuery(component.lib.listMyAssignedRoleTests, {
          userId,
        });
      },
    }),

    getRoleTestDetail: queryGeneric({
      args: {
        roleTestId: v.string(),
      },
      returns: roleTestDetailOutputValidator,
      handler: async (ctx, args) => {
        const userId = await options.auth(ctx, {
          type: "readRoleTestDetail",
          roleTestId: args.roleTestId,
        });

        return await ctx.runQuery(component.lib.getRoleTestDetail, {
          userId,
          roleTestId: args.roleTestId,
        });
      },
    }),

    completeRoleTestWithFeedback: mutationGeneric({
      args: {
        roleTestId: v.string(),
        rating: ratingValidator,
        note: v.string(),
      },
      returns: roleTestDetailOutputValidator,
      handler: async (ctx, args) => {
        const userId = await options.auth(ctx, {
          type: "completeRoleTest",
          roleTestId: args.roleTestId,
        });

        return await ctx.runMutation(component.lib.completeRoleTestWithFeedback, {
          userId,
          roleTestId: args.roleTestId,
          rating: args.rating,
          note: args.note,
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
      returns: settingsOutputValidator,
      handler: async (ctx) => {
        return await ctx.runQuery(component.lib.getSettings, {});
      },
    }),

    setSettings: mutationGeneric({
      args: {
        bugReportUrl: v.optional(nullableStringValidator),
        improvementRequestUrl: v.optional(nullableStringValidator),
        adminUserIds: v.optional(v.array(v.string())),
      },
      returns: settingsOutputValidator,
      handler: async (ctx, args) => {
        await requireAdminAuth(options, component, ctx, {
          type: "manageSettings",
        });

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
    auth: (ctx: { auth: Auth }, operation: UserOperation) => Promise<string>;
    adminAuth?: (ctx: { auth: Auth }) => Promise<void>;
  },
  component: ComponentApi,
  ctx: {
    auth: Auth;
    runQuery: (
      query: ComponentApi["lib"]["getSettings"],
      args: Record<string, never>,
    ) => Promise<{ adminUserIds: string[] }>;
  },
  operation: Extract<
    UserOperation,
    | { type: "manageSettings" }
    | { type: "manageRoles" }
    | { type: "manageObjectives" }
    | { type: "manageRoleTests" }
    | { type: "assignRole" }
  >,
) {
  if (options.adminAuth) {
    await options.adminAuth(ctx);
    return;
  }

  const userId = await options.auth(ctx, operation);
  const settings = await ctx.runQuery(component.lib.getSettings, {});

  if (settings.adminUserIds.length === 0) {
    if (operation.type === "manageSettings") {
      return;
    }

    throw new Error("admin settings are not configured");
  }

  if (!settings.adminUserIds.includes(userId)) {
    throw new Error("admin access required");
  }
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
