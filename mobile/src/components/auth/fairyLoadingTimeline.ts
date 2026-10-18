/**
 * PetalPal Fairy Loading Animation Timeline System
 *
 * Deterministic 15-second cycling engine:
 * Action 01 (0 - 5s): Peeking & smiling at upper-right corner
 * Action 02 (5 - 10s): Sitting & looking down at upper-left corner
 * Action 03 (10 - 15s): Flying & tapping at lower-right corner
 *
 * Each action lasts exactly 5.0 seconds (3.8s dedicated hold/interaction + 1.2s smooth curved flight transition).
 * All positions and micro-animations are pure functions of elapsed time (zero drift over time).
 */

export type FairyActionId = 'peeking' | 'sitting' | 'tapping';

export const CYCLE_DURATION_MS = 20000;
export const POSE01_DURATION_MS = 10000;
export const POSE02_DURATION_MS = 5000;
export const POSE03_DURATION_MS = 5000;
export const ACTION_DURATION_MS = 5000;
export const HOLD_DURATION_MS = 3800;
export const TRANSITION_DURATION_MS = 1200;
export const POSE01_HOLD_DURATION_MS = 8800;

export function getActionHoldTime(actionIndex: 0 | 1 | 2): number {
  if (actionIndex === 0) return 1500;
  if (actionIndex === 1) return 11500;
  return 16500;
}

export interface Point2D {
  x: number; // 0 to 1 relative to card width
  y: number; // 0 to 1 relative to card height
}

// Key anchor positions relative to invitation card bounding box:
// 1. Resting / Leaning: upper-right edge, both forearms and elbows resting on top paper edge
export const ANCHOR_PEEKING: Point2D = { x: 0.77, y: 0.120 };

// 2. Sitting: upper-left corner edge, hips resting on top-left paper border with no hovering gap
export const ANCHOR_SITTING: Point2D = { x: 0.16, y: 0.082 };

// 3. Flying & Tapping: lower-right corner, hovering beside card border
export const ANCHOR_TAPPING: Point2D = { x: 0.940, y: 0.540 };

// Tap contact point on the invitation paper edge where index finger touches
export const TAP_CONTACT_POINT: Point2D = { x: 0.940, y: 0.540 };

// Local pivot points for Pose 01 Head and Hands Idle Animation (in normalized sprite coordinates):
export const POSE01_HEAD_PIVOT: Point2D = { x: 778 / 1040, y: 510 / 783 };
export const POSE01_HANDS_PIVOT: Point2D = { x: 778 / 1040, y: 535 / 783 };

/**
 * Canonical Anatomical Pose Metadata
 * Derived directly from pixel measurements on the approved master and repaired pose source artworks:
 * - Master head height: 135 px
 * - Pose 01 (Cute Resting on Edge): 265 px (crown to chin in 1040x783 master sprite)
 * - Pose 02 (Sitting): 187 px (crown to chin)
 * - Pose 03 (Tapping): 165 px (crown to chin)
 * - Glide: 305 px (flight profile)
 * All poses are normalized to one canonical head height so that physical body scale is 100% identical.
 */
export interface FairyPoseMetadata {
  id: FairyActionId | 'glide';
  spriteWidth: number;
  spriteHeight: number;
  headHeightPx: number; // Measured anatomical head height in source sprite
  faceWidthPx: number;  // Face cheek-to-cheek width in source sprite
  anchorX: number;      // Local contact anchor X in sprite pixels
  anchorY: number;      // Local contact anchor Y in sprite pixels
  clipBottomY?: number; // Optional baseline clipping Y for paper-edge occlusion
  blinkTopPct: string;
  blinkLeftPct: string;
  blinkWidth: number;
  blinkHeight: number;
}

