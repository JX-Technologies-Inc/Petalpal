import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

// Lightweight TypeScript loader for flower-mood-effects modules
function loadMoodModule(relativePath) {
  const baseDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/components/garden/flower-mood-effects');
  const filePath = path.join(baseDir, relativePath + (relativePath.endsWith('.ts') ? '' : '.ts'));
  const source = fs.readFileSync(filePath, 'utf8');

  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  });

  const moduleObj = { exports: {} };
  const requireLocal = (req) => {
    if (req.startsWith('.')) {
      return loadMoodModule(path.basename(req));
    }
    return require(req);
  };

  const script = new vm.Script(
    '(function(exports, require, module) {\n' + outputText + '\n})',
    { filename: filePath }
  );
  const fn = script.runInNewContext({
    console,
    Math,
    Date,
    Intl,
    Number,
    String,
    Array,
    Object,
    process: { env: {} },
  });
  fn(moduleObj.exports, requireLocal, moduleObj);

  return moduleObj.exports;
}

const {
  DEFAULT_CONFIGS,
  EFFECT_BOUNDS,
  clampEffectConfig,
  createDefaultEffectConfig,
  validateEffectConfig,
} = loadMoodModule('effectConfig');

const {
  MOOD_PRESETS,
  applyIntensityToConfig,
  resolveMoodPreset,
} = loadMoodModule('moodPresets');

const {
  FLOWER_GROUND_ANCHOR,
  RELATIVE_BLOSSOM_ANCHORS,
  getBlossomAnchors,
  getClusterEffectBounds,
} = loadMoodModule('blossomAnchors');

const {
  calculateGlowParameters,
  createRng,
  generateRainParticles,
  generateRaindropPlacements,
  generateSparkleParticles,
  isPointWithinClusterBounds,
} = loadMoodModule('effectEngine');

const {
  DEFAULT_TIMEZONE,
  createDailyFlowerEffect,
  getLocalCalendarDate,
  getNextLocalMidnight,
  getSimulatedTimestamp,
  isFlowerEffectActive,
} = loadMoodModule('dateHelpers');

let passedTests = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('====================================================');
console.log('PETALPAL FLOWER MOOD EFFECTS LAB — TEST SUITE');
console.log('====================================================\n');

// ── 1. MOOD-TO-EFFECT MAPPING ──────────────────────────────
console.log('--- SUITE 1: Mood-to-Effect Preset Mapping ---');

test('All 5 canonical mood categories exist in presets', () => {
  const expectedMoods = ['very_positive', 'positive', 'neutral', 'negative', 'very_negative'];
  for (const m of expectedMoods) {
    assert.ok(MOOD_PRESETS[m], `Missing preset for ${m}`);
  }
});

test('Very Positive maps to primary sparkle + secondary glow (intensity 0.75)', () => {
  const p = MOOD_PRESETS.very_positive;
  assert.equal(p.primaryEffectType, 'sparkle');
  assert.equal(p.secondaryEffectType, 'glow');
  assert.equal(p.defaultIntensity, 0.75);

  const resolved = resolveMoodPreset('very_positive');
  assert.equal(resolved.primaryEffect.effectType, 'sparkle');
  assert.equal(resolved.secondaryEffect.effectType, 'glow');
  assert.ok(resolved.primaryEffect.particleCount > 0);
  assert.ok(resolved.secondaryEffect.particleCount > 0);
});

test('Positive maps to primary sparkle + secondary none (intensity 0.45)', () => {
  const p = MOOD_PRESETS.positive;
  assert.equal(p.primaryEffectType, 'sparkle');
  assert.equal(p.secondaryEffectType, 'none');
  assert.equal(p.defaultIntensity, 0.45);

  const resolved = resolveMoodPreset('positive');
  assert.equal(resolved.primaryEffect.effectType, 'sparkle');
  assert.equal(resolved.secondaryEffect.effectType, 'none');
});

test('Neutral maps to primary none + secondary none (intensity 0.0)', () => {
  const p = MOOD_PRESETS.neutral;
  assert.equal(p.primaryEffectType, 'none');
  assert.equal(p.secondaryEffectType, 'none');
  assert.equal(p.defaultIntensity, 0.0);

  const resolved = resolveMoodPreset('neutral');
  assert.equal(resolved.primaryEffect.effectType, 'none');
  assert.equal(resolved.secondaryEffect.effectType, 'none');
  assert.equal(resolved.primaryEffect.particleCount, 0);
});

