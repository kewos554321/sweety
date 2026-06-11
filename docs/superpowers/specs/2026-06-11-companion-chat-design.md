# Companion Chat Design

**Date:** 2026-06-11
**Status:** Approved

## Problem

Sweety currently only responds to grammar/coaching requests (`@Sweety <sentence>`, `/define`, `/topic`, etc.) and silently corrects grammar in auto mode. There's no way for a user to have Sweety act as a casual chat partner — e.g. when other group members are busy/unavailable and the user just wants someone to talk to.

## Solution

A new "Companion Chat" feature: each LINE user can register up to 5 custom chat companions (name + personality, free text). In a group chat, the user can manually call up to 3 of their companions into a live conversation session. While the session is active, every plain message the user sends (no `@Sweety` needed) gets a reply from each active companion, in-character, with shared conversation context so companions can react to each other and to the user.

## Commands

All commands require the `@Sweety` mention or `!sweety`/`!swt` prefix, consistent with existing commands.

| Command | Scope | Description |
|---------|-------|-------------|
| `@Sweety /agent create <name> \| <personality>` | Group or DM | Register a new companion. Example: `@Sweety /agent create 小兔兔 \| 活潑愛開玩笑,常常用兔子相關的梗` |
| `@Sweety /agent list` | Group or DM | List your registered companions (avatar, name, personality summary) |
| `@Sweety /agent delete <name>` | Group or DM | Delete a companion |
| `@Sweety /chat <name1>,<name2>,...` | Group only | Start a chat session in this group with 1–3 of your companions |
| `@Sweety /chat off` | Group only | End your active chat session in this group |
| `@Sweety /chat` (no args) | Group only | Show usage and your registered companion names |

`/agent *` commands operate on data scoped to the LINE user (`lineUserId`), independent of group — they work in both group chats and DMs. `/chat` requires a group, the same restriction as `/auto`, since the "companion fills in while others are busy" scenario only makes sense in a group.

## Limits

- Max **5** registered companions per user
- Max **3** active companions per chat session
- Companion name: 1–20 characters, must not contain `|`, `,`, or `@` (these are used as command/list separators)
- Personality description: 1–200 characters

## Data Model

New `companions` table (Neon Postgres via Drizzle), added to `db/schema.ts`:

```ts
export const companions = pgTable("companions", {
  id: serial("id").primaryKey(),
  lineUserId: varchar("line_user_id", { length: 100 }).notNull(),
  name: varchar("name", { length: 20 }).notNull(),
  personality: text("personality").notNull(),
  avatar: varchar("avatar", { length: 8 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqueNamePerUser: unique().on(t.lineUserId, t.name),
}));
```

Companion data is **persisted** (unlike group settings, which are in-memory). It survives server restarts.

### Avatar assignment

Each companion gets an emoji avatar automatically assigned at creation time, cycling through a fixed palette based on how many companions the user already has:

```ts
const AVATAR_PALETTE = ["🐰", "🐱", "🦊", "🐶", "🐻", "🐼", "🦁", "🐯", "🐨", "🐸"];
// avatar = AVATAR_PALETTE[existingCount % AVATAR_PALETTE.length]
```

With a 5-companion cap and 10 emojis in the palette, every user's companions have distinct avatars.

## Chat Session Lifecycle (new file `lib/companions.ts`)

In-memory session state, separate from the persisted `companions` table:

```ts
type ChatTurn = { speaker: string; text: string }; // speaker: "User" or a companion's name

type ChatSession = {
  agents: Companion[];                   // 1-3 companions, snapshot fetched from DB at /chat time
  history: ChatTurn[];                   // shared conversation log, capped at last 20 turns
  timer: ReturnType<typeof setTimeout>;  // 10-minute inactivity timeout
};

const chatSessions = new Map<string, ChatSession>(); // key: `${groupId}:${userId}`
```

- **Start**: `/chat <names>` looks up the named companions for this `lineUserId`, validates count (1-3) and existence, then creates a fresh session (empty history, new timer). Calling `/chat` again **replaces** any existing session for that `groupId:userId`, even if the companion list overlaps.
- **End**: `/chat off` deletes the session and replies "👋 陪聊結束,有需要再 @Sweety /chat 找夥伴聊天". If no session exists, reply "目前沒有進行中的陪聊".
- **Timeout**: after 10 minutes with no qualifying message from the user, the session is deleted silently — no message is sent (avoids needing the Push API).
- **Deleting a companion** (`/agent delete`) does not affect a session currently using it — the session holds a snapshot copied at `/chat` time.

## Message Flow (`lib/line.ts`)

In the existing `!isMentioned && !isBangTriggered` branch (where auto mode currently lives), add a check **before** the auto-mode logic:

```
group message && doesn't start with "/" && non-empty
  ├─ user has an active chat session in this group?
  │    └─ yes → companion reply flow (skip auto mode entirely for this message)
  └─ no → existing auto mode logic (unchanged)
```

Companion chat messages are **not** subject to auto-mode-v2's "≥4 English words" filter — companion chat is real-time conversation and short replies/non-English text are expected.

### Companion reply flow

1. `history.push({ speaker: "User", text: userMessage })`; reset the 10-minute inactivity timer.
2. For each companion in `session.agents`, in order:
   - Call `companionChat(agent, otherNames, history)` (Gemini)
   - If it returns text, push `{ speaker: agent.name, text: reply }` onto `history` immediately — so later companions in the same turn see what earlier companions just said
   - If it returns `null` (empty/blocked response), skip this companion for this turn
