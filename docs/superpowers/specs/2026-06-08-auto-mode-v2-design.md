# Auto Mode v2 Design

**Date:** 2026-06-08  
**Status:** Approved

## Problem

Auto mode replies to every message individually:
- One Gemini API call per message → noisy and slow
- Full `buildFlexMessage()` response (Fixed + Alternatives + Vocab + Tip) is too long for background correction
- Users who send multiple messages quickly get flooded with one-by-one replies

## Solution

Three changes: debounce buffering, message filtering, and a lighter reply format.

## 1. Debounce Buffering (5 seconds)

Replace the current immediate-check-per-message model with a per-user per-group debounce.

**State** (added to `lib/settings.ts`):

```ts
type DebounceEntry = {
  messages: string[];
  replyToken: string;
  timer: ReturnType<typeof setTimeout>;
};

const debounceMap = new Map<string, DebounceEntry>();
// key: `${groupId}:${userId}`
```

**Flow when a message arrives in auto mode:**

1. Key = `${groupId}:${userId}`
2. If entry exists → clear existing timer, append message, update replyToken
3. If no entry → create new entry with this message and replyToken
4. Set a new 5-second timer; when it fires:
   - Delete the entry from `debounceMap`
   - Join buffered messages with `\n`
   - Call `autoCheck(combined, sensitivity)`
   - If result is non-null → reply using the saved replyToken with `buildAutoFlexMessage()`

**Why the last replyToken works:** LINE replyTokens are valid for ~30 seconds. The last message in a burst is at most a few seconds old when the timer fires, so it is always valid. Push API is not needed.

## 2. Message Length Filter

Before adding a message to the debounce buffer, skip it if it has fewer than 4 English words. This eliminates short reactions ("ok", "lol", "sounds good") that are not worth grammar-checking.

```ts
function hasEnoughWords(text: string): boolean {
  return text.trim().split(/\s+/).filter(w => /[a-zA-Z]/.test(w)).length >= 4;
}
```

## 3. Light Flex Format (`buildAutoFlexMessage()`)

A new builder, separate from `buildFlexMessage()`, used only by auto mode.

**Structure:**

```
Header (#7B61FF): Sweety ✨ / "<original sentence>"
Body:
  ✏️ Fixed     [corrected sentence]
  ── separator ──
  💬 Try this  [first alternative only]
```

No Vocab Upgrade section. No Tip section. The distinction is intentional: `buildFlexMessage()` remains the full coaching response for explicit `@Sweety` mentions; `buildAutoFlexMessage()` is a lightweight background nudge.

## 4. /help Update

In the Group Settings bubble, below the `/auto on|off` command row, add a footer line:

```
Sweety waits 5s after your last message, then checks quietly.
```

Size: `xs`, color: `#9CA3AF` (same style as the existing sensitivity footer line).

## Files Changed

| File | Change |
|------|--------|
| `lib/settings.ts` | Add `debounceMap`, `scheduleAutoCheck()` function |
| `lib/line.ts` | Replace inline `autoCheck` call with `scheduleAutoCheck()`; add `buildAutoFlexMessage()` |

No changes to `lib/claude.ts`, `autoCheck` prompt, or existing `buildFlexMessage()`.

## Constraints

- No push API — all replies use the debounce entry's saved replyToken
- In-memory only — debounce state resets on server restart (acceptable, same as settings)
- The 5-second window is a constant; no user-configurable option
