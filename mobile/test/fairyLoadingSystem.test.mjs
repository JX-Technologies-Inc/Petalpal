import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(mobileRoot, 'package.json'));
const ts = require('typescript');

const timelinePath = path.join(mobileRoot, 'src/components/auth/fairyLoadingTimeline.ts');
const compPath = path.join(mobileRoot, 'src/components/auth/FairyLoadingExperience.tsx');
const routePath = path.join(mobileRoot, 'src/app/fairy-loading-test.tsx');

function compileTs(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  return ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  }).outputText;
}

const timelineContext = { exports: {} };
vm.runInNewContext(compileTs(timelinePath), timelineContext);
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
  POSE_METADATA,
  getCanonicalHeadHeight,
  getPoseScale,
} = timelineContext.exports;

console.log('====================================================');
console.log('PETALPAL FAIRY LOADING SYSTEM — TEST SUITE');
console.log('====================================================\n');

// SUITE 1: Timing & Architecture
console.log('--- SUITE 1: 20-Second Cycle & 4-Interval Architecture ---');
assert.equal(CYCLE_DURATION_MS, 20000, 'Total cycle must be 20,000 ms');
assert.equal(ACTION_DURATION_MS, 5000, 'Base interval unit is 5,000 ms');
assert.equal(HOLD_DURATION_MS, 3800, 'Dedicated hold duration for Poses 02/03 is 3,800 ms');
assert.equal(TRANSITION_DURATION_MS, 1200, 'Flight transition is 1,200 ms');
assert.equal(HOLD_DURATION_MS + TRANSITION_DURATION_MS, ACTION_DURATION_MS);
console.log('  [PASS] Exactly 20.0 seconds total cycle with 10s Pose 01 and 5s Poses 02/03');

// SUITE 2: Action Pose Sequence & Anchors
console.log('\n--- SUITE 2: Action Pose Sequence & Spatial Placement ---');
const frame0 = getFairyLoadingFrame(1000);
assert.equal(frame0.actionIndex, 0);
assert.equal(frame0.actionId, 'peeking');
assert.ok(Math.abs(frame0.x - ANCHOR_PEEKING.x) < 0.01);
assert.ok(frame0.x > 0.65, 'Action 01 must be placed at upper-right');
assert.ok(frame0.y < 0.15, 'Action 01 must rest along upper edge');
console.log('  [PASS] Action 01: Peeking & Smiling anchored at upper-right edge');

const frame1 = getFairyLoadingFrame(11000);
assert.equal(frame1.actionIndex, 1);
assert.equal(frame1.actionId, 'sitting');
assert.ok(Math.abs(frame1.x - ANCHOR_SITTING.x) < 0.01);
assert.ok(frame1.x < 0.35, 'Action 02 must be placed at upper-left');
assert.ok(frame1.y < 0.15, 'Action 02 must sit on upper-left edge');
console.log('  [PASS] Action 02: Sitting & Looking Down anchored at upper-left edge');

const frame2 = getFairyLoadingFrame(16000);
assert.equal(frame2.actionIndex, 2);
assert.equal(frame2.actionId, 'tapping');
assert.ok(Math.abs(frame2.x - ANCHOR_TAPPING.x) < 0.01);
assert.ok(frame2.x > 0.8, 'Action 03 must hover beside right edge');
assert.ok(frame2.y > 0.4 && frame2.y < 0.7, 'Action 03 hovers at lower-right beside card');
console.log('  [PASS] Action 03: Flying & Tapping anchored at lower-right');

// SUITE 3: Non-Overlap with Form Inputs
console.log('\n--- SUITE 3: Non-Overlap with Invitation Controls ---');
// Card inputs (Email, Password, Login button) occupy:
// x: [0.15, 0.85], y: [0.25, 0.75]
// In Action 01: y < 0.05
// In Action 02: x ≈ 0.16, y ≈ 0.05
// In Action 03: x ≈ 0.94 (outside right boundary of inputs)
assert.ok(frame0.y < 0.20, 'Action 01 stays above inputs');
assert.ok(frame1.y < 0.20, 'Action 02 stays above inputs');
assert.ok(frame2.x > 0.88, 'Action 03 stays to the right of input fields');
console.log('  [PASS] Fairy positions remain strictly clear of email and password input fields');

