import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(mobileRoot, 'package.json'));
const ts = require('typescript');

const timelineSource = fs.readFileSync(
  path.join(mobileRoot, 'src/components/auth/fairyLoadingTimeline.ts'),
  'utf8'
);

const compiled = ts.transpileModule(timelineSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const context = { exports: {} };
vm.runInNewContext(compiled, context);
const {
  CYCLE_DURATION_MS,
  ACTION_DURATION_MS,
  HOLD_DURATION_MS,
  TRANSITION_DURATION_MS,
  getFairyLoadingFrame,
  ANCHOR_PEEKING,
  ANCHOR_SITTING,
  ANCHOR_TAPPING,
  TAP_CONTACT_POINT,
} = context.exports;

console.log('--- Testing Fairy Loading Timeline System ---');

// 1. Durations
assert.equal(CYCLE_DURATION_MS, 20000, 'Total cycle must be 20 seconds');
assert.equal(ACTION_DURATION_MS, 5000, 'Base interval unit is 5 seconds');
assert.equal(HOLD_DURATION_MS + TRANSITION_DURATION_MS, 5000, 'Hold + Transition for Poses 02/03 must equal 5 seconds');

// 2. Action states and anchor placement
const f0 = getFairyLoadingFrame(0);
assert.equal(f0.actionIndex, 0, '0s should be action 0 (peeking)');
assert.equal(f0.actionId, 'peeking');
assert.equal(f0.isTransitioning, false);
assert.equal(f0.currentPoseIndex, 0);
assert.equal(f0.nextPoseIndex, 1);
assert.equal(f0.poseMix, 0);
assert.ok(Math.abs(f0.x - ANCHOR_PEEKING.x) < 0.001);

const f1 = getFairyLoadingFrame(10000);
assert.equal(f1.actionIndex, 1, '10s should be action 1 (sitting)');
assert.equal(f1.actionId, 'sitting');
assert.equal(f1.isTransitioning, false);
assert.equal(f1.currentPoseIndex, 1);
assert.equal(f1.nextPoseIndex, 2);
assert.equal(f1.poseMix, 0);
assert.ok(Math.abs(f1.x - ANCHOR_SITTING.x) < 0.001);

const f2 = getFairyLoadingFrame(15000);
assert.equal(f2.actionIndex, 2, '15s should be action 2 (tapping)');
assert.equal(f2.actionId, 'tapping');
assert.equal(f2.isTransitioning, false);
assert.equal(f2.currentPoseIndex, 2);
assert.equal(f2.nextPoseIndex, 0);
assert.equal(f2.poseMix, 0);
assert.ok(Math.abs(f2.x - ANCHOR_TAPPING.x) < 0.001);

// 3. Smooth transition intervals
// Action 0 transition: 8800ms - 10000ms (after two complete head tilts have returned to neutral)
const trans0Mid = getFairyLoadingFrame(9400);
assert.equal(trans0Mid.actionIndex, 0);
assert.equal(trans0Mid.isTransitioning, true);
assert.ok(trans0Mid.transitionProgress > 0 && trans0Mid.transitionProgress < 1);
assert.ok(trans0Mid.poseMix > 0 && trans0Mid.poseMix < 1);
// Arcs upward (y should be more negative than start)
assert.ok(trans0Mid.y < ANCHOR_PEEKING.y, 'Transition 0->1 must arc upward gracefully');

// Action 1 transition: 13800ms - 15000ms
const trans1Mid = getFairyLoadingFrame(14400);
assert.equal(trans1Mid.actionIndex, 1);
assert.equal(trans1Mid.isTransitioning, true);
assert.ok(trans1Mid.poseMix > 0 && trans1Mid.poseMix < 1);

// Action 2 transition: 18800ms - 20000ms
const trans2Mid = getFairyLoadingFrame(19400);
assert.equal(trans2Mid.actionIndex, 2);
assert.equal(trans2Mid.isTransitioning, true);
assert.ok(trans2Mid.poseMix > 0 && trans2Mid.poseMix < 1);

// 4. Boundary continuity at 20000ms (20s loop seamlessness)
const frameEnd = getFairyLoadingFrame(19999);
const frameStart = getFairyLoadingFrame(20000);
assert.ok(
  Math.abs(frameEnd.x - frameStart.x) < 0.02,
  `Seamless x continuity at loop boundary: ${frameEnd.x} vs ${frameStart.x}`
);
assert.ok(
  Math.abs(frameEnd.y - frameStart.y) < 0.02,
  `Seamless y continuity at loop boundary: ${frameEnd.y} vs ${frameStart.y}`
);

// 5. Check multi-cycle continuity (20s, 40s, 60s)
for (let cycle = 1; cycle <= 5; cycle++) {
  const t = cycle * 20000;
  const frame = getFairyLoadingFrame(t);
  assert.equal(frame.actionIndex, 0);
  assert.equal(frame.cycleMs, 0);
  assert.ok(Math.abs(frame.x - ANCHOR_PEEKING.x) < 0.001);
}

// 6. Action 03 Tapping sparkle triggers
let sparkleFound = false;
for (let ms = 15000; ms < 20000; ms += 25) {
  const frame = getFairyLoadingFrame(ms);
  if (frame.sparkleActive) {
    sparkleFound = true;
    assert.ok(frame.sparkleOpacity > 0 && frame.sparkleOpacity <= 1);
    assert.ok(frame.sparkleScale > 0 && frame.sparkleScale <= 1);
    assert.ok(Math.abs(frame.sparkleX - TAP_CONTACT_POINT.x) < 0.001);
  }
}
assert.ok(sparkleFound, 'Action 03 must trigger tap sparkle contact');

// 7. Reduced motion
const reduced = getFairyLoadingFrame(12500, true);
assert.equal(reduced.isTransitioning, false);
assert.equal(reduced.actionIndex, 0, 'Reduced motion settles on calm peeking state');
assert.equal(reduced.wingFlutter, 0);
assert.equal(reduced.breatheY, 0);
assert.equal(reduced.headTiltDeg, 0);

// 8. Pose 01: TWO Complete Head-Tilt Cycles Verification
// --- CYCLE 1 (0.0s - 5.0s) ---
const fNeutral1 = getFairyLoadingFrame(500);
assert.equal(fNeutral1.actionIndex, 0);
assert.equal(fNeutral1.headTiltDeg, 0, 'Neutral head at 0.5s must be 0 deg');
assert.equal(fNeutral1.rotationDeg, 0, 'Body rotation in Pose 01 must be 0 deg (stationary)');
assert.equal(fNeutral1.blink, 0, 'Eyes open in neutral pose');

const fTilted1 = getFairyLoadingFrame(2000);
assert.equal(fTilted1.actionIndex, 0);
assert.equal(fTilted1.headTiltDeg, 5.5, 'Cycle 1: Maximum head tilt at 2.0s must be +5.5 deg');
assert.equal(fTilted1.rotationDeg, 0, 'Body remains strictly stationary during head tilt');

const fBlink1 = getFairyLoadingFrame(2150);
assert.ok(fBlink1.blink > 0.8, 'Cycle 1: Blink must reach peak (>0.8) during hold at ~2.15s');
assert.equal(fBlink1.headTiltDeg, 5.5, 'Head remains tilted during sweet blink');

const fCounter1 = getFairyLoadingFrame(3200);
assert.ok(fCounter1.headTiltDeg < 0, 'Cycle 1: Subtle counter-tilt occurs around 3.2s');
assert.equal(fCounter1.rotationDeg, 0, 'Body remains strictly stationary during counter-tilt');

const fSettle1 = getFairyLoadingFrame(3750);
assert.equal(fSettle1.headTiltDeg, 0, 'Cycle 1: Head settles back to 0 deg by 3.75s');
assert.equal(fSettle1.rotationDeg, 0, 'Body remains stationary');

const fHold1End = getFairyLoadingFrame(4900);
assert.equal(fHold1End.actionIndex, 0);
assert.equal(fHold1End.headTiltDeg, 0, 'Cycle 1 completes at ~5.0s in relaxed neutral pose');
assert.equal(fHold1End.isTransitioning, false, 'No premature transition at 5.0s');

// --- CYCLE 2 (5.0s - 10.0s) ---
const fNeutral2 = getFairyLoadingFrame(5500);
assert.equal(fNeutral2.actionIndex, 0);
assert.equal(fNeutral2.headTiltDeg, 0, 'Cycle 2: Neutral head at 5.5s must be 0 deg');
assert.equal(fNeutral2.rotationDeg, 0, 'Body remains stationary');

const fTilted2 = getFairyLoadingFrame(7000);
assert.equal(fTilted2.actionIndex, 0);
assert.equal(fTilted2.headTiltDeg, 5.5, 'Cycle 2: Maximum head tilt at 7.0s must be +5.5 deg');
assert.equal(fTilted2.rotationDeg, 0, 'Body remains stationary');

const fBlink2 = getFairyLoadingFrame(7150);
assert.ok(fBlink2.blink > 0.8, 'Cycle 2: Blink must reach peak during hold at ~7.15s');
assert.equal(fBlink2.headTiltDeg, 5.5, 'Head remains tilted during sweet blink');

const fCounter2 = getFairyLoadingFrame(8200);
assert.ok(fCounter2.headTiltDeg < 0, 'Cycle 2: Subtle counter-tilt occurs around 8.2s');
assert.equal(fCounter2.rotationDeg, 0, 'Body remains stationary');

const fSettle2 = getFairyLoadingFrame(8750);
assert.equal(fSettle2.headTiltDeg, 0, 'Cycle 2: Head settles back to 0 deg by 8.75s before transition');
assert.equal(fSettle2.rotationDeg, 0, 'Body remains stationary');
assert.equal(fSettle2.isTransitioning, false, 'Still resting on card at 8.75s');

// Transition to Pose 02 only starts at 8800ms
const fTransStart = getFairyLoadingFrame(8850);
assert.equal(fTransStart.isTransitioning, true, 'Flight transition starts at 8.8s after 2nd head tilt returns to neutral');

console.log('✓ All 8 Fairy Loading Timeline test suites passed successfully!');
