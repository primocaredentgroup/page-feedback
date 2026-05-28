import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const ratingValidator = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(3),
);

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

export default defineSchema({
  feedbackThreads: defineTable({
    userId: v.string(),
    normalizedUrl: v.string(),
    latestVersion: v.number(),
    latestRating: ratingValidator,
    latestNote: v.string(),
    isSolved: v.optional(v.boolean()),
    updatedAt: v.number(),
  })
    .index("by_userId_and_normalizedUrl", ["userId", "normalizedUrl"])
    .index("by_normalizedUrl", ["normalizedUrl"]),

  feedbackVersions: defineTable({
    threadId: v.id("feedbackThreads"),
    version: v.number(),
    rating: ratingValidator,
    note: v.string(),
    userId: v.string(),
    normalizedUrl: v.string(),
  })
    .index("by_threadId_and_version", ["threadId", "version"])
    .index("by_normalizedUrl", ["normalizedUrl"]),

  feedbackComments: defineTable({
    threadId: v.id("feedbackThreads"),
    authorId: v.string(),
    body: v.string(),
    isEdited: v.boolean(),
    isDeleted: v.boolean(),
    createdAt: v.number(),
    editedAt: v.optional(v.number()),
  })
    .index("by_threadId_and_createdAt", ["threadId", "createdAt"])
    .index("by_authorId", ["authorId"]),

  feedbackReactions: defineTable({
    commentId: v.id("feedbackComments"),
    userId: v.string(),
    emoji: v.string(),
    createdAt: v.number(),
  })
    .index("by_commentId", ["commentId"])
    .index("by_commentId_and_emoji_and_userId", ["commentId", "emoji", "userId"]),

  settings: defineTable({
    key: v.string(),
    bugReportUrl: v.optional(v.string()),
    improvementRequestUrl: v.optional(v.string()),
    adminUserIds: v.optional(v.array(v.string())),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  roles: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    status: roleStatusValidator,
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status_and_order", ["status", "order"])
    .index("by_order", ["order"]),

  roleTests: defineTable({
    roleId: v.id("roles"),
    title: v.string(),
    description: v.string(),
    targetUrl: v.string(),
    videoUrl: v.optional(v.string()),
    status: roleTestStatusValidator,
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_roleId_and_order", ["roleId", "order"])
    .index("by_roleId_and_status_and_order", ["roleId", "status", "order"]),

  userRoleAssignments: defineTable({
    userId: v.string(),
    roleId: v.id("roles"),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_roleId", ["roleId"])
    .index("by_userId_and_roleId", ["userId", "roleId"]),

  roleTestProgress: defineTable({
    userId: v.string(),
    roleTestId: v.id("roleTests"),
    isCompleted: v.boolean(),
    feedbackThreadId: v.id("feedbackThreads"),
    completedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_roleTestId", ["roleTestId"])
    .index("by_feedbackThreadId", ["feedbackThreadId"])
    .index("by_userId_and_roleTestId", ["userId", "roleTestId"]),

  pageObjectives: defineTable({
    normalizedUrl: v.string(),
    description: v.string(),
    status: objectiveStatusValidator,
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_normalizedUrl_and_order", ["normalizedUrl", "order"]),

  objectiveIndicators: defineTable({
    objectiveId: v.id("pageObjectives"),
    description: v.string(),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_objectiveId_and_order", ["objectiveId", "order"]),

  objectiveComments: defineTable({
    objectiveId: v.id("pageObjectives"),
    authorId: v.string(),
    body: v.string(),
    isEdited: v.boolean(),
    isDeleted: v.boolean(),
    createdAt: v.number(),
    editedAt: v.optional(v.number()),
  })
    .index("by_objectiveId_and_createdAt", ["objectiveId", "createdAt"])
    .index("by_authorId", ["authorId"]),
});
