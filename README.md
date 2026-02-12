# Peak Tracker PWA

A mobile-first workout tracker with wave-loaded periodization, built as a Progressive Web App.

## Features
- 4-day training split with wave-loaded periodization (Garage Strength / Peak Strength style)
- Log weights and reps for every set
- Auto-calculated training maxes between blocks (Epley e1RM formula)
- Per-exercise and per-workout notes with history
- Lift history charts (e1RM trends, volume, all-lifts overlay)
- Delete/clear individual sets
- Works offline after first load
- Installable as a home screen app on iOS and Android

## Quick Deploy to GitHub Pages (10 min)

### 1. Create a GitHub repo
- Go to https://github.com/new
- Name it something like `peak-tracker`
- Make it **Public** (required for free GitHub Pages)
- Click "Create repository"

### 2. Upload the files
Upload all 5 files from this folder to the repo root:
```
index.html
sw.js
manifest.json
icon-192.svg
icon-512.svg
```

You can drag-and-drop them via the GitHub web UI:
- Click "uploading an existing file" on the new repo page
- Drag all 5 files in
- Click "Commit changes"

### 3. Enable GitHub Pages
- Go to repo **Settings** → **Pages** (left sidebar)
- Under "Source", select **Deploy from a branch**
- Branch: `main`, Folder: `/ (root)`
- Click **Save**
- Wait 1-2 minutes for deployment

### 4. Access your app
Your app will be live at:
```
https://YOUR-USERNAME.github.io/peak-tracker/
```

### 5. Install on your phone
1. Open the URL in **Safari** (iOS) or **Chrome** (Android)
2. **iOS**: Tap Share → "Add to Home Screen"
3. **Android**: Tap the browser menu → "Install app" or "Add to Home Screen"

The app will now appear as a standalone app with the Peak Tracker icon.

## Data Storage
All data is stored in your browser's localStorage. This means:
- Data persists between sessions
- Data is specific to each device/browser
- Clearing browser data will erase your workout logs
- **Tip**: Periodically screenshot your history charts as a backup

## File Structure
```
index.html      - Complete app (React + Recharts via CDN, Babel for JSX)
sw.js           - Service worker for offline caching
manifest.json   - PWA manifest (app name, icon, theme)
icon-192.svg    - App icon (192px)
icon-512.svg    - App icon (512px)
```

## Customization
Everything is in `index.html`. To modify:
- **Training maxes**: Edit `baseMax` values in the `PROGRAM` object
- **Exercises**: Add/remove/edit exercises in the `PROGRAM.days` arrays
- **Wave percentages**: Adjust `pct` values in each wave's `weeks` array
- **Colors**: Edit the `CC` (category colors) object
