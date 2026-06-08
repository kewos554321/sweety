import { describe, it, expect, beforeEach } from "vitest";
import { getSettings, setSettings, resetSettings } from "./settings";

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
