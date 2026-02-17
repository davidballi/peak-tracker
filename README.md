# Forge

An iOS workout tracker with wave-loaded periodization (Garage Strength / Peak Strength style), built with Tauri v2.

## Features

- Wave-loaded periodization: 3 working weeks + 1 deload per block
- Auto-calculated training maxes between blocks (Epley e1RM formula)
- Log weights and reps for every set with per-exercise and per-workout notes
- Lift history charts (e1RM trends, volume, all-lifts overlay)
- Program builder with customizable days, exercises, and wave configs
- Strength goals with progress tracking and achievement detection
- Two built-in templates: Peak Strength and Wendler's 5/3/1
- PWA data import from localStorage JSON

## Tech Stack

- **Runtime:** Tauri v2 (Rust + native iOS WebView)
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **State:** Zustand (UI state) + SQLite (persistent data via `@tauri-apps/plugin-sql`)
- **Charts:** Recharts

## Prerequisites

- Node.js 18+
- Rust (via rustup)
- Xcode 15+ with iOS 14+ SDK
- Apple Developer account (for device builds)

## Development

```bash
# Install dependencies
npm install

# Run on iOS Simulator
npm run tauri ios dev

# Build for iOS
npm run tauri ios build

# Frontend only (no Tauri, for quick iteration)
npm run dev
```

## Project Structure

```
src/
  components/       # React components (layout, workout, history, programs, goals, dashboard, ui)
  hooks/            # Custom React hooks (useWorkout, useHistory, useGoals, etc.)
  lib/              # Pure logic (calc, wave sets, constants, templates, db, seed)
  types/            # TypeScript interfaces
  store/            # Zustand stores
src-tauri/
  src/lib.rs        # Tauri app setup with SQL plugin + migrations
  migrations/       # SQLite migration files
  gen/apple/        # Xcode project config
```
