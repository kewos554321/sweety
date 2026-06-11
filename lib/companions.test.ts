import { describe, it, expect, beforeEach } from "vitest";
import {
  AVATAR_PALETTE,
  MAX_COMPANIONS,
  MAX_NAME_LENGTH,
  MAX_PERSONALITY_LENGTH,
  MAX_ACTIVE_AGENTS,
  pickAvatar,
  validateCompanionName,
  validateCompanionPersonality,
  listCompanions,
  createCompanion,
  deleteCompanion,
  resetCompanions,
} from "./companions";

describe("pickAvatar", () => {
  it("returns the first palette emoji for the first companion", () => {
    expect(pickAvatar(0)).toBe(AVATAR_PALETTE[0]);
  });

  it("cycles through the palette as existingCount grows", () => {
    expect(pickAvatar(1)).toBe(AVATAR_PALETTE[1]);
    expect(pickAvatar(AVATAR_PALETTE.length)).toBe(AVATAR_PALETTE[0]);
  });
});

describe("validateCompanionName", () => {
  it("accepts a normal name", () => {
    expect(validateCompanionName("小兔兔")).toBeNull();
  });

  it("rejects an empty name", () => {
    expect(validateCompanionName("")).not.toBeNull();
  });

  it(`rejects a name longer than ${MAX_NAME_LENGTH} characters`, () => {
    expect(validateCompanionName("a".repeat(MAX_NAME_LENGTH + 1))).not.toBeNull();
  });

  it("rejects names containing |, ,, or @", () => {
    expect(validateCompanionName("小|兔")).not.toBeNull();
    expect(validateCompanionName("小,兔")).not.toBeNull();
    expect(validateCompanionName("小@兔")).not.toBeNull();
  });
});

describe("validateCompanionPersonality", () => {
  it("accepts a normal personality description", () => {
    expect(validateCompanionPersonality("活潑愛開玩笑,常常用兔子相關的梗")).toBeNull();
  });

  it("rejects an empty personality", () => {
    expect(validateCompanionPersonality("")).not.toBeNull();
  });

  it(`rejects a personality longer than ${MAX_PERSONALITY_LENGTH} characters`, () => {
    expect(validateCompanionPersonality("a".repeat(MAX_PERSONALITY_LENGTH + 1))).not.toBeNull();
  });
});

describe("limits", () => {
  it("caps registered companions at 5", () => {
    expect(MAX_COMPANIONS).toBe(5);
  });

  it("caps active session companions at 3", () => {
    expect(MAX_ACTIVE_AGENTS).toBe(3);
  });
});

describe("createCompanion / listCompanions / deleteCompanion", () => {
  beforeEach(() => resetCompanions());

  it("creates a companion with an auto-assigned avatar", async () => {
    const result = await createCompanion("user-1", "小兔兔", "活潑愛開玩笑");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.companion.name).toBe("小兔兔");
      expect(result.companion.personality).toBe("活潑愛開玩笑");
      expect(result.companion.avatar).toBe(AVATAR_PALETTE[0]);
    }
  });

  it("assigns the next palette avatar to each new companion", async () => {
    await createCompanion("user-1", "A", "personality A");
    const second = await createCompanion("user-1", "B", "personality B");
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.companion.avatar).toBe(AVATAR_PALETTE[1]);
  });

  it("lists only the companions for the given user", async () => {
    await createCompanion("user-1", "A", "personality A");
    await createCompanion("user-2", "B", "personality B");
    const list = await listCompanions("user-1");
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("A");
  });

  it("rejects a duplicate name for the same user", async () => {
    await createCompanion("user-1", "A", "personality A");
    const result = await createCompanion("user-1", "A", "different personality");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("A");
  });

  it("allows the same name for different users", async () => {
    await createCompanion("user-1", "A", "personality A");
    const result = await createCompanion("user-2", "A", "personality A2");
    expect(result.ok).toBe(true);
  });

  it(`rejects creating a companion beyond the ${MAX_COMPANIONS}-companion limit`, async () => {
    for (let i = 0; i < MAX_COMPANIONS; i++) {
      await createCompanion("user-1", `Bot${i}`, "personality");
    }
    const result = await createCompanion("user-1", "OneTooMany", "personality");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(String(MAX_COMPANIONS));
  });

  it("rejects an invalid name without creating a companion", async () => {
    const result = await createCompanion("user-1", "a|b", "personality");
    expect(result.ok).toBe(false);
    expect(await listCompanions("user-1")).toHaveLength(0);
  });

  it("rejects an invalid (empty) personality", async () => {
    const result = await createCompanion("user-1", "Name", "");
    expect(result.ok).toBe(false);
  });

  it("deletes a companion by name", async () => {
    await createCompanion("user-1", "A", "personality A");
    const deleted = await deleteCompanion("user-1", "A");
    expect(deleted).toBe(true);
    expect(await listCompanions("user-1")).toHaveLength(0);
  });

  it("returns false when deleting a companion that doesn't exist", async () => {
    const deleted = await deleteCompanion("user-1", "Nope");
    expect(deleted).toBe(false);
  });
});
