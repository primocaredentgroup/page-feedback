import { describe, expect, test } from "vitest";
import { anyApi, type ApiFromModules, httpRouter } from "convex/server";
import { convexTest } from "convex-test";
import { defineSchema } from "convex/server";
import { exposeApi, normalizeFeedbackUrl, registerRoutes } from "./index.js";
import { components, initConvexTest, modules } from "./setup.test.js";
import { register } from "../test.js";

export const {
  upsertFeedback,
  getMyFeedback,
  listFeedbackVersions,
  listLatestFeedbackForUrl,
  upsertObjective,
  listObjectivesForUrl,
  upsertRole,
  upsertRoleTest,
  assignRoleToUser,
  completeRoleTestWithFeedback,
  getRoleTestDetail,
  listMyAssignedRoleTests,
} = exposeApi(components.pageFeedback, {
  urlMode: "full",
  auth: async (_ctx, operation) => {
    if (
      "normalizedUrl" in operation &&
      typeof operation.normalizedUrl === "string" &&
      operation.normalizedUrl.includes("?")
    ) {
      expect(operation.normalizedUrl).toContain("#");
    }
    return "user1";
  },
  adminAuth: async () => {},
});
export const { upsertFeedback: legacyUpsert } = exposeApi(
  components.pageFeedback,
  {
    auth: async () => "user1",
  },
);
const api = (
  anyApi as unknown as ApiFromModules<{
    "url-mode.test": {
      upsertFeedback: typeof upsertFeedback;
      getMyFeedback: typeof getMyFeedback;
      listFeedbackVersions: typeof listFeedbackVersions;
      listLatestFeedbackForUrl: typeof listLatestFeedbackForUrl;
      upsertObjective: typeof upsertObjective;
      listObjectivesForUrl: typeof listObjectivesForUrl;
      upsertRole: typeof upsertRole;
      upsertRoleTest: typeof upsertRoleTest;
      assignRoleToUser: typeof assignRoleToUser;
      completeRoleTestWithFeedback: typeof completeRoleTestWithFeedback;
      getRoleTestDetail: typeof getRoleTestDetail;
      listMyAssignedRoleTests: typeof listMyAssignedRoleTests;
      legacyUpsert: typeof legacyUpsert;
    };
  }>
)["url-mode.test"];

const first = "https://app.example.com/dashboard?tab=one&a=1#section";
const second = "https://app.example.com/dashboard?tab=two&a=1#section";

