import { describe, it, expect, beforeEach } from "vitest";
import { getSettings, setSettings, resetSettings } from "./settings";

describe("getSettings", () => {
  beforeEach(() => resetSettings());

  it("returns defaults for unknown group", async () => {
    const s = await getSettings("group-123");
    expect(s).toEqual({ autoEnabled: false, sensitivity: "casual", autoFormat: "both" });
  });

  it("returns stored settings after setSettings", async () => {
    await setSettings("group-abc", { autoEnabled: true });
    expect((await getSettings("group-abc")).autoEnabled).toBe(true);
    expect((await getSettings("group-abc")).sensitivity).toBe("casual");
  });

  it("merges partial patch without overwriting other fields", async () => {
    await setSettings("group-abc", { autoEnabled: true, sensitivity: "strict" });
    await setSettings("group-abc", { sensitivity: "casual" });
    expect((await getSettings("group-abc")).autoEnabled).toBe(true);
    expect((await getSettings("group-abc")).sensitivity).toBe("casual");
  });

  it("isolates settings per group", async () => {
    await setSettings("group-1", { autoEnabled: true });
    expect((await getSettings("group-2")).autoEnabled).toBe(false);
  });
});

describe("sensitivity levels", () => {
  beforeEach(() => resetSettings());

  it("defaults to casual sensitivity", async () => {
    expect((await getSettings("group-x")).sensitivity).toBe("casual");
  });

  it("sets sensitivity to low", async () => {
    await setSettings("group-x", { sensitivity: "casual" });
    expect((await getSettings("group-x")).sensitivity).toBe("casual");
  });

  it("sets sensitivity to high", async () => {
    await setSettings("group-x", { sensitivity: "strict" });
    expect((await getSettings("group-x")).sensitivity).toBe("strict");
  });

  it("changing sensitivity does not affect autoEnabled", async () => {
    await setSettings("group-x", { autoEnabled: true, sensitivity: "casual" });
    await setSettings("group-x", { sensitivity: "strict" });
    expect((await getSettings("group-x")).autoEnabled).toBe(true);
    expect((await getSettings("group-x")).sensitivity).toBe("strict");
  });

  it("changing autoEnabled does not affect sensitivity", async () => {
    await setSettings("group-x", { autoEnabled: false, sensitivity: "strict" });
    await setSettings("group-x", { autoEnabled: true });
    expect((await getSettings("group-x")).sensitivity).toBe("strict");
    expect((await getSettings("group-x")).autoEnabled).toBe(true);
  });
});

describe("autoFormat", () => {
  beforeEach(() => resetSettings());

  it("defaults to both", async () => {
    expect((await getSettings("group-x")).autoFormat).toBe("both");
  });

  it("sets autoFormat to fix", async () => {
    await setSettings("group-x", { autoFormat: "fix" });
    expect((await getSettings("group-x")).autoFormat).toBe("fix");
  });

  it("sets autoFormat to try", async () => {
    await setSettings("group-x", { autoFormat: "try" });
    expect((await getSettings("group-x")).autoFormat).toBe("try");
  });

  it("changing autoFormat does not affect other settings", async () => {
    await setSettings("group-x", { autoEnabled: true, sensitivity: "strict", autoFormat: "both" });
    await setSettings("group-x", { autoFormat: "fix" });
    expect((await getSettings("group-x")).autoEnabled).toBe(true);
    expect((await getSettings("group-x")).sensitivity).toBe("strict");
    expect((await getSettings("group-x")).autoFormat).toBe("fix");
  });
});
