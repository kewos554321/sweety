import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Companion } from "@/db/schema";
import {
  startSession,
  endSession,
  getSession,
  appendTurn,
  resetSessions,
  MAX_HISTORY,
  SESSION_TIMEOUT_MS,
} from "./chatSession";

function makeCompanion(overrides: Partial<Companion> = {}): Companion {
  return {
    id: 1,
    lineUserId: "user-1",
    name: "小兔兔",
    personality: "活潑愛開玩笑",
    avatar: "🐰",
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  resetSessions();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("startSession / getSession", () => {
  it("returns undefined when no session exists", () => {
    expect(getSession("group-1", "user-1")).toBeUndefined();
  });

  it("creates a session with the given agents and empty history", () => {
    const agents = [makeCompanion()];
    startSession("group-1", "user-1", agents);
    const session = getSession("group-1", "user-1");
    expect(session).toBeDefined();
    expect(session!.agents).toEqual(agents);
    expect(session!.history).toEqual([]);
  });

  it("isolates sessions per group/user", () => {
    startSession("group-1", "user-1", [makeCompanion()]);
    expect(getSession("group-1", "user-2")).toBeUndefined();
    expect(getSession("group-2", "user-1")).toBeUndefined();
  });

  it("replaces an existing session and resets history", () => {
    startSession("group-1", "user-1", [makeCompanion({ name: "A" })]);
    appendTurn("group-1", "user-1", { speaker: "User", text: "hi" });

    startSession("group-1", "user-1", [makeCompanion({ name: "B" })]);
    const session = getSession("group-1", "user-1")!;
    expect(session.agents[0].name).toBe("B");
    expect(session.history).toEqual([]);
  });
});

describe("endSession", () => {
  it("removes an existing session and returns true", () => {
    startSession("group-1", "user-1", [makeCompanion()]);
    expect(endSession("group-1", "user-1")).toBe(true);
    expect(getSession("group-1", "user-1")).toBeUndefined();
  });

  it("returns false when no session exists", () => {
    expect(endSession("group-1", "user-1")).toBe(false);
  });
});

describe("appendTurn", () => {
  it("appends a turn to the session history", () => {
    startSession("group-1", "user-1", [makeCompanion()]);
    appendTurn("group-1", "user-1", { speaker: "User", text: "hello" });
    appendTurn("group-1", "user-1", { speaker: "小兔兔", text: "哈囉~" });

    const session = getSession("group-1", "user-1")!;
    expect(session.history).toEqual([
      { speaker: "User", text: "hello" },
      { speaker: "小兔兔", text: "哈囉~" },
    ]);
  });

  it("does nothing when no session exists", () => {
    expect(() => appendTurn("group-1", "user-1", { speaker: "User", text: "hi" })).not.toThrow();
    expect(getSession("group-1", "user-1")).toBeUndefined();
  });

  it(`caps history at the last ${MAX_HISTORY} turns`, () => {
    startSession("group-1", "user-1", [makeCompanion()]);
    for (let i = 0; i < MAX_HISTORY + 5; i++) {
      appendTurn("group-1", "user-1", { speaker: "User", text: `msg ${i}` });
    }
    const session = getSession("group-1", "user-1")!;
    expect(session.history).toHaveLength(MAX_HISTORY);
    expect(session.history[0].text).toBe("msg 5");
    expect(session.history[MAX_HISTORY - 1].text).toBe(`msg ${MAX_HISTORY + 4}`);
  });
});

describe("session timeout", () => {
  it("deletes the session after SESSION_TIMEOUT_MS of inactivity", () => {
    startSession("group-1", "user-1", [makeCompanion()]);
    vi.advanceTimersByTime(SESSION_TIMEOUT_MS);
    expect(getSession("group-1", "user-1")).toBeUndefined();
  });

  it("resets the timeout when a turn is appended", () => {
    startSession("group-1", "user-1", [makeCompanion()]);

    vi.advanceTimersByTime(SESSION_TIMEOUT_MS - 60_000);
    appendTurn("group-1", "user-1", { speaker: "User", text: "still here" });

    vi.advanceTimersByTime(SESSION_TIMEOUT_MS - 60_000);
    expect(getSession("group-1", "user-1")).toBeDefined();

    vi.advanceTimersByTime(120_000);
    expect(getSession("group-1", "user-1")).toBeUndefined();
  });
});
