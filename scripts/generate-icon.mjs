import sharp from 'sharp'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SOURCE_IMAGE = join(ROOT, 'forge-icon.jpg')

// All required sizes: [filename, pixelSize]
const APPLE_ICONS = [
  ['AppIcon-20x20@1x.png', 20],
  ['AppIcon-20x20@2x.png', 40],
  ['AppIcon-20x20@2x-1.png', 40],
  ['AppIcon-20x20@3x.png', 60],
  ['AppIcon-29x29@1x.png', 29],
  ['AppIcon-29x29@2x.png', 58],
  ['AppIcon-29x29@2x-1.png', 58],
  ['AppIcon-29x29@3x.png', 87],
  ['AppIcon-40x40@1x.png', 40],
  ['AppIcon-40x40@2x.png', 80],
  ['AppIcon-40x40@2x-1.png', 80],
  ['AppIcon-40x40@3x.png', 120],
  ['AppIcon-60x60@2x.png', 120],
  ['AppIcon-60x60@3x.png', 180],
  ['AppIcon-76x76@1x.png', 76],
  ['AppIcon-76x76@2x.png', 152],
  ['AppIcon-83.5x83.5@2x.png', 167],
  ['AppIcon-512@2x.png', 1024],
]

const TAURI_ICONS = [
  ['icon.png', 512],
  ['32x32.png', 32],
  ['128x128.png', 128],
  ['128x128@2x.png', 256],
]

const appleDir = join(ROOT, 'src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset')
const tauriDir = join(ROOT, 'src-tauri/icons')

async function main() {
  const base = sharp(SOURCE_IMAGE).resize(1024, 1024).png()

  const tasks = []

  for (const [filename, size] of APPLE_ICONS) {
    const outPath = join(appleDir, filename)
    tasks.push(
      base.clone().resize(size, size).toFile(outPath).then(() => console.log(`  ✓ ${filename} (${size}x${size})`))
    )
  }

  for (const [filename, size] of TAURI_ICONS) {
    const outPath = join(tauriDir, filename)
    tasks.push(
      base.clone().resize(size, size).toFile(outPath).then(() => console.log(`  ✓ icons/${filename} (${size}x${size})`))
    )
  }

  console.log('Generating app icons...')
  await Promise.all(tasks)
  console.log(`\nDone! Generated ${tasks.length} icons.`)
}

main().catch((err) => { console.error(err); process.exit(1) })
