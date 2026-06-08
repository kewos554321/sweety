# Auto Mode Design

**Date:** 2026-06-08  
**Project:** Sweety LINE Bot  
**Status:** Approved

## Overview

Add an auto grammar-checking mode to Sweety. When enabled, Sweety monitors all messages in a group without requiring `@Sweety` mentions. It silently ignores correct sentences and only replies when a grammar error meets the configured sensitivity threshold.

## Commands

| Command | Description |
|---------|-------------|
| `@Sweety /auto on` | Enable auto mode for this group |
| `@Sweety /auto off` | Disable auto mode for this group |
| `@Sweety /auto sensitivity low\|medium\|high` | Adjust correction sensitivity |
| `@Sweety /status` | Show current group settings as Flex Message |

- Settings are **per-group** (each LINE group has independent config)
- Any group member can change the settings (no role restriction)
- Default: `autoEnabled: false`, `sensitivity: "medium"`

## Sensitivity Levels

| Level | Correction Scope |
|-------|-----------------|
| `low` | Serious errors only: subject-verb disagreement, wrong tense, missing subject/verb |
| `medium` | Low + article errors (a/an/the), preposition misuse, common confused words |
| `high` | Medium + unnatural phrasing, poor word choice, unnatural word order |

The sensitivity level is passed to Claude in the prompt. Claude returns a correction only when the error meets the threshold; otherwise it signals no issue and Sweety stays silent.

## Architecture

### New file: `lib/settings.ts`

Holds the in-memory store for group settings.

```ts
type GroupSettings = {
  autoEnabled: boolean;
  sensitivity: "low" | "medium" | "high";
};

const groupSettings = new Map<string, GroupSettings>();

function getSettings(groupId: string): GroupSettings
function setSettings(groupId: string, patch: Partial<GroupSettings>): void
```

### New function: `lib/claude.ts` — `autoCheck`

```ts
autoCheck(text: string, sensitivity: "low" | "medium" | "high"): Promise<FixResult | null>
```

Returns `null` when no correction is needed (Sweety stays silent). Returns a `FixResult` when an error meets the threshold.

### Changes to `lib/line.ts`

**Auto mode trigger logic:**
1. Message has no `@Sweety` mention → check if group has `autoEnabled: true`
2. If auto is on → call `autoCheck(text, sensitivity)`
3. If result is `null` → do nothing
4. If result is a `FixResult` → reply with existing `buildFlexMessage`

**New `/auto` command handler:**
- `/auto on` → `setSettings(groupId, { autoEnabled: true })`
- `/auto off` → `setSettings(groupId, { autoEnabled: false })`
- `/auto sensitivity <level>` → validate level, then `setSettings(groupId, { sensitivity: level })`

**New `/status` command handler:**
- Reads `getSettings(groupId)` and replies with a Flex Message card.

### `/status` Flex Message Layout

```
Header (purple #7B61FF):
  Sweety ✨
  Group Settings

Body:
  ⚡ Auto Mode     ON  (green) / OFF (grey)
  🎯 Sensitivity   medium
  ─────────────────────────────
  Use @Sweety /auto on|off to toggle
  Use @Sweety /auto sensitivity low|medium|high
```

### `/help` Updates

Add three new entries:
- `@Sweety /auto on|off` — Toggle auto grammar checking for this group
- `@Sweety /auto sensitivity low|medium|high` — Adjust correction sensitivity
- `@Sweety /status` — View current group settings

## Constraints

- **In-memory only**: settings reset on server restart. Upgrading to DB persistence (Neon + Drizzle) is deferred.
- Auto mode only applies when the group ID is available in the event (`event.source.type === "group"`). Direct messages (1:1) are excluded.
- Auto mode does not apply to messages that start with `/` (commands) to avoid false positives.
- The existing `@Sweety`-triggered flow is unchanged.

## Out of Scope

- DB persistence (deferred)
- Per-user sensitivity settings
- Admin-only toggle restriction
