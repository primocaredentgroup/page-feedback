import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const ratingValidator = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(3),
);

export default defineSchema({
  feedbackThreads: defineTable({
    userId: v.string(),
    normalizedUrl: v.string(),
    latestVersion: v.number(),
    latestRating: ratingValidator,
    latestNote: v.string(),
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
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
});