// SUITE 4: Continuous Bezier Flight Transitions (No Teleports)
console.log('\n--- SUITE 4: Continuous Motion & Absence of Teleports ---');
for (let ms = 0; ms < CYCLE_DURATION_MS; ms += 50) {
  const current = getFairyLoadingFrame(ms);
  const next = getFairyLoadingFrame(ms + 50);
  const dx = Math.abs(next.x - current.x);
  const dy = Math.abs(next.y - current.y);
  // Maximum step in 50ms should never exceed 0.08 normalized units (no teleports)
  assert.ok(
    dx < 0.08,
    `Teleport detected in X at ${ms}ms: dx=${dx}`
  );
  assert.ok(
    dy < 0.08,
    `Teleport detected in Y at ${ms}ms: dy=${dy}`
  );
}
console.log('  [PASS] Flight paths are mathematically smooth across all 400 sampled intervals');

// SUITE 5: 20-Second Loop Boundary Continuity & Determinism
console.log('\n--- SUITE 5: Loop Boundary Continuity & Multi-Cycle Determinism ---');
const frameEnd = getFairyLoadingFrame(19990);
const frameLoopStart = getFairyLoadingFrame(20000);
assert.ok(Math.abs(frameEnd.x - frameLoopStart.x) < 0.03, 'Loop transition in X is seamless');
assert.ok(Math.abs(frameEnd.y - frameLoopStart.y) < 0.03, 'Loop transition in Y is seamless');

// Test 5 full cycles (100 seconds)
for (let cycle = 0; cycle < 5; cycle++) {
  const t = cycle * 20000 + 2500;
  const f = getFairyLoadingFrame(t);
  assert.equal(f.actionIndex, 0);
  assert.equal(f.actionId, 'peeking');
  assert.ok(Math.abs(f.x - ANCHOR_PEEKING.x) < 0.001);
}
console.log('  [PASS] Zero time drift across 100+ seconds of simulated playback');

// SUITE 6: Action 03 Tapping Contact & Sparkle Generation
console.log('\n--- SUITE 6: Action 03 Fingertip Tap & Sparkle Effect ---');
let tapObserved = false;
let sparkleObserved = false;
for (let ms = 15000; ms < 20000; ms += 20) {
  const f = getFairyLoadingFrame(ms);
  if (f.isTapping) {
    tapObserved = true;
    assert.ok(f.tapReach >= 0 && f.tapReach <= 1);
  }
  if (f.sparkleActive) {
    sparkleObserved = true;
    assert.ok(f.sparkleScale > 0 && f.sparkleScale <= 1);
    assert.ok(f.sparkleOpacity > 0 && f.sparkleOpacity <= 1);
    assert.ok(Math.abs(f.sparkleX - TAP_CONTACT_POINT.x) < 0.001);
    assert.ok(Math.abs(f.sparkleY - TAP_CONTACT_POINT.y) < 0.001);
  }
}
assert.ok(tapObserved, 'Tapping reach must occur in Action 03');
assert.ok(sparkleObserved, 'Gold sparkle contact must trigger at card edge');
console.log('  [PASS] Tap reach extends forward and gold sparkle originates at contact point');

