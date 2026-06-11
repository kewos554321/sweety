import type { Companion } from "@/db/schema";
import type { CompanionStore, NewCompanionInput } from "./types";

export class MemoryCompanionStore implements CompanionStore {
  private rows: Companion[] = [];
  private nextId = 1;

  async list(lineUserId: string): Promise<Companion[]> {
    return this.rows.filter((c) => c.lineUserId === lineUserId);
  }

  async insert(companion: NewCompanionInput): Promise<Companion> {
    const row: Companion = { id: this.nextId++, createdAt: new Date(), ...companion };
    this.rows.push(row);
    return row;
  }

  async delete(lineUserId: string, name: string): Promise<boolean> {
    const index = this.rows.findIndex((c) => c.lineUserId === lineUserId && c.name === name);
    if (index === -1) return false;
    this.rows.splice(index, 1);
    return true;
  }

  reset(): void {
    this.rows = [];
    this.nextId = 1;
  }
}