describe("full URL identity", () => {
  test("separates query, parameter order and fragments while preserving history", async () => {
    const t = initConvexTest();
    const legacy = await t.mutation(api.legacyUpsert, {
      url: first,
      rating: 1,
      note: "Legacy",
    });
    const urls = [
      first,
      second,
      first.replace("#section", "#other"),
      first.replace("tab=one&a=1", "a=1&tab=one"),
    ];
    const ids = new Set<string>();
    for (const url of urls) {
      const feedback = await t.mutation(api.upsertFeedback, {
        url: ` ${url} `,
        rating: 3,
        note: url,
      });
      ids.add(feedback.threadId);
      expect(feedback.version).toBe(1);
      expect(feedback.normalizedUrl).toBe(url);
      expect(await t.query(api.listLatestFeedbackForUrl, { url })).toHaveLength(
        1,
      );
    }
    expect(ids.size).toBe(4);
    expect(ids.has(legacy.threadId)).toBe(false);
    await t.mutation(api.upsertFeedback, {
      url: first,
      rating: 2,
      note: "Updated",
    });
    expect((await t.query(api.getMyFeedback, { url: first }))?.version).toBe(2);
    expect(
      await t.query(api.listFeedbackVersions, { url: first }),
    ).toHaveLength(2);
    expect(
      await t.query(api.listFeedbackVersions, { url: second }),
    ).toHaveLength(1);
    expect(
      (await t.query(api.getMyFeedback, { url: first.split("?")[0] }))
        ?.threadId,
    ).toBe(legacy.threadId);
  });

  test("keeps objectives separate for full URLs", async () => {
    const t = initConvexTest();
    for (const url of [first, second]) {
      await t.mutation(api.upsertObjective, {
        url,
        description: url,
        status: "active",
        order: 0,
      });
    }
    const objectives = await t.query(api.listObjectivesForUrl, { url: first });
    expect(objectives).toHaveLength(1);
    expect(objectives[0].normalizedUrl).toBe(first);
    expect(
      await t.query(api.listObjectivesForUrl, { url: first.split("?")[0] }),
    ).toHaveLength(0);
  });

  test("completes role tests against the saved full target and shares its feedback thread", async () => {
    const t = initConvexTest();
    const role = await t.mutation(api.upsertRole, {
      name: "QA",
      status: "active",
      order: 0,
    });
    await t.mutation(api.assignRoleToUser, {
      userId: "user1",
      roleId: role._id,
    });
    const tests = [];
    for (const targetUrl of [first, second]) {
      tests.push(
        await t.mutation(api.upsertRoleTest, {
          roleId: role._id,
          title: "Review",
          description: "Leave feedback",
          targetUrl,
          status: "active",
          order: tests.length,
        }),
      );
    }
    expect(tests[0].targetUrl).toBe(first);
    const existing = await t.mutation(api.upsertFeedback, {
      url: first,
      rating: 1,
      note: "Before test",
    });
    const done = await t.mutation(api.completeRoleTestWithFeedback, {
      roleTestId: tests[0]._id,
      rating: 3,
      note: "Done",
    });
    expect(done.feedback?.threadId).toBe(existing.threadId);
    expect(done.feedback?.version).toBe(2);
    expect(done.feedback?.normalizedUrl).toBe(first);
    expect(done.isCompleted).toBe(true);
    expect(
      (await t.query(api.getRoleTestDetail, { roleTestId: tests[1]._id }))
        .feedback,
    ).toBeNull();
    const assigned = await t.query(api.listMyAssignedRoleTests, {});
    expect(assigned[0].completedTests).toBe(1);
    expect(assigned[0].completionPercentage).toBe(50);
  });

  test("HTTP routes use the configured identity policy", async () => {
    const http = httpRouter();
    registerRoutes(http, components.pageFeedback, { urlMode: "full" });
    registerRoutes(http, components.pageFeedback, { pathPrefix: "/legacy" });
    const t = convexTest(defineSchema({}), {
      ...modules,
      "./http.ts": async () => ({ default: http }),
    });
    register(t);
    await t.mutation(api.upsertFeedback, {
      url: first,
      rating: 3,
      note: "Full",
    });
    await t.mutation(api.legacyUpsert, {
      url: first,
      rating: 1,
      note: "Legacy",
    });
    const full = await t.fetch(
      `/feedback/latest?url=${encodeURIComponent(first)}`,
    );
    expect(full.status).toBe(200);
    expect((await full.json())[0].normalizedUrl).toBe(first);
    const legacy = await t.fetch(
      `/legacy/latest?url=${encodeURIComponent(first)}`,
    );
    expect((await legacy.json())[0].note).toBe("Legacy");
    expect((await t.fetch("/feedback/latest")).status).toBe(400);
  });

  test("retains legacy hash behavior and validates empty URLs", () => {
    expect(normalizeFeedbackUrl(first)).toBe(
      "https://app.example.com/dashboard",
    );
    expect(normalizeFeedbackUrl(" https://app.example.com/page#part ")).toBe(
      "https://app.example.com/page#part",
    );
    expect(normalizeFeedbackUrl(first, "full")).toBe(first);
    expect(() => normalizeFeedbackUrl("   ", "full")).toThrow(
      "url is required",
    );
    expect(() => normalizeFeedbackUrl("?tab=one")).toThrow("url is required");
  });
});
