export type Sensitivity = "casual" | "strict";

export interface GroupSettings {
  autoEnabled: boolean;
  sensitivity: Sensitivity;
}

const DEFAULT_SETTINGS: GroupSettings = { autoEnabled: false, sensitivity: "casual" };

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