export const POSE_METADATA: Record<'peeking' | 'sitting' | 'tapping' | 'glide', FairyPoseMetadata> = {
  peeking: {
    id: 'peeking',
    spriteWidth: 1040,
    spriteHeight: 783,
    headHeightPx: 265,
    faceWidthPx: 180,
    anchorX: 790, // Center between resting elbows
    anchorY: 762, // Forearms & elbows contact baseline on invitation paper edge
    blinkTopPct: '20%',
    blinkLeftPct: '48%',
    blinkWidth: 14,
    blinkHeight: 3.5,
  },
  sitting: {
    id: 'sitting',
    spriteWidth: 528,
    spriteHeight: 926,
    headHeightPx: 187,
    faceWidthPx: 140,
    anchorX: 317,  // Hips center
    anchorY: 546,  // Seating contact shelf (resting on top edge with 0px hovering gap)
    blinkTopPct: '20%',
    blinkLeftPct: '52%',
    blinkWidth: 14,
    blinkHeight: 3.5,
  },
  tapping: {
    id: 'tapping',
    spriteWidth: 711,
    spriteHeight: 962,
    headHeightPx: 165,
    faceWidthPx: 135,
    anchorX: 20,   // Extended fingertip contact point
    anchorY: 300,  // Extended fingertip Y
    blinkTopPct: '20%',
    blinkLeftPct: '48%',
    blinkWidth: 14,
    blinkHeight: 3.5,
  },
  glide: {
    id: 'glide',
    spriteWidth: 1086,
    spriteHeight: 1448,
    headHeightPx: 305,
    faceWidthPx: 130,
    anchorX: 580, // Fairy body center
    anchorY: 500,
    blinkTopPct: '22%',
    blinkLeftPct: '50%',
    blinkWidth: 14,
    blinkHeight: 3.5,
  },
};

/**
 * Computes canonical head height (px) based on invitation card height.
 * In the approved storyboard, the fairy's head is 10.2% of card height (36px / 352px).
 * For cardHeight = 546, canonical head height = ~56px.
 */
export function getCanonicalHeadHeight(cardHeight: number): number {
  return Math.max(24, Math.round(cardHeight * 0.102));
}

/**
 * Computes the exact scale multiplier for any pose to guarantee identical apparent character scale.
 */
export function getPoseScale(cardHeight: number, poseKey: 'peeking' | 'sitting' | 'tapping' | 'glide'): number {
  const canonicalHead = getCanonicalHeadHeight(cardHeight);
  return canonicalHead / POSE_METADATA[poseKey].headHeightPx;
}

export interface FairyLoadingFrame {
  cycleMs: number;
  actionIndex: 0 | 1 | 2;
  actionId: FairyActionId;
  actionProgress: number; // 0 to 1 within the 5000ms
  isTransitioning: boolean;
  transitionProgress: number; // 0 to 1 during the 1200ms transition
  currentPoseIndex: 0 | 1 | 2;
  nextPoseIndex: 0 | 1 | 2;
  poseMix: number; // 0 = current pose, 1 = next pose
  x: number; // normalized relative to card width
  y: number; // normalized relative to card height
  rotationDeg: number;
  headTiltDeg: number;
  scaleMultiplier: number;
  wingFlutter: number; // sine wave for Skia wing deformation / opacity
  breatheY: number; // subtle vertical breathing displacement (normalized)
  blink: number; // 0 = eyes open, 1 = eyes closed
  isBehindCard: boolean; // physical depth layering: true when hidden behind invitation paper
  isTapping: boolean;
  tapReach: number; // 0 to 1 arm extension towards paper edge
  sparkleActive: boolean;
  sparkleX: number;
  sparkleY: number;
  sparkleScale: number;
  sparkleOpacity: number;
}

// Cubic Bezier interpolation
function cubicBezier(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const oneMinusT = 1 - t;
  return (
    oneMinusT * oneMinusT * oneMinusT * p0 +
    3 * oneMinusT * oneMinusT * t * p1 +
    3 * oneMinusT * t * t * p2 +
    t * t * t * p3
  );
}

// Soft, gentle sinusoidal easing for delicate fairy flight motion
function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// Flight path Bezier control points for transitions between anchors
interface FlightPath {
  start: Point2D;
  c1: Point2D;
  c2: Point2D;
  end: Point2D;
  startRot: number;
  midRot: number;
  endRot: number;
}

