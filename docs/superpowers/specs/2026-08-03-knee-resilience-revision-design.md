# Knee-Resilience Revision — Design

**Date:** 2026-08-03
**Status:** Approved
**Scope:** Wave Periodization template (`peak-strength-v1`) and its forks only — 5/3/1 and builder programs untouched

## Motivation

User reported a cluster of left-leg problems, self-assessed (no imaging, no clinical evaluation):

- IT band syndrome attributed to TFL overactivity plus deep-glute tightness/weakness
- Medial hamstring soreness (semitendinosus / semimembranosus) — reported right side
- Quadriceps tendon soreness at the superior pole
- A Baker's cyst behind the left knee
- Standing concern about long-term arthritis

Irritability screen: aches after lower-body sessions but **no visible swelling** and no lasting morning stiffness — moderate irritability. Additionally, the user has **not squatted or deadlifted in ~4 weeks**.

### Analysis

Auditing the current plan against this presentation surfaced two structural problems.

**1. Anterior-knee and impact load is heavily over-represented.**

| Day | Aggravating load |
|-----|------------------|
| 1 | Squat wave to 90% · Box Jump 3×5 *supersetted between squat sets* · Pistol Squat 2×8 · Leg Extension 3×12 @155 |
| 3 | Hang Power Clean 4×3 · Front Squat 3×6 @195 |
| 4 | Trap Bar Jump 3×3 · Deadlift wave to 90% |

Three separate plyometric/impact exercises, deep knee flexion under load twice weekly, and open-chain knee extension at 155 lb — into an active quad tendinopathy.

The box jump pairing is the sharpest case. Migration 009 deliberately moved it into a superset with squat for post-activation potentiation. That is correct programming for a healthy athlete and counterproductive here: repeated landings performed pre-fatigued, with known hip-abductor weakness, is the canonical setup for landing into dynamic valgus.

**2. The stated deficit has no exercise assigned to it.**

The program contains *zero* dedicated frontal-plane hip work — no abduction, no side plank, no Copenhagen, no unilateral carry. Hip abductor weakness driving contralateral pelvic drop is the well-supported mechanism behind ITB syndrome (Fredericson et al.), and it is precisely what the user self-identified. It was untrained.

### Rationale for keeping the compounds

Back squat and deadlift are **retained**. Quadriceps strength is the strongest modifiable protective factor against symptomatic knee OA progression — the user's stated long-term worry — and cartilage is load-responsive, so unloading is atrophic rather than protective. Back squat at moderate load is materially gentler on the quad tendon than the accessories being cut; deadlift is a hip hinge and barely loads the knee at all. Removing the compounds while retaining the accessory volume would be backwards.

## Decisions

### 1. Day 1 — Lower Body

| Action | Exercise | Detail |
|---|---|---|
| Archive | `box_jump` | Removes fatigued landings; partly reverses 009/010 |
| Insert (vacated slot, `ss`) | `side_plank_abd` — Side Plank w/ Hip Abduction | 3 × 30s/side, superset w/ squat |
| Archive | `pistol_squat` | Maximal knee flexion demanding the frontal-plane control the user lacks |
| Insert (vacated slot, `acc`) | `bulgarian_split_squat` | 3×8/leg @40 — same unilateral demand, far less patellofemoral load |
| Insert (`acc`) | `spanish_squat_iso` — Spanish Squat (Isometric) | 5 × 45s @ ~70% effort — quad-tendon analgesia protocol |
| Update | `leg_ext` | 155 → 100 lb; note adds 3s eccentric + partial range |
| Update | `squat` note | Parallel-depth cue (see §4) |
| Wave | `squat` Wk3 top set | 90% → 87.5% (see §3) |
| Keep | `db_snatch`, `rdl`, `leg_curl`, `calf_raise`, `dorsi` | unchanged |

RDL is deliberately retained at 3×8 @225 despite the medial hamstring symptoms — progressive hamstring loading is therapeutic for hamstring complaints, not contraindicated.

### 2. Day 3 — Athletic / Dynamic

| Action | Exercise | Detail |
|---|---|---|
| Archive | `hang_clean` | The catch is a rapid loaded deep-knee-flexion landing |
| Insert (vacated slot, `tech`) | `kettlebell_swing` | 4×8 @70 — hip-hinge power, no catch. The original template note already listed this substitution |
| Archive | `front_squat` | The most quad-tendon-dominant lift in the program, stacked on Day 1 squatting |
| Insert (`acc`) | `copenhagen` — Copenhagen Plank | 3 × 30s/side — adductors, the untrained half of the hip |
| Insert (`acc`) | `side_lying_abd` — Side-Lying Hip Abduction | 3×15/side — direct glute medius |
| Update | `lat_raise` | `ss` → `acc`; its superset partner (front squat) is gone |
| Update | `farmer_carry` | → Suitcase Carry — unilateral load is direct frontal-plane hip work. Key preserved, history intact |

### 3. Squat wave: Wk3 top set 90% → 87.5%

