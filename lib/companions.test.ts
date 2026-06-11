import { describe, it, expect } from "vitest";
import {
  AVATAR_PALETTE,
  MAX_COMPANIONS,
  MAX_NAME_LENGTH,
  MAX_PERSONALITY_LENGTH,
  MAX_ACTIVE_AGENTS,
  pickAvatar,
  validateCompanionName,
  validateCompanionPersonality,
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