test('Negative maps to primary light_rain + secondary none (intensity 0.35)', () => {
  const p = MOOD_PRESETS.negative;
  assert.equal(p.primaryEffectType, 'light_rain');
  assert.equal(p.secondaryEffectType, 'none');
  assert.equal(p.defaultIntensity, 0.35);

  const resolved = resolveMoodPreset('negative');
  assert.equal(resolved.primaryEffect.effectType, 'light_rain');
  assert.equal(resolved.secondaryEffect.effectType, 'none');
});

test('Very Negative maps to primary light_rain + secondary raindrop (intensity 0.65)', () => {
  const p = MOOD_PRESETS.very_negative;
  assert.equal(p.primaryEffectType, 'light_rain');
  assert.equal(p.secondaryEffectType, 'raindrop');
  assert.equal(p.defaultIntensity, 0.65);

  const resolved = resolveMoodPreset('very_negative');
  assert.equal(resolved.primaryEffect.effectType, 'light_rain');
  assert.equal(resolved.secondaryEffect.effectType, 'raindrop');
  assert.ok(resolved.primaryEffect.particleCount > 0);
  assert.ok(resolved.secondaryEffect.particleCount > 0);
});

test('Intensity override scales particles and opacity within safe bounds', () => {
  const low = resolveMoodPreset('very_positive', { intensityOverride: 0.2 });
  const high = resolveMoodPreset('very_positive', { intensityOverride: 0.95 });

  assert.ok(low.primaryEffect.particleCount <= high.primaryEffect.particleCount);
  assert.ok(low.primaryEffect.opacity <= high.primaryEffect.opacity);
  assert.ok(high.primaryEffect.particleCount <= EFFECT_BOUNDS.particleCount.max);
});

// ── 2. PRESET CONFIGURATION VALIDATION & CLAMPING ──────────
console.log('\n--- SUITE 2: Configuration Validation & Clamping ---');

test('Default configs for all effect types pass validation', () => {
  for (const type of ['none', 'sparkle', 'glow', 'light_rain', 'raindrop']) {
    const config = createDefaultEffectConfig(type);
    const { valid, errors } = validateEffectConfig(config);
    assert.ok(valid, `Validation failed for ${type}: ${errors.join(', ')}`);
  }
});

test('validateEffectConfig rejects invalid types, negative counts and missing color', () => {
  assert.ok(!validateEffectConfig(null).valid);
  assert.ok(!validateEffectConfig({ effectType: 'invalid' }).valid);

  const badConfig = {
    ...DEFAULT_CONFIGS.sparkle,
    particleCount: -5,
  };
  assert.ok(!validateEffectConfig(badConfig).valid);

  const emptyColor = {
    ...DEFAULT_CONFIGS.sparkle,
    color: '',
  };
  assert.ok(!validateEffectConfig(emptyColor).valid);
});

test('clampEffectConfig constrains out-of-bounds parameters to safe ranges', () => {
  const excessive = clampEffectConfig({
    effectType: 'sparkle',
    intensity: 999,
    density: -5,
    opacity: 2.5,
    color: '#FFF',
    animationSpeed: 50,
    scale: 0.01,
    effectRadius: 500,
    effectHeight: -20,
    particleCount: 500,
    spawnInterval: 10,
    particleLifetime: 999999,
    randomness: 2.0,
    seed: -42,
  });

  assert.equal(excessive.intensity, EFFECT_BOUNDS.intensity.max);
  assert.equal(excessive.density, EFFECT_BOUNDS.density.min);
  assert.equal(excessive.opacity, EFFECT_BOUNDS.opacity.max);
  assert.equal(excessive.animationSpeed, EFFECT_BOUNDS.animationSpeed.max);
  assert.equal(excessive.scale, EFFECT_BOUNDS.scale.min);
  assert.equal(excessive.effectRadius, EFFECT_BOUNDS.effectRadius.max);
  assert.equal(excessive.effectHeight, EFFECT_BOUNDS.effectHeight.min);
  assert.equal(excessive.particleCount, EFFECT_BOUNDS.particleCount.max);
  assert.equal(excessive.spawnInterval, EFFECT_BOUNDS.spawnInterval.min);
  assert.equal(excessive.particleLifetime, EFFECT_BOUNDS.particleLifetime.max);
  assert.equal(excessive.randomness, EFFECT_BOUNDS.randomness.max);
  assert.equal(excessive.seed, 42); // Absolute integer
});

