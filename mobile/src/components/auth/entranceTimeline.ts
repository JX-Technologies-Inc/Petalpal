export type LoginEntrancePhase = 'idle' | 'envelope_exiting' | 'gates_opening' | 'camera_entering' | 'handoff' | 'complete';
export const ENTRANCE_DURATION = 3700;
export const ENTRANCE_TIMING = {
  envelope: [0, 500],
  gates: [300, 1500],
  camera: [1100, 3400],
  archPassing: [1300, 2700],
  archFade: [2000, 2800],
  passThrough: [2000, 2800],
  lift: [2400, 3700],
  mist: [2800, 3700],
  stage1Fade: [500, 1500],
  stage3Fade: [1900, 2800],
} as const;

// Controlled 25% scale push eliminates pixelation while preserving depth
export const SCENE_MAX_SCALE = 1.25;
export const ARCH_MAX_SCALE = 1.95;
export const ARCH_MAX_SLIDE_X = 240;
export const ARCH_MAX_LIFT_Y = 80;
export const SCENE_MAX_LIFT_Y = 0;

// Legacy depth constants preserved for structural compatibility
export const ENTRANCE_DEPTH = {gate: 1, garden: 3.6, finish: 1.3, nearClip: .03} as const;
export const ENTRANCE_STILLS = [
  { label: 'Closed', ms: 0 },
  { label: 'Envelope', ms: 350 },
  { label: 'Arch', ms: 1100 },
  { label: 'Entering', ms: 1950 },
  { label: 'Interior', ms: 2750 },
  { label: 'Complete', ms: 3700 },
] as const;

export function entrancePhase(ms: number, running = true): LoginEntrancePhase {
  if (!running) return 'idle';
  if (ms < 300) return 'envelope_exiting';
  if (ms < ENTRANCE_TIMING.camera[0]) return 'gates_opening';
  if (ms < ENTRANCE_TIMING.mist[0]) return 'camera_entering';
  if (ms < ENTRANCE_DURATION) return 'handoff';
  return 'complete';
}

export function stageProgress(ms: number, start: number, end: number) {
  const t = Math.max(0, Math.min(1, (ms - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

export function projectEntranceDepth(depth: number, cameraZ: number) {
  const distance = depth - cameraZ;
  return {scale: depth / Math.max(distance, ENTRANCE_DEPTH.nearClip), visible: distance > 0 ? 1 : 0};
}

export function entranceFrame(ms: number, reduced = false) {
  const envelope = stageProgress(ms, ...ENTRANCE_TIMING.envelope);
  const cameraT = reduced ? 0 : stageProgress(ms, ...ENTRANCE_TIMING.camera);
  const parting = reduced ? 0 : stageProgress(ms, ...ENTRANCE_TIMING.archPassing);
  const fade = reduced ? stageProgress(ms, ...ENTRANCE_TIMING.gates) : stageProgress(ms, ...ENTRANCE_TIMING.archFade);
  const gateAngle = reduced ? 0 : stageProgress(ms, ...ENTRANCE_TIMING.gates) * 84;
  const lift = reduced ? 0 : stageProgress(ms, ...ENTRANCE_TIMING.lift);
  const mist = stageProgress(ms, ...ENTRANCE_TIMING.mist);
  const archOpacity = 1 - fade;
  const sceneScale = 1 + cameraT * (SCENE_MAX_SCALE - 1);
  const archScale = 1 + parting * (ARCH_MAX_SCALE - 1);
  const archSlideX = parting * ARCH_MAX_SLIDE_X;
  const archLiftY = parting * ARCH_MAX_LIFT_Y;

  const stage1Fade = reduced ? 1 : stageProgress(ms, ...ENTRANCE_TIMING.stage1Fade);

  return {
    envelopeOpacity: 1 - envelope,
    envelopeY: reduced ? 0 : envelope * 95,
    envelopeScale: reduced ? 1 : 1 - envelope * .04,
    gateAngle,
    gateOpacity: archOpacity,
    archOpacity,
    archScale,
    archSlideX,
    archLiftY,
    cameraT,
    cameraZ: cameraT,
    sceneScale,
    cameraLiftY: lift * SCENE_MAX_LIFT_Y,
    distantScale: sceneScale,
    entranceScale: sceneScale,
    entranceVisible: archOpacity > 0 ? 1 : 0,
    mist,
    handoffOpacity: 1 - mist,
    handoffVeil: reduced ? 0 : 4 * mist * (1 - mist) * 0.28,
    stage1Opacity: 1 - stage1Fade,
    stage2Blend: stage1Fade,
    stage3Opacity: 0,
  };
}
