import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { groupSettings } from "@/db/schema";
import type { AutoFormat, GroupSettings, Sensitivity, SettingsStore } from "./types";

export class DbSettingsStore implements SettingsStore {
  async get(groupId: string): Promise<GroupSettings | null> {
    try {
      const rows = await getDb()
        .select()
        .from(groupSettings)
        .where(eq(groupSettings.groupId, groupId));
      const row = rows[0];
      if (!row) return null;
      return {
        autoEnabled: row.autoEnabled,
        sensitivity: row.sensitivity as Sensitivity,
        autoFormat: row.autoFormat as AutoFormat,
      };
    } catch (err) {
      console.error("[settings] failed to read group settings", err);
      return null;
    }
  }

  async upsert(groupId: string, settings: GroupSettings): Promise<void> {
    await getDb()
      .insert(groupSettings)
      .values({ groupId, ...settings })
      .onConflictDoUpdate({
        target: groupSettings.groupId,
        set: { ...settings, updatedAt: new Date() },
      });
  }

  reset(): void {
    // no-op; production store, not used in tests
  }
}