test('Non-finite numbers safely fallback to defaults in clampEffectConfig', () => {
  const nanConfig = clampEffectConfig({
    ...DEFAULT_CONFIGS.sparkle,
    intensity: NaN,
    particleCount: Infinity,
  });
  assert.ok(Number.isFinite(nanConfig.intensity));
  assert.ok(Number.isFinite(nanConfig.particleCount));
});

// ── 3. SEEDED DETERMINISTIC PARTICLE GENERATION ────────────
console.log('\n--- SUITE 3: Seeded Particle Determinism & Stability ---');

test('createRng produces uniform sequence with identical values for same seed', () => {
  const rng1 = createRng(12345);
  const rng2 = createRng(12345);

  for (let i = 0; i < 50; i++) {
    const v1 = rng1();
    const v2 = rng2();
    assert.equal(v1, v2, `Mismatch at step ${i}: ${v1} !== ${v2}`);
    assert.ok(v1 >= 0 && v1 < 1, 'Value out of [0, 1) range');
  }
});

test('Different seeds produce different particle sequences', () => {
  const rngA = createRng(100);
  const rngB = createRng(200);

  const valuesA = Array.from({ length: 10 }, () => rngA());
  const valuesB = Array.from({ length: 10 }, () => rngB());
  assert.notDeepEqual(valuesA, valuesB);
});

test('generateSparkleParticles is 100% deterministic under component remounts', () => {
  const config = DEFAULT_CONFIGS.sparkle;
  const p1 = generateSparkleParticles(config, 100, 200, 42);
  const p2 = generateSparkleParticles(config, 100, 200, 42);

  assert.equal(p1.length, p2.length);
  assert.deepEqual(p1, p2, 'Sparkle particles changed across identical seed re-evaluations');
});

test('generateRainParticles produces continuous streaks with background and foreground depth layering', () => {
  const config = DEFAULT_CONFIGS.light_rain;
  const r1 = generateRainParticles(config, 100, 200, 77);
  const r2 = generateRainParticles(config, 100, 200, 77);

  assert.equal(r1.length, r2.length);
  assert.deepEqual(r1, r2, 'Rain particles changed across identical seed re-evaluations');

  // Verify both background and foreground layers are populated for depth
  const backgroundDrops = r1.filter((d) => d.layer === 'background');
  const foregroundDrops = r1.filter((d) => d.layer === 'foreground');
  assert.ok(backgroundDrops.length > 0, 'Missing background rain streaks');
  assert.ok(foregroundDrops.length > 0, 'Missing foreground rain streaks');

  // Verify fine, delicate streak properties
  for (const d of r1) {
    assert.ok(d.length >= 10.0, `Streak too short: ${d.length}`);
    assert.ok(d.strokeWidth <= 1.2, `Streak stroke too thick: ${d.strokeWidth}`);
    assert.ok(d.speed >= 100, `Rain falling speed too slow: ${d.speed}`);
  }
});

test('generateRaindropPlacements creates tiny elliptical beads tightly resting on petals without floating', () => {
  const config = DEFAULT_CONFIGS.raindrop;
  const anchors = getBlossomAnchors(100, 200, 1.0);
  const d1 = generateRaindropPlacements(config, anchors, 99);
  const d2 = generateRaindropPlacements(config, anchors, 99);

  assert.equal(d1.length, d2.length);
  assert.deepEqual(d1, d2);
  assert.ok(d1.length > 0 && d1.length <= anchors.length);

  // Assert each droplet references a valid anchor and adheres tightly
  for (const d of d1) {
    assert.ok(d.anchorIndex >= 0 && d.anchorIndex < anchors.length);
    const anchor = anchors[d.anchorIndex];

    // Tight adhesion to petal surface (<= 1.0px jitter, no floating in air)
    const dist = Math.hypot(d.x - anchor.x, d.y - anchor.y);
    assert.ok(dist <= 1.0, `Droplet floated away from blossom anchor: dist=${dist}`);

    // Verify small elliptical shape (bead resting on petal, width >= height)
    assert.ok(d.width >= d.height, `Droplet should be a resting elliptical bead: w=${d.width}, h=${d.height}`);
    assert.ok(d.width <= 3.0, `Droplet too large: width=${d.width}`);
    assert.ok(d.opacity > 0 && d.opacity <= 0.8, `Droplet opacity outside subtle range: ${d.opacity}`);
  }
});

// ── 4. EFFECT EXPIRATION & ACTIVE CHECKS ───────────────────
console.log('\n--- SUITE 4: Effect Expiration & Active Checks ---');

