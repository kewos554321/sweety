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
    return `名字需為 1-${MAX_NAME_LENGTH} 字,且不能包含 | , @ 符號`;
  }
  return null;
}

export function validateCompanionPersonality(personality: string): string | null {
  if (personality.length < 1 || personality.length > MAX_PERSONALITY_LENGTH) {
    return `個性描述需為 1-${MAX_PERSONALITY_LENGTH} 字`;
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
    return { ok: false, error: `你已經有 ${MAX_COMPANIONS} 個夥伴了,請先 /agent delete 一個再建立新的` };
  }

  if (existing.some((c) => c.name === name)) {
    return { ok: false, error: `你已經有一個叫「${name}」的夥伴了,換個名字或先刪除舊的` };
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