Scoped to `exercise_key = 'squat'` only — bench, OHP, and deadlift wave configs are untouched. Guarded on `percentage = 0.90` so a hand-edited top set is respected.

87.5% rather than 85% preserves the crescendo established by migration 009 (Wk2 tops at 82.5%); capping to 85% would flatten Wk3 to equal Wk2 and undo that work.

| Week | Squat working sets |
|------|--------------------|
| Wk1 (5s) | 70%×5, 75%×5, 80%×3 · backoff 70%×8 |
| Wk2 (4s) | 75%×4, 80%×4, 82.5%×4 · backoff 75%×6 |
| Wk3 (3s) | 80%×3, 85%×2, **87.5%×2** (was 90%) · backoff 80%×5 |
| Wk4 (deload) | 40%×5, 50%×5, 60%×5, 75%×1 |

### 4. Squat depth cue

Quad tendon load and patellofemoral contact stress rise sharply past roughly 90–100° of knee flexion. Parallel depth surrenders little stimulus for a meaningful reduction in peak tendon load. Encoded in the squat's note:

> Parallel depth this cycle — stop at ~90° knee flexion. Control the descent.

### 5. Day 4

| Action | Exercise | Detail |
|---|---|---|
| Update | `trap_jump` | → "Trap Bar Pull (from blocks)" — retains explosive intent, removes the landing. Key preserved, history intact |
| Keep | Everything else | Deadlift wave unchanged, including its 90% Wk3 top set |

Deadlift stays **conventional**. Trap bar would be kinder to the sore medial hamstring but shifts load toward the knee, which is the larger problem.

### 6. Day 2

Untouched entirely.

## Training max reset — **out of scope for this migration**

Four weeks off warrants a TM reset. Muscle retains maximal strength reasonably well over that span; tendon does not, and there is an active quad tendinopathy.

| Lift | Old TM | New TM | Basis |
|------|--------|--------|-------|
| Back Squat | 325 | **275** | 85% — detrained + injury-implicated |
| Deadlift | 405 | **345** | 85% — detrained + injury-implicated |
| Bench Press | 270 | 245 | 90% — *only if* also detrained |
| OHP | 190 | 170 | 90% — *only if* also detrained |

At TM 275, squat Wk1 is 195×5 / 205×5 / 220×3 with a 195×8 backoff; Wk3 peaks at 240×2. The 220 top set is ~68% of the previous TM — light enough for a knee unloaded for a month, heavy enough to drive adaptation. No separate re-entry phase is required: Week 1 at a reset TM *is* the ramp-in.

**These values are entered through the app, not this migration.** `training_maxes` is append-only, so new entries preserve the old values as history. Migrations carry program *structure*; personal training maxes belong in the normal data-entry flow. This also keeps 011 idempotent and safe across forks.

## Implementation notes

- **Archive, never delete.** Migration 008 added `exercises.archived_at`. Archived rows retain their `set_logs`, `training_maxes`, notes, and goals, and stay visible in History — so the user's front squat and clean numbers survive, and any archived movement can be restored if the knee recovers.
- **Reuse existing library keys.** `kettlebell_swing` and `bulgarian_split_squat` already exist in `src/lib/exercise-library.ts`. Only four new keys are introduced: `side_plank_abd`, `spanish_squat_iso`, `copenhagen`, `side_lying_abd`. These need library entries so they resolve in the program builder.
- **Hold-style exercises** follow the existing `plank` / `farmer_carry` convention: `reps = 1` with duration in the note.
- **Dual scoping.** Template tables scoped by `template_id = 'peak-strength-v1'`; user tables by `programs.source_template_id = 'peak-strength-v1'`. Exercises matched by `exercise_key` (survives renames); archived rows excluded.
- **Index shifts before inserts**, following the migration 010 pattern.
- **Idempotent.** Every statement no-ops cleanly on re-run and on fresh installs (migrations run before seeding).
- **Mirror into `src/lib/templates.ts`** so fresh installs seed the revised plan directly, per the precedent set by commit `0595afc`.
- Registered in `src-tauri/src/lib.rs` as `version: 11, description: "knee_resilience_revision"`.

## Explicitly out of scope

- Training max values (entered in-app — see above)
- Any change to Day 2, the 5/3/1 template, or builder-created programs
- Deadlift wave percentages
- Autoregulation / RPE-based loading
- In-app rehab tracking, pain logging, or symptom charting

## Medical caveat

This design is built entirely on the user's self-assessment. No imaging or clinical evaluation has been performed. A medial meniscus tear presents substantially the way the user described and is the most common driver of a Baker's cyst in adults — a popliteal cyst is a distension of the gastrocnemius–semimembranosus bursa that fills because the joint is producing excess synovial fluid, making it a *symptom* of intra-articular pathology rather than a primary problem.

Nothing in this revision is contraindicated for a meniscal tear, so the block is safe to run under that uncertainty. It is not a substitute for a diagnosis. Imaging should be pursued in parallel, not as a precondition for starting.