3. Trim `history` to the last 20 entries.
4. If at least one companion replied, send all replies as separate text messages in a single `replyMessage` call (max 3, well under LINE's 5-message limit). If none replied, send nothing (silent, same convention as `autoCheck` returning no correction).

### Interaction with existing features

- **Auto mode**: Sessions are per-user (`groupId:userId`). Only the messages of the user who has an active session are diverted to the companion flow; other group members' messages continue to be checked by auto mode as normal, unaffected.
- **`@Sweety` mention / `!sweety` / `!swt`** (grammar fix, `/define`, `/topic`, `/cheer`, `/auto`, `/status`, `/help`, `/debug`): Unaffected. These are handled in the mention/bang-triggered branch, which is checked independently of — and takes priority over — the companion session check. They behave identically whether or not the user has an active chat session.
- **`/agent create|list|delete`**: Work regardless of session state, in both groups and DMs.

## Reply Generation (`lib/claude.ts` — `companionChat`)

```ts
export async function companionChat(
  agent: { name: string; personality: string },
  otherNames: string[],
  history: ChatTurn[]
): Promise<string | null>
```

System prompt:

```
You are {agent.name}, a character in a casual LINE group chat.
Your personality: {agent.personality}

Other participants: a human user{otherNames.length ? `, and ${otherNames.join(", ")}` : ""}.

Rules:
- Reply naturally and briefly (1-3 sentences)
- Reply in the SAME language the user is using (Chinese, English, etc.)
- You may react to what others (including other companions) just said
- Do not prefix your reply with your name - just write the message
- No Markdown

Conversation so far:
{history formatted as "speaker: text" lines, last 20}

Respond as {agent.name}.
```

Uses `gemini-2.5-flash`, consistent with other functions in `lib/claude.ts`. Strips Markdown from the response (reuse the `stripMarkdown` approach). Returns `null` if `response.text` is empty.

## LINE Message Format

Each companion reply becomes its own text message, prefixed with avatar + name:

```ts
function buildCompanionMessages(replies: { avatar: string; name: string; text: string }[]): TextMessage[] {
  return replies.map(r => ({ type: "text", text: `${r.avatar} ${r.name}: ${r.text}` }));
}
```

Example: `"🐰 小兔兔: 哈囉~今天過得好嗎?"`

`/agent list` and `/chat` confirmation messages also show avatar + name, e.g. "🐰 小兔兔、🦊 小明 加入聊天啦!直接打字就能跟他們聊,想結束輸入 @Sweety /chat off"。No `quoteToken` is used for companion replies (unlike auto mode's quote-reply) — companion chat is a continuous conversation, not a reply to one specific message.

## Command Error Handling

| Case | Response |
|------|----------|
| `/agent create` missing `\|` or empty fields | Usage example: `@Sweety /agent create 小兔兔 \| 活潑愛開玩笑` |
| Name >20 chars / contains `\|`, `,`, `@` / personality >200 chars | Format error message |
| User already has 5 companions | "你已經有 5 個夥伴了,請先 `/agent delete` 一個再建立新的" |
| Duplicate name for this user | "你已經有一個叫「X」的夥伴了,換個名字或先刪除舊的" |
| `/agent delete <name>` not found | "找不到名字叫「X」的夥伴" |
| `/agent list` with no companions | "你還沒有註冊任何夥伴,試試 `@Sweety /agent create 名字 \| 個性`" |
| `/chat` used in a DM | "陪聊功能僅限群組使用" |
| `/chat` with no args | Usage + list of registered companion names (with avatars) |
| `/chat` with >3 names | "一次最多只能找 3 個夥伴一起聊" |
| `/chat` names not found | "找不到夥伴:X。你已註冊的夥伴:🐰 小兔兔、🦊 小明" |
| `/chat off` with no active session | "目前沒有進行中的陪聊" |

## Safety Note (Known Limitation)

`personality` is free text injected directly into an LLM system prompt, so it is theoretically subject to prompt injection by the user who wrote it. v1 does not add extra content moderation beyond Gemini's built-in safety filtering. If a response is empty or blocked, that companion is silently skipped for the turn (covered by the reply-flow error handling above).

## `/help` Update

Add a new bubble "Chat Companions" to the carousel in `buildHelpFlexMessage()`:

- `@Sweety /agent create <name> | <personality>` — Create a custom chat companion
- `@Sweety /agent list` — List your companions
- `@Sweety /agent delete <name>` — Delete a companion
- `@Sweety /chat <name1>,<name2>` — Bring up to 3 companions into this group chat
- `@Sweety /chat off` — End the chat session
- Footer (`xs`, `#9CA3AF`): "Companions remember the chat. Ends after 10 min of silence."

## Files Changed

| File | Change |
|------|--------|
| `db/schema.ts` | Add `companions` table |
| `lib/companions.ts` (new) | DB CRUD for companions, avatar palette, in-memory chat session map and lifecycle |
| `lib/claude.ts` | Add `companionChat()` |
| `lib/line.ts` | Add `/agent` and `/chat` command handlers; add session-check branch ahead of auto mode; add `buildCompanionMessages()`; add "Chat Companions" bubble to `/help` |

## Testing

- `lib/companions.test.ts`: CRUD validation (limits, duplicate names, name/personality format, avatar assignment), session lifecycle (`/chat` start/replace, `/chat off`, 10-minute timeout via fake timers, history capped at 20)
- `companionChat` tests (mirroring `autocheck.test.ts`'s Gemini-mocking pattern): prompt construction, `null` returned on empty/blocked response

## Out of Scope (v1)

- Web form / LIFF login for registration
- Editing existing companions (delete + recreate only)
- Using `/chat` in a DM
- Bot-initiated messages on a timer (would require the Push API)
- Persisting chat session history across restarts (in-memory only, like `debounceMap`)
- Showing chat session status in `/status`