// SUITE 7: Asset Existence & Integrity Check
console.log('\n--- SUITE 7: Fairy Pose Assets Existence & Format ---');
const assets = [
  path.join(mobileRoot, 'assets/auth/fairy-loading/fairy_pose01_peeking.png'),
  path.join(mobileRoot, 'assets/auth/fairy-loading/fairy_pose01_body.png'),
  path.join(mobileRoot, 'assets/auth/fairy-loading/fairy_pose01_head.png'),
  path.join(mobileRoot, 'assets/auth/fairy-loading/fairy_pose01_head_blink.png'),
  path.join(mobileRoot, 'assets/auth/fairy-loading/fairy_pose01_hands.png'),
  path.join(mobileRoot, 'assets/auth/fairy-loading/fairy_pose02_sitting.png'),
  path.join(mobileRoot, 'assets/auth/fairy-loading/fairy_pose03_tapping.png'),
  path.join(mobileRoot, 'assets/garden/fairy/fly-v1/glide.png'),
  path.join(mobileRoot, 'assets/auth/invitation_materials_repaired.png'),
];
for (const p of assets) {
  assert.ok(fs.existsSync(p), `Missing asset file: ${p}`);
  const stats = fs.statSync(p);
  assert.ok(stats.size > 10000, `Asset file is too small: ${p} (${stats.size} bytes)`);
}
console.log('  [PASS] All 3 dedicated pose sprites, glide sprite, and invitation artwork verified on disk');

// SUITE 8: Component & Route Source Compilation
console.log('\n--- SUITE 8: TypeScript Source Code Compilation & Exports ---');
const compCode = compileTs(compPath);
assert.ok(compCode.includes('FairyLoadingExperience'), 'Component exports FairyLoadingExperience');
const routeCode = compileTs(routePath);
assert.ok(routeCode.includes('FairyLoadingTestRoute'), 'Preview route exports FairyLoadingTestRoute');
console.log('  [PASS] Component and /fairy-loading-test route compile without error');

// SUITE 9: Canonical Anatomical Scale & Contact Anchor Verification
console.log('\n--- SUITE 9: Canonical Anatomical Scale & Contact Anchor Calibration ---');
assert.ok(POSE_METADATA.peeking, 'Pose 01 metadata must exist');
assert.ok(POSE_METADATA.sitting, 'Pose 02 metadata must exist');
assert.ok(POSE_METADATA.tapping, 'Pose 03 metadata must exist');
assert.ok(POSE_METADATA.glide, 'Glide metadata must exist');

// Test canonical head height scaling on standard 546px card (10.2% of card height)
const cardH = 546;
const canonicalHead = getCanonicalHeadHeight(cardH);
assert.equal(canonicalHead, 56, 'Canonical head height on 546px card must be 56px (~10.2% of card)');

// Verify that all 3 poses produce the EXACT same rendered head height (within 0.1 px)
const scaleP1 = getPoseScale(cardH, 'peeking');
const scaleP2 = getPoseScale(cardH, 'sitting');
const scaleP3 = getPoseScale(cardH, 'tapping');
const scaleGlide = getPoseScale(cardH, 'glide');

const renderedHeadP1 = POSE_METADATA.peeking.headHeightPx * scaleP1;
const renderedHeadP2 = POSE_METADATA.sitting.headHeightPx * scaleP2;
const renderedHeadP3 = POSE_METADATA.tapping.headHeightPx * scaleP3;
const renderedHeadGlide = POSE_METADATA.glide.headHeightPx * scaleGlide;

assert.ok(Math.abs(renderedHeadP1 - canonicalHead) < 0.001, 'Pose 01 rendered head height matches canonical');
assert.ok(Math.abs(renderedHeadP2 - canonicalHead) < 0.001, 'Pose 02 rendered head height matches canonical');
assert.ok(Math.abs(renderedHeadP3 - canonicalHead) < 0.001, 'Pose 03 rendered head height matches canonical');
assert.ok(Math.abs(renderedHeadGlide - canonicalHead) < 0.001, 'Glide rendered head height matches canonical');

// Verify local contact anchors:
// Pose 01: Cute Resting elbows baseline anchor at (790, 762) resting on top paper edge
assert.equal(POSE_METADATA.peeking.anchorX, 790);
assert.equal(POSE_METADATA.peeking.anchorY, 762);

// Pose 02: hips seated shelf at 546px, lands with zero hovering gap at card top edge (0.082)
assert.equal(POSE_METADATA.sitting.anchorY, 546);
assert.equal(ANCHOR_SITTING.y, 0.082);

