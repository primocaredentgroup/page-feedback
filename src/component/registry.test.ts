/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import { api } from "./_generated/api.js";
import schema from "./schema.js";

const modules = import.meta.glob("./**/*.ts");

describe("global feedback registry", () => {
  test("returns the latest snapshot across users and preserves the bounded newest-first registry", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.lib.upsertFeedback, { userId: "a", url: "/first", rating: 1, note: "Original" });
    await t.mutation(api.lib.upsertFeedback, { userId: "b", url: "/second", rating: 2, note: "Second user" });
    await t.mutation(api.lib.upsertFeedback, { userId: "a", url: "/first", rating: 3, note: "Revised" });
    const rows = await t.query(api.lib.listAllFeedbackThreads, {});
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ userId: "b", version: 1, note: "Second user", isSolved: false });
    expect(rows[1]).toMatchObject({ userId: "a", version: 2, rating: 3, note: "Revised", isSolved: false });
    expect(await t.query(api.lib.listAllFeedbackThreads, { limit: 1 })).toEqual([rows[0]]);
  });

  test("returns an empty registry when no feedback exists", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.lib.listAllFeedbackThreads, {})).toEqual([]);
  });
});
