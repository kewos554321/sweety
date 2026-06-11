import { MemorySettingsStore } from "./settings-store/memory";
import { DbSettingsStore } from "./settings-store/db";
import { DEFAULT_SETTINGS } from "./settings-store/types";
import type { AutoFormat, GroupSettings, Sensitivity, SettingsStore } from "./settings-store/types";

export type { AutoFormat, GroupSettings, Sensitivity };

const store: SettingsStore = process.env.VITEST ? new MemorySettingsStore() : new DbSettingsStore();

export async function getSettings(groupId: string): Promise<GroupSettings> {
  const row = await store.get(groupId);
  return row ?? { ...DEFAULT_SETTINGS };
}

export async function setSettings(groupId: string, patch: Partial<GroupSettings>): Promise<void> {
  const current = await getSettings(groupId);
  await store.upsert(groupId, { ...current, ...patch });
}

export function resetSettings(): void {
  store.reset();
}

// --- Debug log ---

const eventLog: string[] = [];

export function logAutoEvent(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  eventLog.push(`${ts} ${msg}`);
  if (eventLog.length > 10) eventLog.shift();
}

export async function getDebugText(groupId: string): Promise<string> {
  const { autoEnabled, sensitivity } = await getSettings(groupId);
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