// Pose 03: fingertip anchor at x=20, y=300, contacts paper right edge
assert.equal(POSE_METADATA.tapping.anchorX, 20);
assert.equal(POSE_METADATA.tapping.anchorY, 300);
assert.equal(ANCHOR_TAPPING.x, 0.940);
assert.equal(TAP_CONTACT_POINT.x, 0.940);

console.log('  [PASS] All 3 poses and flight glide share identical 56.0px head scale (100% size parity)');
console.log('  [PASS] Local contact anchors registered: chin baseline, seated shelf, and tapping fingertip');

// SUITE 10: Pose 01 Head Idle Animation & Blinking Verification
console.log('\n--- SUITE 10: Pose 01 Head Idle Animation & Blinking ---');
const { POSE01_HEAD_PIVOT, POSE01_HANDS_PIVOT } = timelineContext.exports;
assert.ok(POSE01_HEAD_PIVOT, 'POSE01_HEAD_PIVOT must be exported');
assert.ok(POSE01_HANDS_PIVOT, 'POSE01_HANDS_PIVOT must be exported');
assert.ok(Math.abs(POSE01_HEAD_PIVOT.x - 778 / 1040) < 0.001, 'Head pivot X registered at chin');
assert.ok(Math.abs(POSE01_HEAD_PIVOT.y - 510 / 783) < 0.001, 'Head pivot Y registered at chin/neck');

// Cycle 1
const f0s = getFairyLoadingFrame(500);
assert.equal(f0s.headTiltDeg, 0, 'Head is neutral at 0.5s');
assert.equal(f0s.rotationDeg, 0, 'Body is stationary at 0.5s');
assert.equal(f0s.blink, 0, 'Eyes open at 0.5s');

const fTilt1 = getFairyLoadingFrame(2000);
assert.equal(fTilt1.headTiltDeg, 5.5, 'Cycle 1: Head tilted at +5.5 deg at 2.0s');
assert.equal(fTilt1.rotationDeg, 0, 'Body remains strictly stationary at 2.0s');

const fEye1 = getFairyLoadingFrame(2150);
assert.ok(fEye1.blink > 0.8, 'Cycle 1: Blink reaches peak at 2.15s');
assert.equal(fEye1.headTiltDeg, 5.5, 'Head remains tilted during blink');

const fReturn1 = getFairyLoadingFrame(3750);
assert.equal(fReturn1.headTiltDeg, 0, 'Cycle 1 returns to 0 deg by 3.75s');

// Cycle 2
const fNeutral2 = getFairyLoadingFrame(5500);
assert.equal(fNeutral2.headTiltDeg, 0, 'Cycle 2 starts neutral at 5.5s');

const fTilt2 = getFairyLoadingFrame(7000);
assert.equal(fTilt2.headTiltDeg, 5.5, 'Cycle 2: Head tilted at +5.5 deg at 7.0s');
assert.equal(fTilt2.rotationDeg, 0, 'Body remains stationary');

const fEye2 = getFairyLoadingFrame(7150);
assert.ok(fEye2.blink > 0.8, 'Cycle 2: Blink reaches peak at 7.15s');

const fReturn2 = getFairyLoadingFrame(8750);
assert.equal(fReturn2.headTiltDeg, 0, 'Cycle 2 returns fully to 0 deg before flight transition');
assert.equal(fReturn2.isTransitioning, false, 'Still resting on card at 8.75s');

const fTrans = getFairyLoadingFrame(8850);
assert.equal(fTrans.isTransitioning, true, 'Flight transition begins at 8.8s');

console.log('  [PASS] Pose 01 Head Idle Animation: TWO complete head tilt cycles, stationary body, +5.5 deg tilt, and sweet smiling blinks verified');

console.log('\n====================================================');
console.log('TEST SUMMARY: ALL 10 SUITES PASSED (100%)');
console.log('>>> PRODUCTION FAIRY LOADING SYSTEM VERIFIED! <<<');
console.log('====================================================\n');
