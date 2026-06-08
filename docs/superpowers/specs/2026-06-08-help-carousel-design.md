# /help Carousel Redesign

**Date:** 2026-06-08  
**Status:** Approved

## Problem

`buildHelpFlexMessage()` renders a single LINE Flex bubble listing all commands with a separator between each. As the command set grows, the bubble becomes too long to scan on mobile — hard to scroll, hard to find specific commands, and lacks clear structure.

## Solution

Replace the single bubble with a 3-bubble carousel, grouping commands by theme. This mirrors the existing `/topic` carousel pattern and requires no change to how users invoke `/help`.

## Carousel Structure

### Bubble 1 — Grammar (`#7B61FF`)
**Header subtitle:** `Grammar Tools`

| Command | Description |
|---|---|
| `@Sweety <sentence>` | Fix & improve your English |
| `@Sweety /define <word>` | Word meaning & usage |
| `@Sweety /define --all <word>` | Same + etymology |

Includes trigger hint section: `@Sweety  or  !sweety  or  !swt`

### Bubble 2 — Speaking (`#5B4FCF`)
**Header subtitle:** `Speaking Practice`

| Command | Description |
|---|---|
| `@Sweety /topic` | Full IELTS Speaking topic set |
| `@Sweety /cheer @Someone` | Send encouragement |

### Bubble 3 — Group Settings (`#4A3FBF`)
**Header subtitle:** `Group Settings`

| Command | Description |
|---|---|
| `@Sweety /auto on\|off` | Toggle auto grammar check |
| `@Sweety /auto sensitivity casual\|strict` | Adjust sensitivity |
| `@Sweety /status` | View current settings |

Footer (xs, grey): `casual: big errors only · strict: articles, prepositions & word choice`

## Implementation Scope

- Modify `buildHelpFlexMessage()` in `lib/line.ts` only.
- Change `type: "bubble"` → `type: "carousel"` with `contents: [bubble1, bubble2, bubble3]`.
- No changes to command routing, tests, or any other file.

## Color Palette

Same gradient used by `/topic`:
- `#7B61FF` — primary purple
- `#5B4FCF` — mid purple  
- `#4A3FBF` — deep purple

Header text colors follow existing convention: title `#FFFFFF`, subtitle `#EEE9FF`.
