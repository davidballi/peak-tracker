import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// Anvil SVG — bold geometric silhouette, gold on dark background
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="180" fill="#0d1117"/>
  <!-- Anvil body -->
  <g transform="translate(512, 520)" fill="#f5a623">
    <!-- Top face / horn -->
    <rect x="-260" y="-180" width="520" height="60" rx="10"/>
    <!-- Horn (left taper) -->
    <polygon points="-260,-180 -360,-160 -360,-140 -260,-120"/>
    <!-- Step (right) -->
    <rect x="260" y="-180" width="40" height="100" rx="5"/>
    <!-- Body (waist) -->
    <path d="M-200,-120 L-160,60 L160,60 L200,-120 Z"/>
    <!-- Base -->
    <rect x="-240" y="60" width="480" height="55" rx="12"/>
    <!-- Foot -->
    <rect x="-280" y="115" width="560" height="45" rx="10"/>
  </g>
  <!-- Hammer (angled above anvil) -->
  <g transform="translate(512, 520) rotate(-35, 80, -260)" fill="#f5a623">
    <!-- Handle -->
    <rect x="70" y="-360" width="20" height="180" rx="5"/>
    <!-- Head -->
    <rect x="30" y="-390" width="100" height="45" rx="8"/>
  </g>
</svg>`

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
  const svgBuffer = Buffer.from(SVG)

  // Generate 1024x1024 base
  const base = sharp(svgBuffer, { density: 300 }).resize(1024, 1024).png()

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
