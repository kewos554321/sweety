import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { companions } from "@/db/schema";
import type { Companion } from "@/db/schema";
import type { CompanionStore, NewCompanionInput } from "./types";

export class DbCompanionStore implements CompanionStore {
  async list(lineUserId: string): Promise<Companion[]> {
    return getDb().select().from(companions).where(eq(companions.lineUserId, lineUserId));
  }

  async insert(companion: NewCompanionInput): Promise<Companion> {
    const rows = await getDb().insert(companions).values(companion).returning();
    return rows[0];
  }

  async delete(lineUserId: string, name: string): Promise<boolean> {
    const rows = await getDb()
      .delete(companions)
      .where(and(eq(companions.lineUserId, lineUserId), eq(companions.name, name)))
      .returning();
    return rows.length > 0;
  }

  reset(): void {
    // no-op; production store, not used in tests
  }
}
