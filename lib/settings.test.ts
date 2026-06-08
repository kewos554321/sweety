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
