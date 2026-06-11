export type Sensitivity = "casual" | "strict";
export type AutoFormat = "fix" | "try" | "both";

export interface GroupSettings {
  autoEnabled: boolean;
  sensitivity: Sensitivity;
  autoFormat: AutoFormat;
}

export const DEFAULT_SETTINGS: GroupSettings = {
  autoEnabled: false,
  sensitivity: "casual",
  autoFormat: "both",
};

export interface SettingsStore {
  get(groupId: string): Promise<GroupSettings | null>;
  upsert(groupId: string, settings: GroupSettings): Promise<void>;
  reset(): void;
}