test('isFlowerEffectActive returns true during planting day and false after expiration', () => {
  const effect = createDailyFlowerEffect(
    'test-cluster',
    '2026-10-13',
    DEFAULT_CONFIGS.sparkle,
    undefined,
    {
      startAt: '2026-10-13T12:00:00.000Z',
      timeZone: 'America/Vancouver',
    }
  );

  // During active planting hours
  assert.ok(
    isFlowerEffectActive(effect, '2026-10-13T18:00:00.000Z'),
    'Effect should be active during the planting day'
  );

  // Just after local midnight (Vancouver PDT midnight is 07:00:00 UTC)
  assert.ok(
    !isFlowerEffectActive(effect, '2026-10-14T07:00:01.000Z'),
    'Effect should be expired past local midnight'
  );
});

test('Expired effect record preserves its configuration without data deletion', () => {
  const effect = createDailyFlowerEffect(
    'test-cluster-2',
    '2026-10-13',
    DEFAULT_CONFIGS.light_rain,
    DEFAULT_CONFIGS.raindrop
  );

  // Query far in the future
  const active = isFlowerEffectActive(effect, '2027-01-01T00:00:00.000Z');
  assert.equal(active, false);

  // The record still retains its full configuration intact
  assert.equal(effect.primaryEffect.effectType, 'light_rain');
  assert.equal(effect.secondaryEffect.effectType, 'raindrop');
  assert.equal(effect.clusterId, 'test-cluster-2');
});

// ── 5. LOCAL-MIDNIGHT BOUNDARY & DST HANDLING ─────────────
console.log('\n--- SUITE 5: Local Midnight & DST Boundary Handling ---');

test('Calculates next local midnight in America/Vancouver during PDT (UTC-7)', () => {
  // July 15 (PDT): midnight ending July 15 is July 16 00:00:00 PDT -> 07:00:00 UTC
  const midnightUtc = getNextLocalMidnight('2026-07-15', 'America/Vancouver');
  assert.equal(midnightUtc, '2026-07-16T07:00:00.000Z');
});

test('Calculates next local midnight in America/Vancouver during PST (UTC-8)', () => {
  // December 15 (PST): midnight ending Dec 15 is Dec 16 00:00:00 PST -> 08:00:00 UTC
  const midnightUtc = getNextLocalMidnight('2026-12-15', 'America/Vancouver');
  assert.equal(midnightUtc, '2026-12-16T08:00:00.000Z');
});

test('Handles Spring Forward DST boundary in March correctly (23-hour calendar day)', () => {
  // March 7, 2026: midnight transition into Sunday March 8 (DST begins at 2am)
  const midnightMar7 = getNextLocalMidnight('2026-03-07', 'America/Vancouver');
  assert.equal(midnightMar7, '2026-03-08T08:00:00.000Z');

  // March 8, 2026 (day with only 23 hours!): midnight ending March 8 is March 9 00:00:00 PDT -> 07:00:00 UTC
  const midnightMar8 = getNextLocalMidnight('2026-03-08', 'America/Vancouver');
  assert.equal(midnightMar8, '2026-03-09T07:00:00.000Z');
});

test('Handles Fall Back DST boundary in November correctly (25-hour calendar day)', () => {
  // Oct 31, 2026 (before fall back): midnight is Nov 1 07:00:00 UTC
  const midnightOct31 = getNextLocalMidnight('2026-10-31', 'America/Vancouver');
  assert.equal(midnightOct31, '2026-11-01T07:00:00.000Z');

  // Nov 1, 2026 (day with 25 hours): midnight ending Nov 1 is Nov 2 00:00:00 PST -> 08:00:00 UTC
  const midnightNov1 = getNextLocalMidnight('2026-11-01', 'America/Vancouver');
  assert.equal(midnightNov1, '2026-11-02T08:00:00.000Z');
});

// ── 6. HISTORICAL REPLAY MODE ──────────────────────────────
console.log('\n--- SUITE 6: Historical Replay Mode ---');

test('Historical replay renders an expired effect regardless of elapsed time', () => {
  const expiredEffect = createDailyFlowerEffect(
    'historical-flower',
    '2026-01-01',
    DEFAULT_CONFIGS.sparkle,
    DEFAULT_CONFIGS.glow,
    { startAt: '2026-01-01T10:00:00.000Z' }
  );

  const currentTime = '2026-10-13T12:00:00.000Z'; // months later

  // Normal check: expired
  assert.equal(isFlowerEffectActive(expiredEffect, currentTime, { historicalReplay: false }), false);

  // Historical replay enabled: active!
  assert.equal(isFlowerEffectActive(expiredEffect, currentTime, { historicalReplay: true }), true);
});

