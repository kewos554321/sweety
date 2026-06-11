import type { Companion } from "@/db/schema";

export type ChatTurn = { speaker: string; text: string };

export interface ChatSession {
  agents: Companion[];
  history: ChatTurn[];
}

interface InternalSession extends ChatSession {
  timer: ReturnType<typeof setTimeout>;
}

export const MAX_HISTORY = 20;
export const SESSION_TIMEOUT_MS = 10 * 60 * 1000;

const sessions = new Map<string, InternalSession>();

function sessionKey(groupId: string, userId: string): string {
  return `${groupId}:${userId}`;
}

function scheduleTimeout(key: string): ReturnType<typeof setTimeout> {
  return setTimeout(() => sessions.delete(key), SESSION_TIMEOUT_MS);
}

export function startSession(groupId: string, userId: string, agents: Companion[]): void {
  const key = sessionKey(groupId, userId);
  const existing = sessions.get(key);
  if (existing) clearTimeout(existing.timer);

  sessions.set(key, { agents, history: [], timer: scheduleTimeout(key) });
}

export function endSession(groupId: string, userId: string): boolean {
  const key = sessionKey(groupId, userId);
  const existing = sessions.get(key);
  if (!existing) return false;

  clearTimeout(existing.timer);
  sessions.delete(key);
  return true;
}

export function getSession(groupId: string, userId: string): ChatSession | undefined {
  return sessions.get(sessionKey(groupId, userId));
}

export function appendTurn(groupId: string, userId: string, turn: ChatTurn): void {
  const key = sessionKey(groupId, userId);
  const session = sessions.get(key);
  if (!session) return;

  session.history.push(turn);
  if (session.history.length > MAX_HISTORY) {
    session.history.splice(0, session.history.length - MAX_HISTORY);
  }

  clearTimeout(session.timer);
  session.timer = scheduleTimeout(key);
}

export function resetSessions(): void {
  for (const session of sessions.values()) clearTimeout(session.timer);
  sessions.clear();
}
