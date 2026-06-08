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

// --- Auto mode debounce ---

export function hasEnoughWords(text: string): boolean {
  return text.trim().split(/\s+/).filter(w => /[a-zA-Z]/.test(w)).length >= 4;
}

type DebounceEntry = {
  messages: string[];
  replyToken: string;
  timer: ReturnType<typeof setTimeout>;
};

const debounceMap = new Map<string, DebounceEntry>();

export function scheduleAutoCheck(
  key: string,
  message: string,
  replyToken: string,
  onFire: (messages: string[], replyToken: string) => void,
  delayMs = 5000
): void {
  const existing = debounceMap.get(key);
  if (existing) {
    clearTimeout(existing.timer);
    existing.messages.push(message);
    existing.replyToken = replyToken;
    existing.timer = setTimeout(() => {
      debounceMap.delete(key);
      onFire(existing.messages, existing.replyToken);
    }, delayMs);
  } else {
    const entry: DebounceEntry = {
      messages: [message],
      replyToken,
      timer: setTimeout(() => {
        debounceMap.delete(key);
        onFire(entry.messages, entry.replyToken);
      }, delayMs),
    };
    debounceMap.set(key, entry);
  }
}

export function resetDebounce(): void {
  for (const entry of debounceMap.values()) clearTimeout(entry.timer);
  debounceMap.clear();
}
