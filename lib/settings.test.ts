import { describe, it, expect, beforeEach } from "vitest";
import { getSettings, setSettings, resetSettings } from "./settings";

describe("getSettings", () => {
  beforeEach(() => resetSettings());

  it("returns defaults for unknown group", () => {
    const s = getSettings("group-123");
    expect(s).toEqual({ autoEnabled: false, sensitivity: "medium" });
  });

  it("returns stored settings after setSettings", () => {
    setSettings("group-abc", { autoEnabled: true });
    expect(getSettings("group-abc").autoEnabled).toBe(true);
    expect(getSettings("group-abc").sensitivity).toBe("medium");
  });

  it("merges partial patch without overwriting other fields", () => {
    setSettings("group-abc", { autoEnabled: true, sensitivity: "high" });
    setSettings("group-abc", { sensitivity: "low" });
    expect(getSettings("group-abc").autoEnabled).toBe(true);
    expect(getSettings("group-abc").sensitivity).toBe("low");
  });

  it("isolates settings per group", () => {
    setSettings("group-1", { autoEnabled: true });
    expect(getSettings("group-2").autoEnabled).toBe(false);
  });
});

describe("sensitivity levels", () => {
  beforeEach(() => resetSettings());

  it("defaults to medium sensitivity", () => {
    expect(getSettings("group-x").sensitivity).toBe("medium");
  });

  it("sets sensitivity to low", () => {
    setSettings("group-x", { sensitivity: "low" });
    expect(getSettings("group-x").sensitivity).toBe("low");
  });

  it("sets sensitivity to high", () => {
    setSettings("group-x", { sensitivity: "high" });
    expect(getSettings("group-x").sensitivity).toBe("high");
  });

  it("changing sensitivity does not affect autoEnabled", () => {
    setSettings("group-x", { autoEnabled: true, sensitivity: "low" });
    setSettings("group-x", { sensitivity: "high" });
    expect(getSettings("group-x").autoEnabled).toBe(true);
    expect(getSettings("group-x").sensitivity).toBe("high");
  });

  it("changing autoEnabled does not affect sensitivity", () => {
    setSettings("group-x", { autoEnabled: false, sensitivity: "high" });
    setSettings("group-x", { autoEnabled: true });
    expect(getSettings("group-x").sensitivity).toBe("high");
    expect(getSettings("group-x").autoEnabled).toBe(true);
  });
});
