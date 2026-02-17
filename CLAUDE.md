# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Forge is an iOS app for tracking workouts with wave-loaded periodization. Built with **Tauri v2 + React 18 + TypeScript + Vite + Tailwind CSS + SQLite**. Bundle ID: `com.forge.app`.

The original PWA version is preserved as `index.pwa.html` for reference. Primary development branch is `forge`.

## Development

```bash
npm install                    # Install dependencies
npm run dev                    # Frontend only (no Tauri, port 1420)
npm run tauri ios dev          # Run on iOS Simulator
npm run tauri ios build        # Production iOS build
node scripts/generate-icon.mjs # Regenerate app icon PNGs from SVG
```

Requires: Node.js, Rust (via rustup), Xcode 15+. If cargo is not in PATH: `PATH="$HOME/.cargo/bin:$PATH"`.

## Architecture

### Tech Stack
- **Mobile wrapper:** Tauri v2 (Rust, native iOS WebView via WKWebView)
- **Frontend:** React 18 + TypeScript + Vite 6 + Tailwind CSS 3
- **State:** Zustand 5 (UI state) + SQLite (persistent data via `@tauri-apps/plugin-sql`)
- **Charts:** Recharts (requires raw hex colors for SVG fill/stroke props)
- **IDs:** uuid v4 (all DB IDs are TEXT)
- **Animations:** Framer Motion

### Data Model (SQLite)

Two-tier template system:
- **Template tables** (`program_templates`, `exercise_templates`, `wave_config_templates`, etc.) — read-only seed data
- **User tables** (`programs`, `days`, `exercises`, `wave_configs`, etc.) — forked from templates, fully editable

Key tables: `training_maxes` (append-only), `workout_logs` + `set_logs` (workout data), `exercise_notes`, `strength_goals`, `user_settings`.

Schema: `src-tauri/migrations/001_initial_schema.sql`

### Key Domain Logic

- **Wave sets:** `getWaveSets()` in `src/lib/wave.ts` — warmup + working sets from percentage configs
- **e1RM:** Epley formula in `src/lib/calc.ts`: `weight * (1 + reps/30)`
- **Template forking:** `forkTemplate()` in `src/lib/seed.ts` — deep copies template into user-editable tables
- **Main lifts:** bench, squat, deadlift, OHP (defined in `MAIN_LIFTS` constant)
- **Two templates seeded:** Wave Periodization + Wendler's 5/3/1

### Tailwind Theme

Colors defined in `tailwind.config.js`:
```
bg: #0d1117, card: #161b22, input: #0d1117
border: #21262d, border-elevated: #30363d, border-focus: #f5a623
accent: #f5a623, success: #2ea043, danger: #e94560
text: #c9d1d9, bright: #e6edf3, muted: #8b949e, dim: #636e72, faint: #484f58
tech: #e94560, superset: #4a6fa5, accessory: #636e72
font-sans: -apple-system, SF Pro Display, system-ui, sans-serif
font-mono: SF Mono, Menlo, Consolas, monospace
```

## Critical Patterns

### SQLite Connection Pool Gotcha
**tauri-plugin-sql uses a connection pool.** `BEGIN TRANSACTION` / `COMMIT` is broken because each `db.execute()` can land on a different pool connection. Use `withWriteLock()` from `src/lib/db.ts` for any multi-statement write operation. See tauri-apps/tauri-plugin-sql#886.

### React StrictMode
StrictMode double-fires effects. Use a `useRef` flag for init effects that must run exactly once:
```typescript
const initRan = useRef(false)
useEffect(() => {
  if (initRan.current) return
  initRan.current = true
  // ... init logic
}, [])
```

### iOS-Specific Requirements
- **Safe areas:** `pt-[env(safe-area-inset-top)]` on root, `pb-[calc(64px+env(safe-area-inset-bottom))]` on scrollable content
- **Touch targets:** minimum 44x44px (`min-w-[44px] min-h-[44px]`)
- **Number inputs:** must use `text-[16px]` minimum + `inputMode="decimal"` (prevents iOS auto-zoom)
- **Tap feedback:** use `active:` states alongside `hover:` (e.g., `hover:border-accent active:border-accent`)
- **Portrait only:** configured in `src-tauri/gen/apple/project.yml`
- **Window config required:** `app.windows` MUST exist in `tauri.conf.json` — iOS requires explicit window config or WebView stays blank
- **Capabilities:** need `windows: ["main"]` + `webviews: ["main"]` in `src-tauri/capabilities/default.json`
- **ATS:** Info.plist needs `NSAllowsLocalNetworking` for dev mode
- **`tauri ios init`** regenerates the Xcode project — re-apply Info.plist customizations after running it

### DB Singleton
`getDb()` in `src/lib/db.ts` caches the **Promise** (not the resolved value) to prevent race conditions when multiple callers request the DB simultaneously during init.

## Code Review Rules

### SQLite Query Safety
- All queries MUST use parameterized placeholders (`?`) — never interpolate variables
- `db.select<TypedRow[]>(sql, [params])` must always have a typed row generic
- Map snake_case columns to camelCase at the query site

### Hooks Pattern
- Custom hooks in `hooks/` must return a plain object (not an array)
- Hooks that call `getDb()` must be wrapped in `useCallback` with correct deps
- Loading/error state must be tracked — don't leave async hooks without a `loading` flag

### Component Rules
- Use Tailwind theme tokens (`bg-bg`, `text-accent`, `border-border`, etc.) — never hardcode hex inline (exception: Recharts SVG props require raw hex)
- Destructive actions require a confirmation step (see `SetRow` clear pattern)
- Use inline SVGs for icons (no icon library) — match BottomNav style: 24x24 viewBox, 1.5px stroke

### Domain Integrity
- All IDs must be uuid v4 via `uuid` package — never auto-increment
- Training maxes are append-only — never UPDATE or DELETE from `training_maxes`
- Weight calculations must go through `roundToNearest5()` from `lib/calc.ts`
- Wave set generation must use `getWaveSets()` — don't manually compute percentages

### Style
- No semicolons
- Single quotes for strings
- Trailing commas in multi-line arrays/objects
- `tsconfig.app.json` uses `isolatedModules` (not `verbatimModuleSyntax`)
