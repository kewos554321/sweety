import type { Companion } from "@/db/schema";

export interface NewCompanionInput {
  lineUserId: string;
  name: string;
  personality: string;
  avatar: string;
}

export interface CompanionStore {
  list(lineUserId: string): Promise<Companion[]>;
  insert(companion: NewCompanionInput): Promise<Companion>;
  delete(lineUserId: string, name: string): Promise<boolean>;
  reset(): void;
}
