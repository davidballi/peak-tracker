#!/usr/bin/env node
/**
 * Parse workout notes from Apple Notes into JSON for Forge import.
 * This is a local dev tool, not user-facing code.
 *
 * Usage: node scripts/parse-workout-notes.mjs
 * Output: public/workout-history.json
 */

import { execFileSync } from 'child_process'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '..', 'public')
const OUT_PATH = resolve(OUT_DIR, 'workout-history.json')

// ════════════════════════════════════════════
// Apple Notes extraction
// ════════════════════════════════════════════

function fetchNoteNames() {
  const raw = execFileSync('osascript', [
    '-e', 'tell application "Notes" to get name of every note whose name contains "Workout block"',
  ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).trim()
  return raw.split(', ').map(n => n.trim()).filter(Boolean)
}

function fetchNoteBody(name) {
  const escaped = name.replace(/"/g, '\\"')
  return execFileSync('osascript', [
    '-e', `tell application "Notes" to get plaintext of (first note whose name is "${escaped}")`,
  ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).trim()
}

// ════════════════════════════════════════════
// Exercise name normalization
// ════════════════════════════════════════════

const ALIASES = {
  'bench press': 'Bench Press',
  'bench': 'Bench Press',
  'flat bench': 'Bench Press',
  'flat barbell bench': 'Bench Press',
  'barbell flat press': 'Bench Press',

  'squat': 'Back Squat',
  'squats': 'Back Squat',
  'back squat': 'Back Squat',
  'back squats': 'Back Squat',
  'front squat': 'Front Squat',
  'front squats': 'Front Squat',

  'deadlift': 'Deadlift',
  'deadlifts': 'Deadlift',

  'ohp': 'OHP',
  'overhead press': 'OHP',
  'overhead barbell press': 'OHP',
  'overheard barbell press': 'OHP',
  'overheard barbell pres': 'OHP',
  'military press': 'OHP',

  'incline press': 'Incline Press',
  'incline db press': 'Incline DB Press',
  'db incline press': 'Incline DB Press',
  'db incline': 'Incline DB Press',
  'hammer incline': 'Hammer Incline Press',
  'flat db press': 'DB Flat Press',
  'db flat press': 'DB Flat Press',
  'db chest press': 'DB Flat Press',

  'tricep ext': 'Tricep Extension',
  'tricep extension': 'Tricep Extension',
  'cable tricep extension': 'Tricep Extension',

  'dumbbell flies': 'DB Fly',
  'db chest fly': 'DB Fly',
  'chest fly machine': 'Chest Fly Machine',

  'dips': 'Dips',
  'tricep dips': 'Dips',

  'lat pull downs': 'Lat Pulldown',
  'lat pulldown': 'Lat Pulldown',
  'lat pull down': 'Lat Pulldown',

  'seated rows': 'Seated Row',
  'seated row': 'Seated Row',
  'midrow': 'Seated Row',

  'lateral raises': 'Lateral Raise',
  'lateral raise': 'Lateral Raise',
  'db lateral raise': 'Lateral Raise',
  'db front/lateral raise': 'Lateral Raise',

  'bicep curls': 'Bicep Curl',
  'bicep curl': 'Bicep Curl',
  'db curl': 'Bicep Curl',
  'db incline curl': 'Incline Curl',

  'hammer curls': 'Hammer Curl',
  'hammer curl': 'Hammer Curl',
  'bar hammer curls': 'Hammer Curl',

  'weighted sit-ups': 'Weighted Situp',
  'weighted situps': 'Weighted Situp',

  'barbell bentover row': 'Barbell Row',
  'barbell row': 'Barbell Row',

  'deadhang pulls ups': 'Pull-up',
  'deadhang pull ups': 'Pull-up',
  'deadhang pulls up': 'Pull-up',
  'pull ups': 'Pull-up',
  'pullups': 'Pull-up',
  'neutral grip pull ups': 'Pull-up',
  'chin ups': 'Chin-up',

  'leg ext': 'Leg Extension',
  'leg extension': 'Leg Extension',
  'leg curl': 'Leg Curl',
  'leg curls': 'Leg Curl',
  'prone leg curl': 'Leg Curl',

  'calf raises': 'Calf Raise',
  'standing calf raises': 'Standing Calf Raise',
  'seated calf raises': 'Seated Calf Raise',

  'pistol squats': 'Pistol Squat',
  'pistol squat': 'Pistol Squat',

  'db bulgarian split squats': 'Bulgarian Split Squat',
  'bulgarian split squats': 'Bulgarian Split Squat',

  'farmers carry': 'Farmer Carry',
  'farmer walk': 'Farmer Walk',
  'farmer carry': 'Farmer Carry',

  'db shrugs': 'DB Shrug',
  'db shrug': 'DB Shrug',

  'db rdl': 'DB RDL',
  'rdl': 'RDL',

  'hanging power cleans': 'Hang Power Clean',
  'db goblet squat': 'Goblet Squat',
  'goblet squat': 'Goblet Squat',
  'gobble squats': 'Goblet Squat',

  'face pulls': 'Face Pull',
  'arnold presses': 'Arnold Press',

  'red leg press': 'Leg Press',
  'leg press': 'Leg Press',

  'deadli': 'Deadlift',
  'bbb bench': 'Bench Press',
  'ohp bbb': 'OHP',
  'squat bbb': 'Back Squat',
  'barbell incline': 'Incline Press',
  'flat barbell incline': 'Incline Press',
  'incline press barbell': 'Incline Press',
  'chest fly': 'Chest Fly',
  'weight sit ups': 'Weighted Situp',
  'bent over row': 'Barbell Row',
  'bent over rows': 'Barbell Row',
  'bent over bar rows': 'Barbell Row',
  'bent over barbell rows': 'Barbell Row',
  'tbar rows': 'T-Bar Row',
  'concentration curls': 'Concentration Curl',
  'skull crushers': 'Skull Crusher',
  'standing military press': 'OHP',
  'seated military press': 'OHP',
  'standing military press db': 'OHP',
  'shrugs': 'DB Shrug',
  'db curls': 'Bicep Curl',
  'db lunges': 'DB Lunge',
  'db rows': 'DB Row',
  'db alternating rows': 'DB Row',
  'db row': 'DB Row',
  'db bar curls': 'Bicep Curl',
  'db bench press': 'DB Flat Press',
  'flat bench db': 'DB Flat Press',
  'db lateral raises': 'Lateral Raise',
  'facepulls': 'Face Pull',
  'deadhangs': 'Deadhang',
  'hangs': 'Deadhang',
  'upright row': 'Upright Row',
  'rows': 'Seated Row',
  'curls': 'Bicep Curl',
  'lats': 'Lat Pulldown',
  'decline press': 'Decline Press',
  'close grip tricep bench': 'Close Grip Bench',
  'cable row': 'Cable Row',
  'weighted dips': 'Dips',
  'front raises': 'Front Raise',
  'front shoulder raises': 'Front Raise',
  'side/front shoulder raises': 'Front Raise',
  'shoulder/ front raise': 'Front Raise',
  'shoulder raise': 'Lateral Raise',
  'later raises': 'Lateral Raise',
  'seated carlf raises': 'Seated Calf Raise',
  'standing  calf raises': 'Standing Calf Raise',
  'standing calf raised': 'Standing Calf Raise',
  'seated hammer curls': 'Hammer Curl',
  'incline bench curls': 'Incline Curl',
  'incline bicep curls': 'Incline Curl',
  'incline bice0 curl': 'Incline Curl',
  'preacher curls': 'Preacher Curl',
  'preacher zbar curls': 'Preacher Curl',
  'preacher burls': 'Preacher Curl',
  'bar preacher curls': 'Preacher Curl',
  'hammer machine pulls': 'Hammer Pulldown',
  'hammer pull downs': 'Hammer Pulldown',
  'hammer rows': 'Hammer Row',
  'high row machine': 'High Row',
  'mid row': 'Seated Row',
  'kb lunges knees over toes': 'KOT Lunge',
  'kb overhead lunges': 'KB Overhead Lunge',
  'zerker deadlift': 'Zercher Deadlift',
  'deadhang clean to press': 'Clean and Press',
  'barbell pendaley row': 'Pendlay Row',
  'band rotation': 'Band Rotation',
  'shoulder rotations': 'Shoulder Rotation',
  'forearm grip': 'Forearm Grip',
  'chest squeezes': 'Chest Squeeze',
  'overhead tricep  ext': 'Overhead Tricep Extension',
  'overhead tricep ext': 'Overhead Tricep Extension',
  'tricep  ext': 'Tricep Extension',
  'tricep extensions': 'Tricep Extension',
  'back ext': 'Back Extension',
  'back hyper extensions': 'Back Extension',
  'row machine': 'Row Machine',
  'leg extensions': 'Leg Extension',

  // Additional normalizations found in parsed data
  'dead': 'Deadlift',
  'lats pull ups': 'Pull-up',
  'neutral grip dead hang pull ups': 'Pull-up',
  'neutral grip pull ups': 'Pull-up',
  'farmer carries': 'Farmer Carry',
  'db farmer carry': 'Farmer Carry',
  'shoulder front raises': 'Front Raise',
  'shoulder raise front/side': 'Lateral Raise',
  'seated pull-down curls': 'Cable Curl',
  'sub - targeted pull ups': 'Pull-up',
  'twist planks': 'Plank',
  'bent over rows and pull ups super set': 'Barbell Row',
}

function cleanExerciseName(line) {
  return line
    .replace(/\(.*?\)/g, '')                                    // strip (parenthetical notes)
    .replace(/\s+(?:bw|\d+)[-–]?\d*\s*[xX×].*$/i, '')         // strip prescriptions: "3x10", "3-4x8-12", "2xmax"
    .replace(/\d+[xX×]\d+(?:[-–]\d+)?(?:,\d+)*/g, '')         // strip NxN stuck to text: "3x10", "3x10,10,10"
    .replace(/\s*\bs\d+\s*[xX×]\s*\d+/gi, '')                 // strip "S3 X 10", "s3x10"
    .replace(/\s+\d+[-–]\d+[-–]\d+\s+\w+$/i, '')              // strip "5-3-1 Method"
    .replace(/\s+db\d+[xX×].*$/i, '')                          // strip "Db3x5-8"
    .replace(/\s+bw\s+amrap.*$/i, '')                           // strip "Bw Amrapx2"
    .replace(/\s+\d+\s+amrap.*$/i, '')                          // strip "1 Amrap"
    .replace(/\s+amrap.*$/i, '')                                // strip trailing "Amrap"
    .replace(/\s+\d+[xX×]$/i, '')                              // strip trailing "1x"
    .replace(/\s+bw$/i, '')                                     // strip trailing "bw"
    .replace(/\s+@\s*\d+$/i, '')                                // strip "@ 120"
    .replace(/\s+\d{2,}$/g, '')                                 // strip trailing 2+ digit weights: "255", "365"
    .replace(/\s+\d+[-–]\d+$/g, '')                             // strip trailing ranges: "10-20"
    .replace(/\s+\d+[-–]$/g, '')                                // strip trailing "3-"
    .replace(/[-–]+$/g, '')                                     // strip trailing dashes
    .trim()
}

function normalizeExerciseName(rawLine) {
  const cleaned = cleanExerciseName(rawLine).toLowerCase()
  if (ALIASES[cleaned]) return ALIASES[cleaned]
  return cleaned.replace(/\b\w/g, c => c.toUpperCase())
}

// ════════════════════════════════════════════
// Line classification
// ════════════════════════════════════════════

function isDataLine(line) {
  const t = line.trim()
  if (!t) return false

  // Standalone number (weight-only, no reps) → not useful as data or exercise name
  if (/^\d+(\.\d+)?$/.test(t)) return true // treat as data to avoid becoming exercise name

  // Lines with words after number patterns are exercise names
  if (/^\d+\s*[xX×]\s*\d+\s+[a-zA-Z]{2,}/.test(t)) return false
  if (/^\d+\s+[a-zA-Z]{3,}/.test(t)) return false

  if (/^\d/.test(t) || /^bw/i.test(t)) {
    if (/[xX×]/.test(t) || /\d\s*[-–]\s*\d/.test(t) || /,/.test(t)) {
      return true
    }
  }
  return false
}

// ════════════════════════════════════════════
// Data line parsing
// ════════════════════════════════════════════

function parseSegments(segment, lastWeight) {
  const sets = []
  const parts = segment.split(',')

  for (const part of parts) {
    const p = part.trim()
    if (!p || /^(pass|fc|t|s|r|n|nt|l|b)$/i.test(p)) continue

    // Skip BW entries
    if (/^bw/i.test(p)) continue

    // Multi-separator: "2x70x6" → weight=70, reps=6
    const multiMatch = p.match(/^(\d+)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+)/)
    if (multiMatch) {
      const weight = parseFloat(multiMatch[2])
      const reps = Math.round(parseFloat(multiMatch[3]))
      if (weight > 0 && reps > 0) {
        sets.push({ weight, reps })
        lastWeight = weight
      }
      continue
    }

    // Weight x reps
    const wxr = p.match(/^(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/)
    if (wxr) {
      let weight = parseFloat(wxr[1])
      let reps = Math.round(parseFloat(wxr[2]))
      if (weight < 10 && reps > 40) [weight, reps] = [reps, weight]
      if (weight > 0 && reps > 0) {
        sets.push({ weight, reps })
        lastWeight = weight
      }
      continue
    }

    // Weight - reps (dash separator)
    const wdr = p.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/)
    if (wdr) {
      let weight = parseFloat(wdr[1])
      let reps = Math.round(parseFloat(wdr[2]))
      if (weight < 10 && reps > 40) [weight, reps] = [reps, weight]
      if (weight > 0 && reps > 0) {
        sets.push({ weight, reps })
        lastWeight = weight
      }
      continue
    }

    // Just a number - treat as reps at last weight
    const justNum = p.match(/^(\d+(?:\.\d+)?)$/)
    if (justNum && lastWeight != null) {
      const num = parseFloat(justNum[1])
      if (num > 0 && num <= 100) {
        sets.push({ weight: lastWeight, reps: Math.round(num) })
      }
      continue
    }
  }

  return { sets, lastWeight }
}

function parseDataLine(line, inheritedWeight) {
  const sets = []
  const cleaned = line.trim()
    .replace(/\(.*?\)/g, '')
    .replace(/\s*[;!$]+\s*/g, '')
    .trim()

  if (!cleaned || /^(pass|fc)$/i.test(cleaned)) return { sets, lastWeight: inheritedWeight }

  // AMRAP: "235 x 5+ - 6"
  const amrapMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*[xX×]\s*\d+\+\s*[-–]\s*(\d+(?:\.\d+)?)/)
  if (amrapMatch) {
    let weight = parseFloat(amrapMatch[1])
    let reps = Math.round(parseFloat(amrapMatch[2]))
    if (weight < 10 && reps > 40) [weight, reps] = [reps, weight]
    if (weight > 0 && reps > 0) {
      sets.push({ weight, reps })
      inheritedWeight = weight
    }
    const rest = cleaned.slice(amrapMatch[0].length).trim()
    if (rest && rest.startsWith(',')) {
      const more = parseSegments(rest.slice(1), inheritedWeight)
      sets.push(...more.sets)
      inheritedWeight = more.lastWeight
    }
    return { sets, lastWeight: inheritedWeight }
  }

  // Split by double+ spaces into separate groups
  const segments = cleaned.split(/\s{2,}/)
  for (const seg of segments) {
    const result = parseSegments(seg.trim(), inheritedWeight)
    sets.push(...result.sets)
    inheritedWeight = result.lastWeight
  }

  return { sets, lastWeight: inheritedWeight }
}

// ════════════════════════════════════════════
// Note parsing
// ════════════════════════════════════════════

function parseNote(title, body) {
  const blockMatch = title.match(/(\d+)/)
  if (!blockMatch) return []
  const blockNum = parseInt(blockMatch[1])

  const lines = body.split('\n')

  let currentWeek = 0
  let lastDayInWeek = -1
  let currentExercise = null
  let lastWeight = null

  const workouts = []
  let currentWorkout = null

  function finishWorkout() {
    if (currentWorkout && currentWorkout.exercises.some(e => e.sets.length > 0)) {
      workouts.push(currentWorkout)
    }
    currentWorkout = null
    currentExercise = null
    lastWeight = null
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    // Skip percentage lines and TM calculations
    if (line.includes('%')) continue
    if (line.includes('=') && /\d/.test(line)) continue

    // Skip title echo
    if (/workout block/i.test(line)) continue

    // Week header
    const weekMatch = line.match(/^Week\s*(\d+)/i)
    if (weekMatch) {
      finishWorkout()
      currentWeek = parseInt(weekMatch[1]) - 1
      lastDayInWeek = -1
      continue
    }

    // Day header
    const dayMatch = line.match(/^Day\s*(\d+)/i)
    if (dayMatch) {
      const dayNum = parseInt(dayMatch[1]) - 1

      // Detect implicit week rollover
      if (dayNum === 0 && lastDayInWeek > 0) {
        currentWeek++
      }

      finishWorkout()
      lastDayInWeek = dayNum
      currentWorkout = { block: blockNum, week: currentWeek, day: dayNum, exercises: [] }
      continue
    }

    // Data line
    if (isDataLine(line)) {
      if (currentExercise) {
        const result = parseDataLine(line, lastWeight)
        currentExercise.sets.push(...result.sets)
        lastWeight = result.lastWeight
      }
      continue
    }

    // Skip non-exercise lines
    if (/^\d+\s*min\s/i.test(line)) continue
    if (/^mobility/i.test(line)) continue
    if (/^warm\s*up/i.test(line)) continue
    if (/^rest/i.test(line)) continue
    if (/^off$/i.test(line)) continue
    if (/^superset/i.test(line)) continue
    if (/^\d+\s*plyo/i.test(line)) continue
    if (/^\d+\s*mile/i.test(line)) continue
    if (/^\d+\s*step/i.test(line)) continue
    if (/^\d+\s*x\s*\d+\s*(minute|min|sec)/i.test(line)) continue
    if (/^(i5|i )/i.test(line)) continue
    if (/^\d+\/\d+\/\d+/.test(line)) continue          // dates: "2/17/21"
    if (/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(line)) continue
    if (/^(pass|skipped|elbow hurt|did not do|bike|core work|block \d)/i.test(line)) continue
    if (/^(planks|hanging leg|hip bridges|wrist exercises|toe dorsi|straight leg|the$)/i.test(line)) continue
    if (/^(kot |slow pull|finger hold|medicine ball|machine chest)/i.test(line)) continue
    if (/^\d+\s*(lbs?|sec|twice)$/i.test(line)) continue // "50 lbs", "55r"
    if (/^\d+r$/i.test(line)) continue                   // "55r"
    if (/^(and |my |too long|2x\d+ kb|2x\d+ back|day\s*\d*\/|day\s*full)/i.test(line)) continue
    if (/sec plank/i.test(line)) continue
    if (/press machine/i.test(line)) continue
    if (/^bw\s*[-–]\s*\d/i.test(line)) continue              // "Bw - 10" (bodyweight reps)
    if (/^bm[xX]\d/i.test(line)) continue                     // "Bmx10,10,10"
    if (/^d?\s*ay\s+\d/i.test(line)) continue                 // "Ay 4...", "D Ay 4..." (mangled day headers)

    // Exercise name
    if (!currentWorkout) {
      currentWorkout = { block: blockNum, week: currentWeek, day: 0, exercises: [] }
    }

    const name = normalizeExerciseName(line)
    // Skip garbage: too short, just numbers, or clearly not an exercise
    if (/^\d+/.test(name)) continue
    if (name.length < 3) continue
    if (name && name.length > 2) {
      currentExercise = { name, sets: [] }
      currentWorkout.exercises.push(currentExercise)
      lastWeight = null
    }
  }

  finishWorkout()
  return workouts
}

// ════════════════════════════════════════════
// Main
// ════════════════════════════════════════════

console.log('Fetching notes from Apple Notes...')
const names = fetchNoteNames()
console.log(`Found ${names.length} workout notes`)

names.sort((a, b) => {
  const an = parseInt(a.match(/(\d+)/)?.[1] || '0')
  const bn = parseInt(b.match(/(\d+)/)?.[1] || '0')
  return an - bn
})

const allWorkouts = []
for (const name of names) {
  process.stdout.write(`  Parsing: ${name}...`)
  const body = fetchNoteBody(name)
  const workouts = parseNote(name, body)
  allWorkouts.push(...workouts)
  console.log(` ${workouts.length} sessions`)
}

allWorkouts.sort((a, b) => a.block - b.block || a.week - b.week || a.day - b.day)

const totalSets = allWorkouts.reduce((sum, w) =>
  sum + w.exercises.reduce((s, e) => s + e.sets.length, 0), 0)
const exerciseNames = new Set(allWorkouts.flatMap(w => w.exercises.map(e => e.name)))
const blockRange = allWorkouts.length > 0
  ? `${allWorkouts[0].block}-${allWorkouts[allWorkouts.length - 1].block}`
  : 'none'

console.log(`\n=== Summary ===`)
console.log(`Blocks: ${blockRange}`)
console.log(`Workout sessions: ${allWorkouts.length}`)
console.log(`Total sets: ${totalSets}`)
console.log(`Unique exercises (${exerciseNames.size}):`)
for (const name of Array.from(exerciseNames).sort()) {
  const count = allWorkouts.reduce((sum, w) =>
    sum + w.exercises.filter(e => e.name === name).reduce((s, e) => s + e.sets.length, 0), 0)
  console.log(`  ${name}: ${count} sets`)
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT_PATH, JSON.stringify(allWorkouts, null, 2))
console.log(`\nWrote ${OUT_PATH}`)
