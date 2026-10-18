import { getFairyLoadingFrame, CYCLE_DURATION_MS } from '../src/components/auth/fairyLoadingTimeline.ts';

function computePoseOpacities(frame) {
  let op0 = 0;
  let op1 = 0;
  let op2 = 0;

  if (!frame.isTransitioning) {
    if (frame.actionIndex === 0) op0 = 1;
    else if (frame.actionIndex === 1) op1 = 1;
    else op2 = 1;
  } else {
    const u = frame.transitionProgress;
    let fromOp = 1;
    let toOp = 0;

    if (u <= 0.35) {
      fromOp = 1;
      toOp = 0;
    } else if (u >= 0.65) {
      fromOp = 0;
      toOp = 1;
    } else {
      const t = (u - 0.35) / 0.30;
      const ease = (1 - Math.cos(t * Math.PI)) / 2;
      fromOp = 1 - ease;
      toOp = ease;
    }

    if (frame.currentPoseIndex === 0) op0 = fromOp;
    else if (frame.currentPoseIndex === 1) op1 = fromOp;
    else op2 = fromOp;

    if (frame.nextPoseIndex === 0) op0 = toOp;
    else if (frame.nextPoseIndex === 1) op1 = toOp;
    else op2 = toOp;
  }
  return { op0, op1, op2 };
}

console.log('=== VERIFYING MATHEMATICAL CONTINUITY ACROSS 20,000 MS ===');

let maxDx = 0;
let maxDy = 0;
let maxDrot = 0;
let maxDheadTilt = 0;
let maxDblink = 0;
let maxDop0 = 0;
let maxDop1 = 0;
let maxDop2 = 0;

let prevFrame = getFairyLoadingFrame(0);
let prevOps = computePoseOpacities(prevFrame);

let discontinuities = [];

for (let t = 1; t <= CYCLE_DURATION_MS; t++) {
  const frame = getFairyLoadingFrame(t % CYCLE_DURATION_MS);
  const ops = computePoseOpacities(frame);

  const dx = Math.abs(frame.x - prevFrame.x);
  const dy = Math.abs(frame.y - prevFrame.y);
  const drot = Math.abs(frame.rotationDeg - prevFrame.rotationDeg);
  const dheadTilt = Math.abs(frame.headTiltDeg - prevFrame.headTiltDeg);
  const dblink = Math.abs(frame.blink - prevFrame.blink);
  const dop0 = Math.abs(ops.op0 - prevOps.op0);
  const dop1 = Math.abs(ops.op1 - prevOps.op1);
  const dop2 = Math.abs(ops.op2 - prevOps.op2);

  if (dx > maxDx) maxDx = dx;
  if (dy > maxDy) maxDy = dy;
  if (drot > maxDrot) maxDrot = drot;
  if (dheadTilt > maxDheadTilt) maxDheadTilt = dheadTilt;
  if (dblink > maxDblink) maxDblink = dblink;
  if (dop0 > maxDop0) maxDop0 = dop0;
  if (dop1 > maxDop1) maxDop1 = dop1;
  if (dop2 > maxDop2) maxDop2 = dop2;

  // Threshold checks for 1ms interval:
  // A jump larger than 0.02 in coords or 0.5 in degrees in a single ms indicates a discontinuity!
  if (dx > 0.02 || dy > 0.02 || drot > 0.5 || dheadTilt > 0.2 || dblink > 0.05 || dop0 > 0.02 || dop1 > 0.02 || dop2 > 0.02) {
    discontinuities.push({
      t,
      dx, dy, drot, dheadTilt, dblink, dop0, dop1, dop2,
      prevFrame, frame, prevOps, ops
    });
  }

  prevFrame = frame;
  prevOps = ops;
}

console.log(`Max per-ms delta across 20,000ms:`);
console.log(`  dx: ${maxDx.toFixed(6)}`);
console.log(`  dy: ${maxDy.toFixed(6)}`);
console.log(`  drot: ${maxDrot.toFixed(6)} deg`);
console.log(`  dheadTilt: ${maxDheadTilt.toFixed(6)} deg`);
console.log(`  dblink: ${maxDblink.toFixed(6)}`);
console.log(`  dop0: ${maxDop0.toFixed(6)}`);
console.log(`  dop1: ${maxDop1.toFixed(6)}`);
console.log(`  dop2: ${maxDop2.toFixed(6)}`);

if (discontinuities.length === 0) {
  console.log('\n[PASS] ZERO DISCONTINUITIES FOUND ACROSS ENTIRE 20-SECOND TIMELINE!');
} else {
  console.error(`\n[FAIL] Found ${discontinuities.length} discontinuities! First 5:`);
  console.error(discontinuities.slice(0, 5));
  process.exit(1);
}
