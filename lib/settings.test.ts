import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getSettings, setSettings, resetSettings, hasEnoughWords, scheduleAutoCheck, resetDebounce } from "./settings";

describe("getSettings", () => {
  beforeEach(() => resetSettings());

  it("returns defaults for unknown group", () => {
    const s = getSettings("group-123");
    expect(s).toEqual({ autoEnabled: false, sensitivity: "casual" });
  });

  it("returns stored settings after setSettings", () => {
    setSettings("group-abc", { autoEnabled: true });
    expect(getSettings("group-abc").autoEnabled).toBe(true);
    expect(getSettings("group-abc").sensitivity).toBe("casual");
  });

  it("merges partial patch without overwriting other fields", () => {
    setSettings("group-abc", { autoEnabled: true, sensitivity: "strict" });
    setSettings("group-abc", { sensitivity: "casual" });
    expect(getSettings("group-abc").autoEnabled).toBe(true);
    expect(getSettings("group-abc").sensitivity).toBe("casual");
  });

  it("isolates settings per group", () => {
    setSettings("group-1", { autoEnabled: true });
    expect(getSettings("group-2").autoEnabled).toBe(false);
  });
});

describe("hasEnoughWords", () => {
  it("returns false for a single word", () => {
    expect(hasEnoughWords("ok")).toBe(false);
  });

  it("returns false for two English words", () => {
    expect(hasEnoughWords("lol nice")).toBe(false);
  });

  it("returns false for three English words", () => {
    expect(hasEnoughWords("sounds good thanks")).toBe(false);
  });

  it("returns true for exactly four English words", () => {
    expect(hasEnoughWords("I went to school")).toBe(true);
  });

  it("returns true for more than four English words", () => {
    expect(hasEnoughWords("This is a longer sentence about something")).toBe(true);
  });

  it("returns false for Chinese-only text", () => {
    expect(hasEnoughWords("哈哈哈哈哈")).toBe(false);
  });

  it("returns false for numbers only", () => {
    expect(hasEnoughWords("123 456 789 000")).toBe(false);
  });
});

describe("scheduleAutoCheck", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetDebounce();
  });

  afterEach(() => {
    resetDebounce();
    vi.useRealTimers();
  });

  it("calls onFire after delay with the buffered message", () => {
    const onFire = vi.fn();
    scheduleAutoCheck("g1:u1", "Hello world how are you", "token-1", onFire, 5000);
    vi.advanceTimersByTime(5000);
    expect(onFire).toHaveBeenCalledWith(["Hello world how are you"], "token-1");
  });

  it("resets timer and accumulates messages when more arrive before delay", () => {
    const onFire = vi.fn();
    scheduleAutoCheck("g1:u1", "First message here.", "token-1", onFire, 5000);
    vi.advanceTimersByTime(3000);
    scheduleAutoCheck("g1:u1", "Second message here.", "token-2", onFire, 5000);
    vi.advanceTimersByTime(4999);
    expect(onFire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onFire).toHaveBeenCalledWith(
      ["First message here.", "Second message here."],
      "token-2"
    );
  });

  it("uses the latest replyToken when multiple messages arrive", () => {
    const onFire = vi.fn();
    scheduleAutoCheck("g1:u1", "Message one here.", "token-1", onFire, 5000);
    scheduleAutoCheck("g1:u1", "Message two here.", "token-2", onFire, 5000);
    vi.advanceTimersByTime(5000);
    expect(onFire).toHaveBeenCalledWith(
      ["Message one here.", "Message two here."],
      "token-2"
    );
  });

  it("isolates debounce state per key", () => {
    const onFire = vi.fn();
    scheduleAutoCheck("g1:u1", "User one message here.", "token-u1", onFire, 5000);
    scheduleAutoCheck("g1:u2", "User two message here.", "token-u2", onFire, 5000);
    vi.advanceTimersByTime(5000);
    expect(onFire).toHaveBeenCalledTimes(2);
    expect(onFire).toHaveBeenCalledWith(["User one message here."], "token-u1");
    expect(onFire).toHaveBeenCalledWith(["User two message here."], "token-u2");
  });

  it("does not call onFire after resetDebounce clears pending timers", () => {
    const onFire = vi.fn();
    scheduleAutoCheck("g1:u1", "Some message here now.", "token-1", onFire, 5000);
    resetDebounce();
    vi.advanceTimersByTime(5000);
    expect(onFire).not.toHaveBeenCalled();
  });
});

describe("sensitivity levels", () => {
  beforeEach(() => resetSettings());

  it("defaults to casual sensitivity", () => {
    expect(getSettings("group-x").sensitivity).toBe("casual");
  });

  it("sets sensitivity to low", () => {
    setSettings("group-x", { sensitivity: "casual" });
    expect(getSettings("group-x").sensitivity).toBe("casual");
  });

  it("sets sensitivity to high", () => {
    setSettings("group-x", { sensitivity: "strict" });
    expect(getSettings("group-x").sensitivity).toBe("strict");
  });

  it("changing sensitivity does not affect autoEnabled", () => {
    setSettings("group-x", { autoEnabled: true, sensitivity: "casual" });
    setSettings("group-x", { sensitivity: "strict" });
    expect(getSettings("group-x").autoEnabled).toBe(true);
    expect(getSettings("group-x").sensitivity).toBe("strict");
  });

  it("changing autoEnabled does not affect sensitivity", () => {
    setSettings("group-x", { autoEnabled: false, sensitivity: "strict" });
    setSettings("group-x", { autoEnabled: true });
    expect(getSettings("group-x").sensitivity).toBe("strict");
    expect(getSettings("group-x").autoEnabled).toBe(true);
  });
});
