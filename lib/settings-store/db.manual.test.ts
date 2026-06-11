import { describe, it, expect } from "vitest";
import { DbSettingsStore } from "./db";

describe.skipIf(!process.env.RUN_DB_TESTS)("DbSettingsStore (requires Neon DATABASE_URL)", () => {
  it("returns null for an unknown group", async () => {
    const store = new DbSettingsStore();
    expect(await store.get(`nonexistent-${Date.now()}`)).toBeNull();
  });

  it("upserts and reads back settings, including updates", async () => {
    const store = new DbSettingsStore();
    const groupId = `test-${Date.now()}`;

    await store.upsert(groupId, { autoEnabled: true, sensitivity: "strict", autoFormat: "fix" });
    expect(await store.get(groupId)).toEqual({ autoEnabled: true, sensitivity: "strict", autoFormat: "fix" });

    await store.upsert(groupId, { autoEnabled: false, sensitivity: "casual", autoFormat: "both" });
    expect(await store.get(groupId)).toEqual({ autoEnabled: false, sensitivity: "casual", autoFormat: "both" });
  });
});
