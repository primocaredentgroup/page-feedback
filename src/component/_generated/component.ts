/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    lib: {
      addComment: FunctionReference<
        "mutation",
        "internal",
        { body: string; threadId: string; userId: string },
        {
          comment: {
            _creationTime: number;
            _id: string;
            authorId: string;
            body: string;
            createdAt: number;
            editedAt?: number;
            isDeleted: boolean;
            isEdited: boolean;
            threadId: string;
          };
          reactions: Array<{
            count: number;
            emoji: string;
            includesMe: boolean;
            users: Array<string>;
          }>;
        },
        Name
      >;
      deleteComment: FunctionReference<
        "mutation",
        "internal",
        { commentId: string; userId: string },
        null,
        Name
      >;
      editComment: FunctionReference<
        "mutation",
        "internal",
        { body: string; commentId: string; userId: string },
        {
          comment: {
            _creationTime: number;
            _id: string;
            authorId: string;
            body: string;
            createdAt: number;
            editedAt?: number;
            isDeleted: boolean;
            isEdited: boolean;
            threadId: string;
          };
          reactions: Array<{
            count: number;
            emoji: string;
            includesMe: boolean;
            users: Array<string>;
          }>;
        },
        Name
      >;
      getCommentReactions: FunctionReference<
        "query",
        "internal",
        { commentId: string; currentUserId?: string },
        Array<{
          count: number;
          emoji: string;
          includesMe: boolean;
          users: Array<string>;
        }>,
        Name
      >;
      getMyFeedback: FunctionReference<
        "query",
        "internal",
        { url: string; userId: string },
        null | {
          normalizedUrl: string;
          note: string;
          rating: 1 | 2 | 3;
          threadId: string;
          updatedAt: number;
          userId: string;
          version: number;
        },
        Name
      >;
      getSettings: FunctionReference<
        "query",
        "internal",
        {},
        {
          bugReportUrl: string | null;
          improvementRequestUrl: string | null;
          updatedAt: number | null;
        },
        Name
      >;
      listComments: FunctionReference<
        "query",
        "internal",
        { currentUserId?: string; limit?: number; threadId: string },
        Array<{
          comment: {
            _creationTime: number;
            _id: string;
            authorId: string;
            body: string;
            createdAt: number;
            editedAt?: number;
            isDeleted: boolean;
            isEdited: boolean;
            threadId: string;
          };
          reactions: Array<{
            count: number;
            emoji: string;
            includesMe: boolean;
            users: Array<string>;
          }>;
        }>,
        Name
      >;
      listFeedbackVersions: FunctionReference<
        "query",
        "internal",
        { limit?: number; url: string; userId: string },
        Array<{
          _creationTime: number;
          _id: string;
          normalizedUrl: string;
          note: string;
          rating: 1 | 2 | 3;
          threadId: string;
          userId: string;
          version: number;
        }>,
        Name
      >;
      listLatestFeedbackForUrl: FunctionReference<
        "query",
        "internal",
        { limit?: number; url: string },
        Array<{
          normalizedUrl: string;
          note: string;
          rating: 1 | 2 | 3;
          threadId: string;
          updatedAt: number;
          userId: string;
          version: number;
        }>,
        Name
      >;
      listMyFeedbackThreads: FunctionReference<
        "query",
        "internal",
        { limit?: number; userId: string },
        Array<{
          normalizedUrl: string;
          note: string;
          rating: 1 | 2 | 3;
          threadId: string;
          updatedAt: number;
          userId: string;
          version: number;
        }>,
        Name
      >;
      setSettings: FunctionReference<
        "mutation",
        "internal",
        { bugReportUrl?: string | null; improvementRequestUrl?: string | null },
        {
          bugReportUrl: string | null;
          improvementRequestUrl: string | null;
          updatedAt: number | null;
        },
        Name
      >;
      toggleReaction: FunctionReference<
        "mutation",
        "internal",
        { commentId: string; emoji: string; userId: string },
        {
          added: boolean;
          reactions: Array<{
            count: number;
            emoji: string;
            includesMe: boolean;
            users: Array<string>;
          }>;
        },
        Name
      >;
      upsertFeedback: FunctionReference<
        "mutation",
        "internal",
        { note: string; rating: 1 | 2 | 3; url: string; userId: string },
        {
          normalizedUrl: string;
          note: string;
          rating: 1 | 2 | 3;
          threadId: string;
          updatedAt: number;
          userId: string;
          version: number;
        },
        Name
      >;
    };
  };
