import type { GroupSettings, SettingsStore } from "./types";

export class MemorySettingsStore implements SettingsStore {
  private rows = new Map<string, GroupSettings>();

  async get(groupId: string): Promise<GroupSettings | null> {
    return this.rows.get(groupId) ?? null;
  }

  async upsert(groupId: string, settings: GroupSettings): Promise<void> {
    this.rows.set(groupId, settings);
  }

  reset(): void {
    this.rows.clear();
  }
}
