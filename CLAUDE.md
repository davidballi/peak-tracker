# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Model Routing

**Sonnet is the default for this project.** This is a single-app codebase (Tauri + React + SQLite) where Sonnet handles virtually all work at parity with Opus.

Only spawn **Opus subagents** (via Task tool with `model: "opus"`) for:
- Major architectural changes to the data model or migration system (SQLite schema redesigns)
- Tauri/Rust bridge work requiring deep reasoning about the native layer
- Complex debugging involving the SQLite connection pool or cross-layer Tauri ↔ WebView issues

For everything else (features, UI, bug fixes, new hooks, Zustand stores, charts, tests), handle directly with Sonnet.

## Project Overview

Forge is an iOS app for tracking workouts with wave-loaded periodization. Built with **Tauri v2 + React 18 + TypeScript + Vite + Tailwind CSS + SQLite**. Bundle ID: `com.forge.app`.

The original PWA version is preserved as `index.pwa.html` for reference. Default branch is `main`; feature work happens on `feature/*` branches.

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
- **Wireless deploy flakes** (`npm run tauri ios dev` to a physical device): `xcrun devicectl` over Wi-Fi commonly hits `CoreDeviceError 4000` / `NWError 60` (timeout) when the phone is off-network or asleep, and `FBSOpenApplicationServiceErrorDomain 1 / Locked` if the phone is locked at the moment `devicectl device process launch` fires. Cure: phone unlocked + same Wi-Fi as the Mac + Xcode → Devices and Simulators showing the device (lightning bolt for wireless). The build/sign steps still succeed in these cases; only install/launch fails, so you can usually just retry without rebuilding the IPA

### DB Singleton
`getDb()` in `src/lib/db.ts` caches the **Promise** (not the resolved value) to prevent race conditions when multiple callers request the DB simultaneously during init.

### Migrations
SQL migrations live in `src-tauri/migrations/NNN_description.sql` and must be registered in `src-tauri/src/lib.rs` with a `Migration { version, description, sql: include_str!(…), kind: MigrationKind::Up }` entry. tauri-plugin-sql runs each version once on app startup. **HMR does NOT reload migrations** — adding/editing a migration requires a full Tauri rebuild and reinstall before it executes on-device. Migrations can use `CREATE TEMPORARY TABLE` to capture a value before mutating other tables (see `006_renumber_post_import_blocks.sql` for the pattern when one UPDATE's intent depends on pre-update state of another).

### Optimistic-ID writes (set_logs)
`useWorkoutLog` assigns a fresh UUID in optimistic React state the first time a user touches a set, *before* any row exists in `set_logs`. Any debounced/deferred DB write must therefore use `INSERT OR REPLACE INTO set_logs … VALUES (id, …)` rather than `UPDATE … WHERE id = ?`, or the write silently no-ops. This same rule applies to `toggleComplete` when an in-memory log entry exists. Don't reintroduce `UPDATE`-only paths here.

### History query ordering
Workout-log `block_num` is **not chronologically monotonic** because the PWA importer stamped historical sessions with synthetic high block_nums (5–36) that can sit alongside real recent block_nums (1, 2, …). All history queries (`useHistory.ts`, all-lifts overlay) must `ORDER BY wl.started_at` (or `MIN(wl.started_at)` for grouped aggregates), not `wl.block_num` — otherwise imported data renders to the right of newer real data on charts.

### Main-lift exercise lookup
Match `MAIN_LIFTS` shortcuts to exercises by `exercise_key` first, falling back to display name. Users rename main lifts (e.g., "OHP" → "Overhead Press") via the program builder, which preserves `exercise_key` but breaks any name-only match. When multiple exercises match the same key/name (PWA imports can create duplicates if the original was renamed before importing), prefer the candidate with the most recent `set_logs.logged_at`.

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