// Transition 0 -> 1: Upper-Right to Upper-Left (lifts upward from resting edge, glides across top, lands seated)
const PATH_PEEKING_TO_SITTING: FlightPath = {
  start: ANCHOR_PEEKING,
  c1: { x: 0.77, y: -0.16 }, // lifts smoothly upward into open air
  c2: { x: 0.36, y: -0.12 }, // glides smoothly across top
  end: ANCHOR_SITTING,
  startRot: 0,
  midRot: -4,
  endRot: 0,
};

// Transition 1 -> 2: Upper-Left to Lower-Right (leaves seat, swoops diagonally down right flank)
const PATH_SITTING_TO_TAPPING: FlightPath = {
  start: ANCHOR_SITTING,
  c1: { x: 0.38, y: 0.12 },
  c2: { x: 1.02, y: 0.32 },
  end: ANCHOR_TAPPING,
  startRot: 0,
  midRot: 6,
  endRot: 0,
};

// Transition 2 -> 0: Lower-Right back to Upper-Right (ascends along right side, descends onto resting edge)
const PATH_TAPPING_TO_PEEKING: FlightPath = {
  start: ANCHOR_TAPPING,
  c1: { x: 1.02, y: 0.20 },
  c2: { x: 0.82, y: -0.12 },
  end: ANCHOR_PEEKING,
  startRot: 0,
  midRot: -4,
  endRot: 0,
};

const FLIGHT_PATHS: [FlightPath, FlightPath, FlightPath] = [
  PATH_PEEKING_TO_SITTING,
  PATH_SITTING_TO_TAPPING,
  PATH_TAPPING_TO_PEEKING,
];

/**
 * Computes natural blink curve (0 to 1) for a given eye-blink window
 * @param timeInAction ms within the 5000ms action
 * @param blinkStarts array of timestamps when blinks occur
 * @param blinkDuration duration of blink in ms (typically 180ms)
 */
function computeBlink(timeInAction: number, blinkStarts: number[], blinkDuration = 180): number {
  for (const start of blinkStarts) {
    if (timeInAction >= start && timeInAction <= start + blinkDuration) {
      const progress = (timeInAction - start) / blinkDuration;
      // Parabolic curve: 0 -> 1 -> 0
      return Math.sin(progress * Math.PI);
    }
  }
  return 0;
}

/**
 * Calculates a complete animation frame at any arbitrary timestamp.
 * 100% deterministic and pure function of elapsedMs.
 */
