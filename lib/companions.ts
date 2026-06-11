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
