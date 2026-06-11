import { MemoryCompanionStore } from "./companion-store/memory";
import { DbCompanionStore } from "./companion-store/db";
import type { CompanionStore } from "./companion-store/types";
import type { Companion } from "@/db/schema";

export const AVATAR_PALETTE = ["🐰", "🐱", "🦊", "🐶", "🐻", "🐼", "🦁", "🐯", "🐨", "🐸"];

export const MAX_COMPANIONS = 5;
export const MAX_ACTIVE_AGENTS = 3;
export const MAX_NAME_LENGTH = 20;
export const MAX_PERSONALITY_LENGTH = 200;

export function pickAvatar(existingCount: number): string {
  return AVATAR_PALETTE[existingCount % AVATAR_PALETTE.length];
}

export function validateCompanionName(name: string): string | null {
  if (name.length < 1 || name.length > MAX_NAME_LENGTH || /[|,@]/.test(name)) {
    return `Name must be 1-${MAX_NAME_LENGTH} characters and cannot contain |, ,, or @`;
  }
  return null;
}

export function validateCompanionPersonality(personality: string): string | null {
  if (personality.length < 1 || personality.length > MAX_PERSONALITY_LENGTH) {
    return `Personality must be 1-${MAX_PERSONALITY_LENGTH} characters`;
  }
  return null;
}

const store: CompanionStore = process.env.VITEST ? new MemoryCompanionStore() : new DbCompanionStore();

export type CreateCompanionResult =
  | { ok: true; companion: Companion }
  | { ok: false; error: string };

export async function listCompanions(lineUserId: string): Promise<Companion[]> {
  return store.list(lineUserId);
}

export async function createCompanion(
  lineUserId: string,
  name: string,
  personality: string
): Promise<CreateCompanionResult> {
  const nameError = validateCompanionName(name);
  if (nameError) return { ok: false, error: nameError };

  const personalityError = validateCompanionPersonality(personality);
  if (personalityError) return { ok: false, error: personalityError };

  const existing = await store.list(lineUserId);

  if (existing.length >= MAX_COMPANIONS) {
    return { ok: false, error: `You already have ${MAX_COMPANIONS} companions. Delete one with /agent delete before creating a new one` };
  }

  if (existing.some((c) => c.name === name)) {
    return { ok: false, error: `You already have a companion named "${name}". Choose a different name or delete the old one first` };
  }

  const avatar = pickAvatar(existing.length);
  const companion = await store.insert({ lineUserId, name, personality, avatar });
  return { ok: true, companion };
}

export async function deleteCompanion(lineUserId: string, name: string): Promise<boolean> {
  return store.delete(lineUserId, name);
}

export function resetCompanions(): void {
  store.reset();
}