// ── 7. PRIMARY & SECONDARY EFFECT COMBINATIONS ─────────────
console.log('\n--- SUITE 7: Primary and Secondary Effect Combinations ---');

test('Combines Sparkle and Glow without collision or state conflict', () => {
  const { primaryEffect, secondaryEffect } = resolveMoodPreset('very_positive');
  assert.equal(primaryEffect.effectType, 'sparkle');
  assert.equal(secondaryEffect.effectType, 'glow');

  const sparkles = generateSparkleParticles(primaryEffect, 100, 100, primaryEffect.seed);
  const glow = calculateGlowParameters(secondaryEffect, 1.5);

  assert.ok(sparkles.length > 0);
  assert.ok(glow.opacity > 0 && glow.opacity <= 0.35); // Soft, low-opacity breathing
  assert.ok(glow.radius > 0);
});

test('Combines Light Rain and Raindrop on flower blossoms', () => {
  const { primaryEffect, secondaryEffect } = resolveMoodPreset('very_negative');
  assert.equal(primaryEffect.effectType, 'light_rain');
  assert.equal(secondaryEffect.effectType, 'raindrop');

  const rain = generateRainParticles(primaryEffect, 100, 100, primaryEffect.seed);
  const anchors = getBlossomAnchors(100, 100, 1.0);
  const droplets = generateRaindropPlacements(secondaryEffect, anchors, secondaryEffect.seed);

  assert.ok(rain.length > 0);
  assert.ok(droplets.length > 0);
});

// ── 8. PARTICLE CONFINEMENT WITHIN TARGET CLUSTER ──────────
console.log('\n--- SUITE 8: Particle Confinement & Neighbor Isolation ---');

test('Sparkle particles remain strictly confined within effectRadius and effectHeight', () => {
  const config = DEFAULT_CONFIGS.sparkle;
  const worldX = 150;
  const worldY = 250;
  const particles = generateSparkleParticles(config, worldX, worldY, 1234);

  for (const p of particles) {
    const dx = Math.abs(p.x - worldX);
    const dy = worldY - p.y; // height extends upwards
    assert.ok(dx <= config.effectRadius, `Sparkle particle X leaked: dx=${dx} > r=${config.effectRadius}`);
    assert.ok(dy >= -10 && dy <= config.effectHeight + 10, `Sparkle particle Y leaked: dy=${dy}`);
  }
});

test('Light rain particles stay inside vertical column above the flower cluster', () => {
  const config = DEFAULT_CONFIGS.light_rain;
  const worldX = 200;
  const worldY = 300;
  const rain = generateRainParticles(config, worldX, worldY, 5678);

  for (const d of rain) {
    const dx = Math.abs(d.x - worldX);
    assert.ok(dx <= config.effectRadius, `Rain particle X leaked: dx=${dx} > r=${config.effectRadius}`);
  }
});

test('Adjacent clusters: particles in Cluster A NEVER spill into Cluster B', () => {
  const clusterA_X = 100;
  const clusterB_X = 260; // Separated by 160px
  const clusterY = 200;

  const configA = { ...DEFAULT_CONFIGS.sparkle, effectRadius: 50 };
  const configB = { ...DEFAULT_CONFIGS.none, effectRadius: 50 };

  const particlesA = generateSparkleParticles(configA, clusterA_X, clusterY, 42);
  const rainA = generateRainParticles({ ...DEFAULT_CONFIGS.light_rain, effectRadius: 50 }, clusterA_X, clusterY, 42);

  // Neighbor B boundary begins at clusterB_X - configB.effectRadius = 260 - 50 = 210
  const neighborThreshold = clusterB_X - configB.effectRadius;

  for (const p of particlesA) {
    assert.ok(p.x < neighborThreshold, `Cluster A sparkle leaked into Cluster B territory: x=${p.x} >= ${neighborThreshold}`);
  }

  for (const r of rainA) {
    assert.ok(r.x < neighborThreshold, `Cluster A rain leaked into Cluster B territory: x=${r.x} >= ${neighborThreshold}`);
  }
});

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passedTests} / ${passedTests} assertions passed (100%)`);
console.log('>>> ALL FLOWER MOOD EFFECTS TESTS PASSED! <<<');
console.log('====================================================\n');