export function getFairyLoadingFrame(
  elapsedMs: number,
  isReducedMotion = false
): FairyLoadingFrame {
  if (isReducedMotion) {
    // Reduced motion: stationary serene peeking pose at top-right
    return {
      cycleMs: 0,
      actionIndex: 0,
      actionId: 'peeking',
      actionProgress: 0,
      isTransitioning: false,
      transitionProgress: 0,
      currentPoseIndex: 0,
      nextPoseIndex: 0,
      poseMix: 0,
      x: ANCHOR_PEEKING.x,
      y: ANCHOR_PEEKING.y,
      rotationDeg: 0,
      headTiltDeg: 0,
      scaleMultiplier: 1,
      wingFlutter: 0,
      breatheY: 0,
      blink: 0,
      isBehindCard: true,
      isTapping: false,
      tapReach: 0,
      sparkleActive: false,
      sparkleX: TAP_CONTACT_POINT.x,
      sparkleY: TAP_CONTACT_POINT.y,
      sparkleScale: 0,
      sparkleOpacity: 0,
    };
  }

  // Modulo 20,000 ms to establish exact 20-second loop
  const cycleMs = ((elapsedMs % CYCLE_DURATION_MS) + CYCLE_DURATION_MS) % CYCLE_DURATION_MS;

  let actionIndex: 0 | 1 | 2 = 0;
  let actionId: FairyActionId = 'peeking';
  let timeInAction = 0;
  let actionDuration = POSE01_DURATION_MS;
  let holdDuration = POSE01_HOLD_DURATION_MS;
  let nextActionIndex: 0 | 1 | 2 = 1;

  if (cycleMs < POSE01_DURATION_MS) {
    actionIndex = 0;
    actionId = 'peeking';
    timeInAction = cycleMs;
    actionDuration = POSE01_DURATION_MS;
    holdDuration = POSE01_HOLD_DURATION_MS;
    nextActionIndex = 1;
  } else if (cycleMs < POSE01_DURATION_MS + POSE02_DURATION_MS) {
    actionIndex = 1;
    actionId = 'sitting';
    timeInAction = cycleMs - POSE01_DURATION_MS;
    actionDuration = POSE02_DURATION_MS;
    holdDuration = HOLD_DURATION_MS;
    nextActionIndex = 2;
  } else {
    actionIndex = 2;
    actionId = 'tapping';
    timeInAction = cycleMs - (POSE01_DURATION_MS + POSE02_DURATION_MS);
    actionDuration = POSE03_DURATION_MS;
    holdDuration = HOLD_DURATION_MS;
    nextActionIndex = 0;
  }

  const actionProgress = timeInAction / actionDuration;
  const isTransitioning = timeInAction >= holdDuration;

  let x = 0;
  let y = 0;
  let rotationDeg = 0;
  let poseMix = 0;
  let transitionProgress = 0;

  if (!isTransitioning) {
    // Holding the pose with subtle organic breathing and secondary motion
    const anchor =
      actionIndex === 0
        ? ANCHOR_PEEKING
        : actionIndex === 1
        ? ANCHOR_SITTING
        : ANCHOR_TAPPING;
    x = anchor.x;
    y = anchor.y;
    rotationDeg = 0;
    poseMix = 0;
    transitionProgress = 0;
  } else {
    // Graceful flight transition
    const transTime = timeInAction - holdDuration;
    transitionProgress = Math.min(1, Math.max(0, transTime / TRANSITION_DURATION_MS));
    const easedT = easeInOutSine(transitionProgress);

    const path = FLIGHT_PATHS[actionIndex];
    x = cubicBezier(path.start.x, path.c1.x, path.c2.x, path.end.x, easedT);
    y = cubicBezier(path.start.y, path.c1.y, path.c2.y, path.end.y, easedT);

    // Subtle bank / tilt during curved flight
    if (easedT < 0.5) {
      rotationDeg = path.startRot + (path.midRot - path.startRot) * (easedT * 2);
    } else {
      rotationDeg = path.midRot + (path.endRot - path.midRot) * ((easedT - 0.5) * 2);
    }

    // Pose crossfade occurs smoothly during the flight transition
    poseMix = easedT;
  }

  // Micro-animations per action:
  let wingFlutter = 0;
  let breatheY = 0;
  let blink = 0;
  let headTiltDeg = 0;
  let isTapping = false;
  let tapReach = 0;
  let sparkleActive = false;
  let sparkleScale = 0;
  let sparkleOpacity = 0;

  if (actionIndex === 0) {
    // Action 01: Cute Fairy Resting on Invitation (TWO Full Head-Tilt Cycles)
    // 1. Initial gentle settling onto edge after landing (0 to 700ms)
    let settleOffset = 0;
    if (timeInAction < 700) {
      const settleT = timeInAction / 700;
      settleOffset = (1 - settleT) * (1 - settleT) * -0.004;
    }

    // 2. Gentle organic breathing: ~3.4s slow calm period (attenuates smoothly before liftoff at 8800ms)
    let breathEnvelope = 1;
    if (timeInAction >= 8200 && timeInAction <= 8800) {
      breathEnvelope = 1 - (timeInAction - 8200) / 600;
    } else if (timeInAction > 8800) {
      breathEnvelope = 0;
    }
    breatheY = (Math.sin((timeInAction / 3400) * 2 * Math.PI) * 0.0012 + settleOffset) * breathEnvelope;

    // 3. Delicate, subtle wing shimmer
    wingFlutter = Math.sin((timeInAction / 2000) * 2 * Math.PI) * 0.02;

    // 4. Production Head Idle Animation: TWO Complete Head-Tilt Cycles
    // Non-destructive head tilt and blinking: body, wings, dress, and elbows remain strictly stationary.
    if (!isTransitioning) {
      // Body rotation remains strictly 0 during hold
      rotationDeg = 0;

      if (timeInAction < 5000) {
        // --- CYCLE 1 (0.0s - 5.0s, approx 5 seconds) ---
        const t1 = timeInAction;
        if (t1 < 800) {
          // 0.0 - 0.8s: Neutral resting pose, soft serene smile (0 deg)
          headTiltDeg = 0;
        } else if (t1 < 1800) {
          // 0.8 - 1.8s: Slowly tilting her head toward one hand (+5.5 deg)
          const p = (t1 - 800) / 1000;
          const eased = (1 - Math.cos(p * Math.PI)) / 2;
          headTiltDeg = eased * 5.5;
        } else if (t1 < 2500) {
          // 1.8 - 2.5s: Hold tilted position (+5.5 deg) with sweet smiling blink
          headTiltDeg = 5.5;
          blink = computeBlink(t1, [2060], 180);
        } else if (t1 < 3200) {
          // 2.5 - 3.2s: Naturally returning toward neutral through 0 deg to subtle counter-tilt (-1.8 deg)
          const p = (t1 - 2500) / 700;
          const eased = (1 - Math.cos(p * Math.PI)) / 2;
          headTiltDeg = 5.5 - eased * (5.5 + 1.8);
        } else if (t1 < 3700) {
          // 3.2 - 3.7s: Settle smoothly from -1.8 deg back to 0.0 deg
          const p = (t1 - 3200) / 500;
          const eased = (1 - Math.cos(p * Math.PI)) / 2;
          headTiltDeg = -1.8 + eased * 1.8;
        } else {
          // 3.7 - 5.0s: Relaxed neutral resting pose at 0.0 deg, gentle smile
          headTiltDeg = 0;
        }
      } else {
        // --- CYCLE 2 (5.0s - 10.0s, approx 5 seconds) ---
        const t2 = timeInAction - 5000;
        if (t2 < 800) {
          // 5.0 - 5.8s: Neutral resting pose, soft serene smile (0 deg)
          headTiltDeg = 0;
        } else if (t2 < 1800) {
          // 5.8 - 6.8s: Slowly tilting her head toward one hand (+5.5 deg)
          const p = (t2 - 800) / 1000;
          const eased = (1 - Math.cos(p * Math.PI)) / 2;
          headTiltDeg = eased * 5.5;
        } else if (t2 < 2500) {
          // 6.8 - 7.5s: Hold tilted position (+5.5 deg) with sweet smiling blink
          headTiltDeg = 5.5;
          blink = computeBlink(timeInAction, [7060], 180);
        } else if (t2 < 3200) {
          // 7.5 - 8.2s: Naturally returning toward neutral through 0 deg to subtle counter-tilt (-1.8 deg)
          const p = (t2 - 2500) / 700;
          const eased = (1 - Math.cos(p * Math.PI)) / 2;
          headTiltDeg = 5.5 - eased * (5.5 + 1.8);
        } else if (t2 < 3700) {
          // 8.2 - 8.7s: Settle smoothly from -1.8 deg back to 0.0 deg
          const p = (t2 - 3200) / 500;
          const eased = (1 - Math.cos(p * Math.PI)) / 2;
          headTiltDeg = -1.8 + eased * 1.8;
        } else {
          // 8.7 - 8.8s: Second head tilt fully returned to neutral (0.0 deg) before flight liftoff
          headTiltDeg = 0;
        }
      }
    } else {
      // During flight transition (8.8s - 10.0s), head aligns with body flight banking
      headTiltDeg = 0;
    }
  } else if (actionIndex === 1) {
    // Action 02: Sitting & Looking Down
    // Gentle breathing (attenuates smoothly to 0 before flight liftoff at 3800ms)
    let breathEnvelope = 1;
    if (timeInAction >= 3400 && timeInAction <= 3800) {
      breathEnvelope = 1 - (timeInAction - 3400) / 400;
    } else if (timeInAction > 3800) {
      breathEnvelope = 0;
    }
    breatheY = Math.sin((timeInAction / 3000) * 2 * Math.PI) * 0.003 * breathEnvelope;
    // Slow, subtle wing motion
    wingFlutter = Math.sin((timeInAction / 2200) * 2 * Math.PI) * 0.04;
    // Thoughtful blinking at 1.2s and 2.8s
    blink = computeBlink(timeInAction, [1200, 2800]);
    // Subtle seated breathing sway that starts and ends at 0 deg for seamless continuity
    if (!isTransitioning) {
      rotationDeg += Math.sin((timeInAction / 3800) * 2 * Math.PI) * 0.8;
    }
  } else {
    // Action 03: Flying & Tapping
    // Hovering bob (floating in air, attenuates smoothly to 0 before flight return at 3800ms)
    let bobEnvelope = 1;
    if (timeInAction >= 3400 && timeInAction <= 3800) {
      bobEnvelope = 1 - (timeInAction - 3400) / 400;
    } else if (timeInAction > 3800) {
      bobEnvelope = 0;
    }
    breatheY = Math.sin((timeInAction / 1400) * 2 * Math.PI) * 0.007 * bobEnvelope;
    // Continuous delicate wing flutter
    wingFlutter = Math.sin((timeInAction / 320) * 2 * Math.PI) * 0.08;
    // Curious blinking at 1.0s and 2.6s
    blink = computeBlink(timeInAction, [1000, 2600]);

    // Tap interactions occur at:
    // Tap 1: 1400ms to 2200ms
    // Tap 2: 2700ms to 3500ms
    const tap1 = timeInAction >= 1400 && timeInAction <= 2200;
    const tap2 = timeInAction >= 2700 && timeInAction <= 3500;

    if (tap1 || tap2) {
      isTapping = true;
      const tapStart = tap1 ? 1400 : 2700;
      const tapDur = 800;
      const tapProgress = (timeInAction - tapStart) / tapDur;
      // Arm extends forward to reach paper edge (sine curve: reaches max at middle)
      tapReach = Math.sin(tapProgress * Math.PI);

      // Contact point is when tapReach is near maximum (> 0.85)
      if (tapReach > 0.85) {
        sparkleActive = true;
        const sparkleProgress = (tapReach - 0.85) / 0.15;
        sparkleScale = Math.max(0.05, Math.sin(sparkleProgress * Math.PI));
        sparkleOpacity = Math.min(1, Math.max(0.1, Math.sin(sparkleProgress * Math.PI) * 1.2));
      }
    }
  }

  // Adjust wing flutter during flight transitions (active flap)
  if (isTransitioning) {
    wingFlutter = Math.sin((cycleMs / 220) * 2 * Math.PI) * 0.12;
  }

  // Physical depth layering: fairy rests visibly on invitation card edge and foreground flight plane
  const isBehindCard = false;

  return {
    cycleMs,
    actionIndex,
    actionId,
    actionProgress,
    isTransitioning,
    transitionProgress,
    currentPoseIndex: actionIndex,
    nextPoseIndex: nextActionIndex,
    poseMix,
    x,
    y: y + breatheY,
    rotationDeg,
    headTiltDeg,
    scaleMultiplier: 1.0,
    wingFlutter,
    breatheY,
    blink,
    isBehindCard,
    isTapping,
    tapReach,
    sparkleActive,
    sparkleX: TAP_CONTACT_POINT.x,
    sparkleY: TAP_CONTACT_POINT.y,
    sparkleScale,
    sparkleOpacity,
  };
}
