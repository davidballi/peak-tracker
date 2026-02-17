# Forge — App Store Distribution Guide

## Prerequisites

- Apple Developer Program membership ($99/year)
- Xcode 15+ with iOS 14.0+ SDK
- Rust toolchain via rustup
- Node.js 20+

---

## 1. Signing Setup (Apple Developer Portal)

### Create Distribution Certificate

1. Go to [Certificates, IDs & Profiles](https://developer.apple.com/account/resources/certificates/list)
2. Click **+** → select **Apple Distribution**
3. Upload a Certificate Signing Request (CSR) from Keychain Access:
   - Open Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority
   - Save to disk, upload to Apple
4. Download and double-click the `.cer` file to install in Keychain

### Create App Store Provisioning Profile

1. Go to **Profiles** → click **+**
2. Select **App Store Connect** under Distribution
3. Select App ID: `com.forge.app`
   - If it doesn't exist, go to **Identifiers** → **+** → **App IDs** → create with bundle ID `com.forge.app`
4. Select the Distribution certificate you just created
5. Name it `Forge App Store` → Generate → Download
6. Double-click to install, or drag into Xcode

### Verify in Xcode

- Open `src-tauri/gen/apple/forge.xcodeproj`
- Select the `forge_iOS` target → Signing & Capabilities
- Team: your team (G3DQP8CZ75)
- If using Automatic signing, Xcode will manage the profile
- If Manual: select the App Store provisioning profile

---

## 2. App Store Connect Listing

### Create the App

1. Go to [App Store Connect](https://appstoreconnect.apple.com/) → My Apps → **+** → New App
2. Fill in:
   - **Platform:** iOS
   - **Name:** Forge
   - **Primary Language:** English (U.S.)
   - **Bundle ID:** com.forge.app
   - **SKU:** forge-ios-1 (any unique string)
   - **User Access:** Full Access

### App Information

- **Category:** Health & Fitness
- **Content Rights:** Does not contain third-party content
- **Age Rating:** Complete the questionnaire (no objectionable content — should be 4+)

### Pricing & Availability

- **Price:** Free
- **Availability:** All territories (or select specific ones)

### App Privacy (Privacy Questionnaire)

Apple requires a privacy questionnaire in App Store Connect:

- **Data Collection:** Select "No" — Forge stores all data locally on-device via SQLite
- **Tracking:** No tracking (no analytics, no third-party SDKs)
- **Privacy Policy URL:** Required — host a simple privacy policy stating:
  - No data leaves the device
  - No analytics or tracking
  - No accounts or cloud sync
  - Data stored locally in SQLite

### Prepare Screenshots

Required sizes (at minimum):
- **6.7" iPhone** (1290 x 2796): iPhone 15 Pro Max or 16 Pro Max
- **6.5" iPhone** (1284 x 2778): iPhone 14 Plus / 15 Plus
- **5.5" iPhone** (1242 x 2208): iPhone 8 Plus (if supporting older devices)

Take screenshots of: Dashboard, Workout logging, History charts, Program builder, Goals

### App Description

```
Forge is a focused strength training tracker built for wave-loaded periodization programs.

Features:
• Wave Periodization & Wendler's 5/3/1 built-in templates
• Automatic set calculations from your training maxes
• e1RM tracking with progress charts
• Strength goals with achievement tracking
• Full workout history with volume analysis
• Custom program builder
• Works completely offline — all data stays on your device

Built for lifters who want a no-nonsense training log without accounts, subscriptions, or cloud sync.
```

### Keywords

`strength training, workout tracker, periodization, powerlifting, 531, wave loading, barbell, gym log, training max, e1rm`

---

## 3. Build & Submit

### Build the Archive

```bash
# Ensure dependencies are installed
npm install

# Build the iOS archive
npm run tauri ios build
```

This runs the Vite frontend build, then compiles the Rust backend and creates an Xcode archive.

### Archive in Xcode

If `tauri ios build` doesn't produce an archive directly:

1. Open `src-tauri/gen/apple/forge.xcodeproj` in Xcode
2. Select **Product** → **Archive**
3. Wait for the archive to complete

### Validate & Upload

1. In Xcode → **Window** → **Organizer**
2. Select the latest archive
3. Click **Distribute App**
4. Select **App Store Connect** → **Upload**
5. Check all validation options:
   - Upload your app's symbols
   - Manage version and build number
6. Click **Validate** — fix any issues
7. Click **Upload**

### Submit for Review

1. Go to App Store Connect → Your App → iOS App section
2. Select the uploaded build under **Build**
3. Fill in "What's New" (for v1.0.0: initial release)
4. Click **Submit for Review**

---

## 4. Post-Submission Checklist

- [ ] Distribution certificate created and installed
- [ ] App Store provisioning profile created
- [ ] App created in App Store Connect
- [ ] Description, keywords, category filled in
- [ ] Screenshots uploaded for required device sizes
- [ ] Privacy policy URL set
- [ ] Privacy questionnaire completed
- [ ] Age rating completed
- [ ] Archive built and validated in Xcode
- [ ] Build uploaded to App Store Connect
- [ ] Build selected in app version
- [ ] Submitted for review

---

## Troubleshooting

### "No accounts with App Store Connect access"
Ensure your Apple ID is added in Xcode → Settings → Accounts and has the App Manager or Admin role.

### "Provisioning profile doesn't match bundle ID"
Verify the profile is for `com.forge.app` and uses an Apple Distribution certificate (not Development).

### "Missing privacy manifest"
The `PrivacyInfo.xcprivacy` file must be included in the Xcode target's sources. It's registered in `project.yml`.

### Build number conflicts
Each upload must have a unique `CFBundleVersion`. Increment it (1, 2, 3...) for each new upload. `CFBundleShortVersionString` stays at `1.0.0` until you release a new version.
