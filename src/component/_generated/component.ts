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
      addObjectiveComment: FunctionReference<
        "mutation",
        "internal",
        { body: string; objectiveId: string; userId: string },
        {
          _creationTime: number;
          _id: string;
          authorId: string;
          body: string;
          createdAt: number;
          editedAt?: number;
          isDeleted: boolean;
          isEdited: boolean;
          objectiveId: string;
        },
        Name
      >;
      archiveRole: FunctionReference<
        "mutation",
        "internal",
        { roleId: string },
        {
          _creationTime: number;
          _id: string;
          createdAt: number;
          description?: string;
          name: string;
          order: number;
          status: "active" | "archived";
          updatedAt: number;
        },
        Name
      >;
      archiveRoleTest: FunctionReference<
        "mutation",
        "internal",
        { roleTestId: string },
        {
          _creationTime: number;
          _id: string;
          createdAt: number;
          description: string;
          order: number;
          roleId: string;
          status: "active" | "archived";
          targetUrl: string;
          title: string;
          updatedAt: number;
          videoUrl?: string;
        },
        Name
      >;
      assignRoleToUser: FunctionReference<
        "mutation",
        "internal",
        { roleId: string; userId: string },
        {
          _creationTime: number;
          _id: string;
          createdAt: number;
          roleId: string;
          userId: string;
        },
        Name
      >;
      completeRoleTestWithFeedback: FunctionReference<
        "mutation",
        "internal",
        { note: string; rating: 1 | 2 | 3; roleTestId: string; userId: string },
        {
          completedAt: number | null;
          feedback: null | {
            isSolved: boolean;
            normalizedUrl: string;
            note: string;
            rating: 1 | 2 | 3;
            threadId: string;
            updatedAt: number;
            userId: string;
            version: number;
          };
          isCompleted: boolean;
          progress: null | {
            _creationTime: number;
            _id: string;
            completedAt: number;
            feedbackThreadId: string;
            isCompleted: boolean;
            roleTestId: string;
            updatedAt: number;
            userId: string;
          };
          role: {
            _creationTime: number;
            _id: string;
            createdAt: number;
            description?: string;
            name: string;
            order: number;
            status: "active" | "archived";
            updatedAt: number;
          };
          test: {
            _creationTime: number;
            _id: string;
            createdAt: number;
            description: string;
            order: number;
            roleId: string;
            status: "active" | "archived";
            targetUrl: string;
            title: string;
            updatedAt: number;
            videoUrl?: string;
          };
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
        { url: string; urlMode?: "page" | "full"; userId: string },
        null | {
          isSolved: boolean;
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
      getRoleTestDetail: FunctionReference<
        "query",
        "internal",
        { roleTestId: string; userId: string },
        {
          completedAt: number | null;
          feedback: null | {
            isSolved: boolean;
            normalizedUrl: string;
            note: string;
            rating: 1 | 2 | 3;
            threadId: string;
            updatedAt: number;
            userId: string;
            version: number;
          };
          isCompleted: boolean;
          progress: null | {
            _creationTime: number;
            _id: string;
            completedAt: number;
            feedbackThreadId: string;
            isCompleted: boolean;
            roleTestId: string;
            updatedAt: number;
            userId: string;
          };
          role: {
            _creationTime: number;
            _id: string;
            createdAt: number;
            description?: string;
            name: string;
            order: number;
            status: "active" | "archived";
            updatedAt: number;
          };
          test: {
            _creationTime: number;
            _id: string;
            createdAt: number;
            description: string;
            order: number;
            roleId: string;
            status: "active" | "archived";
            targetUrl: string;
            title: string;
            updatedAt: number;
            videoUrl?: string;
          };
        },
        Name
      >;
      getSettings: FunctionReference<
        "query",
        "internal",
        {},
        {
          adminUserIds: Array<string>;
          bugReportUrl: string | null;
          improvementRequestUrl: string | null;
          updatedAt: number | null;
        },
        Name
      >;
      listAllFeedbackThreads: FunctionReference<
        "query",
        "internal",
        { limit?: number },
        Array<{
          isSolved: boolean;
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
        {
          limit?: number;
          url: string;
          urlMode?: "page" | "full";
          userId: string;
        },
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
      listIndicatorsForObjective: FunctionReference<
        "query",
        "internal",
        { objectiveId: string },
        Array<{
          _creationTime: number;
          _id: string;
          createdAt: number;
          description: string;
          objectiveId: string;
          order: number;
          updatedAt: number;
        }>,
        Name
      >;
      listLatestFeedbackForUrl: FunctionReference<
        "query",
        "internal",
        { limit?: number; url: string; urlMode?: "page" | "full" },
        Array<{
          isSolved: boolean;
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
      listMyAssignedRoleTests: FunctionReference<
        "query",
        "internal",
        { userId: string },
        Array<{
          assignment: {
            _creationTime: number;
            _id: string;
            createdAt: number;
            roleId: string;
            userId: string;
          };
          completedTests: number;
          completionPercentage: number;
          role: {
            _creationTime: number;
            _id: string;
            createdAt: number;
            description?: string;
            name: string;
            order: number;
            status: "active" | "archived";
            updatedAt: number;
          };
          tests: Array<{
            completedAt: number | null;
            feedback: null | {
              isSolved: boolean;
              normalizedUrl: string;
              note: string;
              rating: 1 | 2 | 3;
              threadId: string;
              updatedAt: number;
              userId: string;
              version: number;
            };
            isCompleted: boolean;
            progress: null | {
              _creationTime: number;
              _id: string;
              completedAt: number;
              feedbackThreadId: string;
              isCompleted: boolean;
              roleTestId: string;
              updatedAt: number;
              userId: string;
            };
            test: {
              _creationTime: number;
              _id: string;
              createdAt: number;
              description: string;
              order: number;
              roleId: string;
              status: "active" | "archived";
              targetUrl: string;
              title: string;
              updatedAt: number;
              videoUrl?: string;
            };
          }>;
          totalTests: number;
        }>,
        Name
      >;
      listMyFeedbackThreads: FunctionReference<
        "query",
        "internal",
        { limit?: number; userId: string },
        Array<{
          isSolved: boolean;
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
      listObjectiveComments: FunctionReference<
        "query",
        "internal",
        { limit?: number; objectiveId: string },
        Array<{
          _creationTime: number;
          _id: string;
          authorId: string;
          body: string;
          createdAt: number;
          editedAt?: number;
          isDeleted: boolean;
          isEdited: boolean;
          objectiveId: string;
        }>,
        Name
      >;
      listObjectivesForUrl: FunctionReference<
        "query",
        "internal",
        { url: string; urlMode?: "page" | "full" },
        Array<{
          _creationTime: number;
          _id: string;
          createdAt: number;
          description: string;
          normalizedUrl: string;
          order: number;
          status: "active" | "archived";
          updatedAt: number;
        }>,
        Name
      >;
      listRoleAssignments: FunctionReference<
        "query",
        "internal",
        { limit?: number; roleId?: string; userId?: string },
        Array<{
          _creationTime: number;
          _id: string;
          createdAt: number;
          roleId: string;
          userId: string;
        }>,
        Name
      >;
      listRoles: FunctionReference<
        "query",
        "internal",
        { limit?: number },
        Array<{
          _creationTime: number;
          _id: string;
          createdAt: number;
          description?: string;
          name: string;
          order: number;
          status: "active" | "archived";
          updatedAt: number;
        }>,
        Name
      >;
      listRoleTestsForRole: FunctionReference<
        "query",
        "internal",
        { limit?: number; roleId: string },
        Array<{
          _creationTime: number;
          _id: string;
          createdAt: number;
          description: string;
          order: number;
          roleId: string;
          status: "active" | "archived";
          targetUrl: string;
          title: string;
          updatedAt: number;
          videoUrl?: string;
        }>,
        Name
      >;
      removeRoleFromUser: FunctionReference<
        "mutation",
        "internal",
        { roleId: string; userId: string },
        null,
        Name
      >;
      setFeedbackSolved: FunctionReference<
        "mutation",
        "internal",
        { isSolved: boolean; threadId: string; userId: string },
        {
          isSolved: boolean;
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
      setSettings: FunctionReference<
        "mutation",
        "internal",
        {
          adminUserIds?: Array<string>;
          bugReportUrl?: string | null;
          improvementRequestUrl?: string | null;
        },
        {
          adminUserIds: Array<string>;
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
        {
          note: string;
          rating: 1 | 2 | 3;
          url: string;
          urlMode?: "page" | "full";
          userId: string;
        },
        {
          isSolved: boolean;
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
      upsertIndicator: FunctionReference<
        "mutation",
        "internal",
        {
          description: string;
          indicatorId?: string;
          objectiveId: string;
          order: number;
        },
        {
          _creationTime: number;
          _id: string;
          createdAt: number;
          description: string;
          objectiveId: string;
          order: number;
          updatedAt: number;
        },
        Name
      >;
      upsertObjective: FunctionReference<
        "mutation",
        "internal",
        {
          description: string;
          objectiveId?: string;
          order: number;
          status: "active" | "archived";
          url: string;
          urlMode?: "page" | "full";
        },
        {
          _creationTime: number;
          _id: string;
          createdAt: number;
          description: string;
          normalizedUrl: string;
          order: number;
          status: "active" | "archived";
          updatedAt: number;
        },
        Name
      >;
      upsertRole: FunctionReference<
        "mutation",
        "internal",
        {
          description?: string | null;
          name: string;
          order: number;
          roleId?: string;
          status: "active" | "archived";
        },
        {
          _creationTime: number;
          _id: string;
          createdAt: number;
          description?: string;
          name: string;
          order: number;
          status: "active" | "archived";
          updatedAt: number;
        },
        Name
      >;
      upsertRoleTest: FunctionReference<
        "mutation",
        "internal",
        {
          description: string;
          order: number;
          roleId: string;
          roleTestId?: string;
          status: "active" | "archived";
          targetUrl: string;
          title: string;
          urlMode?: "page" | "full";
          videoUrl?: string | null;
        },
        {
          _creationTime: number;
          _id: string;
          createdAt: number;
          description: string;
          order: number;
          roleId: string;
          status: "active" | "archived";
          targetUrl: string;
          title: string;
          updatedAt: number;
          videoUrl?: string;
        },
        Name
      >;
    };
  };
