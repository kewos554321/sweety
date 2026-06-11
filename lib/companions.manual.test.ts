import { describe, it, expect } from "vitest";
import { DbCompanionStore } from "./companion-store/db";

describe.skipIf(!process.env.RUN_DB_TESTS)("DbCompanionStore (requires Neon DATABASE_URL)", () => {
  it("inserts, lists, and deletes a companion", async () => {
    const store = new DbCompanionStore();
    const lineUserId = `test-user-${Date.now()}`;

    const created = await store.insert({ lineUserId, name: "TestBot", personality: "friendly", avatar: "🐰" });
    expect(created.name).toBe("TestBot");
    expect(created.avatar).toBe("🐰");

    const list = await store.list(lineUserId);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("TestBot");

    const deleted = await store.delete(lineUserId, "TestBot");
    expect(deleted).toBe(true);

    expect(await store.list(lineUserId)).toHaveLength(0);
  });
});
