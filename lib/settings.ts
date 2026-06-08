export type Sensitivity = "casual" | "strict";
export type AutoFormat = "fix" | "try" | "both";

export interface GroupSettings {
  autoEnabled: boolean;
  sensitivity: Sensitivity;
  autoFormat: AutoFormat;
}

const DEFAULT_SETTINGS: GroupSettings = { autoEnabled: false, sensitivity: "casual", autoFormat: "both" };

const store = new Map<string, GroupSettings>();

export function getSettings(groupId: string): GroupSettings {
  return store.get(groupId) ?? { ...DEFAULT_SETTINGS };
}

export function setSettings(groupId: string, patch: Partial<GroupSettings>): void {
  store.set(groupId, { ...getSettings(groupId), ...patch });
}

export function resetSettings(): void {
  store.clear();
}

// --- Debug log ---

const eventLog: string[] = [];

export function logAutoEvent(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  eventLog.push(`${ts} ${msg}`);
  if (eventLog.length > 10) eventLog.shift();
}

export function getDebugText(groupId: string): string {
  const { autoEnabled, sensitivity } = getSettings(groupId);
  const log = eventLog.length > 0 ? eventLog.slice(-5).join("\n") : "  (none)";

  return [
    `[Sweety Debug]`,
    `groupId: ${groupId}`,
    `autoEnabled: ${autoEnabled}`,
    `sensitivity: ${sensitivity}`,
    `recent events:`,
    log,
  ].join("\n");
}
