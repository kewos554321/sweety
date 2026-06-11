# DB Integration Design — Persist Group Settings to Neon

**Date:** 2026-06-11
**Status:** Approved

## Problem

Group settings (`autoEnabled`, `sensitivity`, `autoFormat`) are stored in an
in-memory `Map` (`lib/settings.ts`). On a serverless deployment this state is
lost on cold start / restart / multi-instance scale-out, silently resetting
every group back to defaults (`auto off`, `casual`, `both`).

The project already has Neon + Drizzle scaffolding (`lib/db.ts`,
`drizzle.config.ts`, `db/schema.ts` with an unused `conversations` table) and
a Neon database is now provisioned (`DATABASE_URL` set in `.env`), but none of
it is wired up to real application logic.

## Solution

Replace the in-memory settings store with a `group_settings` table in Neon,
accessed through a small repository abstraction (`SettingsStore`) so the
public API of `lib/settings.ts` stays mostly the same (just `async`) and unit
tests can keep using an in-memory implementation without touching the network.

The unused `conversations` table is removed — out of scope for this change,
and nothing references it.

## 1. Schema

`db/schema.ts` — remove `conversations`, add `group_settings`:

```ts
import { pgTable, varchar, boolean, timestamp } from "drizzle-orm/pg-core";

export const groupSettings = pgTable("group_settings", {
  groupId: varchar("group_id", { length: 100 }).primaryKey(),
  autoEnabled: boolean("auto_enabled").notNull().default(false),
  sensitivity: varchar("sensitivity", { length: 10 }).notNull().default("casual"),
  autoFormat: varchar("auto_format", { length: 10 }).notNull().default("both"),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type GroupSettingsRow = typeof groupSettings.$inferSelect;
```

- `groupId` is the primary key — one row per LINE group.
- `sensitivity` / `autoFormat` are stored as `varchar`, mirroring the existing
  TS union types (`"casual" | "strict"`, `"fix" | "try" | "both"`). No Postgres
  enum, so adding a new value later doesn't require a migration to alter the
  enum type.
- `updatedAt` is informational (last write time); nothing reads it yet.

## 2. Architecture — Repository Pattern

```
lib/
  settings.ts                 # public API (getSettings/setSettings/resetSettings), now async
  settings-store/
    types.ts                  # SettingsStore interface + GroupSettings/Sensitivity/AutoFormat types
    memory.ts                 # MemorySettingsStore (tests — same behavior as today's Map)
    db.ts                     # DbSettingsStore (Drizzle + Neon)
db/
  schema.ts                   # remove conversations, add group_settings
```

**`SettingsStore` interface** (`lib/settings-store/types.ts`):

```ts
export interface SettingsStore {
  get(groupId: string): Promise<GroupSettings | null>;
  upsert(groupId: string, settings: GroupSettings): Promise<void>;
  reset(): void; // memory-only; no-op on DbSettingsStore
}
```

**`lib/settings.ts`** (rewritten):

```ts
const store: SettingsStore =
  process.env.VITEST ? new MemorySettingsStore() : new DbSettingsStore();

export async function getSettings(groupId: string): Promise<GroupSettings> {
  const row = await store.get(groupId);
  return row ?? { ...DEFAULT_SETTINGS };
}

export async function setSettings(groupId: string, patch: Partial<GroupSettings>): Promise<void> {
  const current = await getSettings(groupId);
  await store.upsert(groupId, { ...current, ...patch });
}

export function resetSettings(): void {
  store.reset();
}
```

**`DbSettingsStore`** (`lib/settings-store/db.ts`):
- `get(groupId)` — `SELECT * FROM group_settings WHERE group_id = ?`. No row →
  return `null`. On query error, log to `console.error` and return `null` (caller
  falls back to `DEFAULT_SETTINGS`).
- `upsert(groupId, settings)` — `INSERT ... ON CONFLICT (group_id) DO UPDATE`,
  always writing the full settings object (no partial-column updates).
- `reset()` — no-op (only `MemorySettingsStore` is used in tests).

**`lib/db.ts` becomes lazy.** Currently it calls `neon(process.env.DATABASE_URL!)`
at module-evaluation time. Since `lib/settings-store/db.ts` is statically
imported by `lib/settings.ts` (which is imported by `lib/line.ts` and its
tests), an eager client would try to construct a Neon connection during
`vitest run` even when `MemorySettingsStore` is the one actually used —
throwing at import time if `DATABASE_URL` isn't set in the test environment.
Fix: export a `getDb()` function that builds the client on first call, and
have `DbSettingsStore` call `getDb()` inside `get`/`upsert`, not at
construction:

```ts
// lib/db.ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

let _db: ReturnType<typeof drizzle> | undefined;

export function getDb() {
  if (!_db) _db = drizzle(neon(process.env.DATABASE_URL!), { schema });
  return _db;
}
```

**`MemorySettingsStore`** (`lib/settings-store/memory.ts`): same `Map`-based
behavior as the current implementation in `lib/settings.ts`.

**Default values:** read-only fallback, write-time upsert. A group with no row
yet gets `DEFAULT_SETTINGS` from `getSettings` without writing anything. The
first `setSettings` call (`/auto on`, `/sensitivity ...`, `/format ...`)
upserts a full row.

## 3. Error Handling

- **Read failure** (Neon unreachable, etc.): `DbSettingsStore.get` logs the
  error and returns `null` → `getSettings` returns `DEFAULT_SETTINGS`. The bot
  keeps responding using defaults instead of failing the webhook.
- **Write failure**: not specially handled — the error propagates from
  `setSettings`. Acceptable for v1 since this only affects `/auto`,
  `/sensitivity`, `/format` command replies (rare DB outage edge case).

## 4. Caching

None for v1. Every `getSettings` call hits Neon directly. Group count is small
and Neon's HTTP driver latency is acceptable. Revisit only if this becomes a
measured bottleneck.

## 5. Files Changed

| File | Change |
|------|--------|
| `db/schema.ts` | Remove `conversations`, add `group_settings` |
| `lib/db.ts` | Change eager `export const db` to lazy `export function getDb()` |
| `lib/settings-store/types.ts` | New: `SettingsStore` interface, `GroupSettings`/`Sensitivity`/`AutoFormat` types (moved from `lib/settings.ts`) |
| `lib/settings-store/memory.ts` | New: `MemorySettingsStore` |
| `lib/settings-store/db.ts` | New: `DbSettingsStore` |
| `lib/settings.ts` | Rewrite: `getSettings`/`setSettings` become `async`, store selected by `process.env.VITEST`; types re-exported |
| `lib/settings.test.ts` | Add `await` at call sites; assertions unchanged |
| `lib/line.ts` | Add `await` at 5 call sites: line 213 (`buildStatusFlexMessage`, becomes `async`, call site at line 628 also gets `await`), 540, 645, 654, 665, 676 |

`debounceMap` and the debug `eventLog` in `lib/line.ts` / `lib/settings.ts`
remain in-memory and unchanged — they're short-lived/debug-only state, out of
scope for this persistence work.

## 6. Migration Plan

1. `npm run db:generate` — generates SQL migration from the new schema
   (`DROP TABLE conversations` + `CREATE TABLE group_settings`).
2. `npm run db:migrate` — applies it to the Neon DB referenced by
   `DATABASE_URL` in `.env`.
3. Ensure the production deployment's environment variables also have
   `DATABASE_URL` set to the same Neon connection string, and run
   `db:migrate` against production before/at deploy time.

## Out of Scope

- Conversation/correction history logging (the removed `conversations` table)
- Caching layer
- Any change to debounce buffering or debug event log behavior
